import React, { useState, useEffect, useRef } from 'react';
import { Eye, EyeOff, Upload } from 'lucide-react';
import { useStore } from '../../store';
import { useNavigate } from 'react-router-dom';
import { userService } from '../../services/userService';
import { databaseBackupService } from '../../services/databaseBackupService';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState<'email' | 'password'>('email');
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [loginPhase, setLoginPhase] = useState<'form' | 'logging-in' | 'connecting'>('form');
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<string[]>([]);
  const [importStatus, setImportStatus] = useState<'idle' | 'importing' | 'success' | 'error'>('idle');
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { setCurrentUser, currentUser, isSessionValid } = useStore();
  const navigate = useNavigate();


  // Redirect to home if already authenticated with valid session
  useEffect(() => {
    if (currentUser && isSessionValid()) {
      navigate('/');
    }
  }, [currentUser, isSessionValid, navigate]);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    
    setError('');
    setIsLoading(true);

    // Simulate API call delay for email validation
    await new Promise(resolve => setTimeout(resolve, 500));

    // In a real app, you'd validate the email exists here
    // For now, we'll just proceed to password step
    setStep('password');
    setIsLoading(false);
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      // Start loading sequence
      setLoginPhase('logging-in');
      
      // "Logging in..." phase
      await new Promise(resolve => setTimeout(resolve, 1200));
      
      setLoginPhase('connecting');
      
      // "Connecting to WASABI..." phase
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // Check for hardcoded admin credentials first
      if (email === 'admin@wasabi.com' && password === '1176') {
        setCurrentUser({
          id: '999',
          email: 'admin@wasabi.com',
          name: 'Administrator',
          role: 'Administrator'
        });
        navigate('/');
        return;
      }
      
      // Otherwise check database
      const user = await userService.validateLogin(email, password);
      
      if (user) {
        setCurrentUser({
          id: user.id!.toString(),
          email: user.email,
          name: user.name,
          role: user.role
        });
        navigate('/');
      } else {
        setError('Wrong email or password. Try again or click Forgot password to reset it.');
        setLoginPhase('form');
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('An error occurred during login. Please try again.');
      setLoginPhase('form');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    setStep('email');
    setPassword('');
    setError('');
  };

  const handleImportDatabase = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setImportStatus('importing');
    setImportProgress([]);
    setError('');

    try {
      // Show file info
      const fileSizeMB = (file.size / 1024 / 1024).toFixed(2);
      setImportProgress(prev => [...prev, `📂 Loading ${file.name} (${fileSizeMB} MB)`]);
      
      // Simulate progress messages (since we can't get real progress from the service)
      setTimeout(() => {
        setImportProgress(prev => [...prev, '🔍 Validating database structure...']);
      }, 500);
      
      setTimeout(() => {
        setImportProgress(prev => [...prev, '👥 Importing user accounts...']);
      }, 1000);
      
      setTimeout(() => {
        setImportProgress(prev => [...prev, '📚 Loading student records...']);
      }, 1500);
      
      setTimeout(() => {
        setImportProgress(prev => [...prev, '📊 Processing assessment data...']);
      }, 2000);

      await databaseBackupService.importDatabase(file, true);
      
      setImportProgress(prev => [...prev, '✅ Database imported successfully!']);
      setImportStatus('success');
      
      // Reset after showing success
      setTimeout(() => {
        setImportStatus('idle');
        setImportProgress([]);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }, 3000);
    } catch (err: any) {
      console.error('Import error:', err);
      setImportProgress(prev => [...prev, `❌ Import failed: ${err.message}`]);
      setImportStatus('error');
      
      setTimeout(() => {
        setImportStatus('idle');
        setImportProgress([]);
      }, 5000);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <>
      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
      {/* Forgot Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-900 rounded-2xl p-8 max-w-md w-full">
            <h2 className="text-xl font-semibold text-white mb-4">
              Forgot Login Information?
            </h2>
            <p className="text-gray-300 mb-6">
              Send an email to <a href="mailto:techsupport@wayman.org" className="text-blue-400 hover:text-blue-300">techsupport@wayman.org</a> to recover your login information.
            </p>
            <div className="flex justify-end">
              <button
                onClick={() => setShowForgotModal(false)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-full text-sm font-medium transition-colors"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="min-h-screen bg-gray-800 flex items-center justify-center p-4 relative">
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleImportDatabase}
          className="hidden"
        />

        {/* Import Progress Console */}
        {importStatus !== 'idle' && (
          <div className="fixed bottom-20 right-4 w-96 bg-gray-900 border border-gray-700 rounded-lg shadow-xl overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-4 py-2">
              <h3 className="text-sm font-medium text-white">Database Import</h3>
            </div>
            <div className="p-4 max-h-64 overflow-y-auto">
              <div className="space-y-2 font-mono text-xs">
                {importProgress.map((message, index) => (
                  <div
                    key={index}
                    className="text-gray-300 animate-fadeIn"
                    style={{
                      animation: 'fadeIn 0.3s ease-in',
                      animationDelay: `${index * 0.1}s`,
                      animationFillMode: 'both'
                    }}
                  >
                    {message}
                  </div>
                ))}
                {isImporting && (
                  <div className="flex items-center gap-2 text-blue-400 mt-2">
                    <div className="animate-spin rounded-full h-3 w-3 border-2 border-blue-400 border-t-transparent"></div>
                    Processing...
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Load Database Button - Fixed Position */}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isImporting}
          className="fixed bottom-4 right-4 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-full text-sm flex items-center gap-2 transition-colors shadow-lg"
        >
          <Upload className="h-4 w-4" />
          {isImporting ? 'Loading...' : 'Load Database'}
        </button>

        {/* Single Responsive Container */}
        <div className={`w-full transition-all duration-700 ease-in-out ${
          loginPhase === 'form' 
            ? 'max-w-md lg:max-w-5xl' 
            : 'max-w-sm'
        }`}>
          {/* Mobile Layout */}
          <div className="lg:hidden">
            <div className={`bg-gray-900 rounded-3xl p-8 w-full max-w-sm mx-auto transition-all duration-700 ease-in-out ${
              loginPhase !== 'form' ? 'py-16' : ''
            }`}>
              {/* Mobile Loading Screen */}
              {loginPhase !== 'form' && (
                <div className="text-center">
                  <div className="mb-8">
                    <img 
                      src="/wasabilogo.png" 
                      alt="WASABI Logo" 
                      className={`mx-auto transition-all duration-500 ease-in-out ${
                        loginPhase === 'logging-in' ? 'h-16 w-auto' : 'h-20 w-auto'
                      }`}
                    />
                  </div>
                  
                  <div className="space-y-6">
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-6 w-6 border-2 border-wasabi-green border-t-transparent"></div>
                    </div>
                    
                    <div className="relative h-16 flex flex-col items-center justify-center">
                      <h2 className={`text-xl font-medium text-white transition-all duration-500 ease-in-out absolute ${
                        loginPhase === 'logging-in' 
                          ? 'opacity-100 transform translate-y-0' 
                          : 'opacity-0 transform -translate-y-2'
                      }`}>
                        Logging in...
                      </h2>
                      <h2 className={`text-xl font-medium text-white transition-all duration-500 ease-in-out absolute ${
                        loginPhase === 'connecting' 
                          ? 'opacity-100 transform translate-y-0' 
                          : 'opacity-0 transform translate-y-2'
                      }`}>
                        Connecting to WASABI
                      </h2>
                    </div>
                    <p className="text-gray-400 text-sm mt-2">
                      Please wait...
                    </p>
                  </div>
                </div>
              )}

              {/* Mobile Header */}
              {loginPhase === 'form' && (
                <div className="text-center mb-8">
                  <img 
                    src="/wasabilogo.png" 
                    alt="WASABI Logo" 
                    className="h-12 w-auto mx-auto mb-6"
                  />
                  <h1 className="text-2xl font-medium text-white mb-2 tracking-tight">
                    Sign in
                  </h1>
                  <p className="text-base text-gray-300">
                    to continue to WASABI
                  </p>
                </div>
              )}

              {/* Mobile Form Container */}
              {loginPhase === 'form' && (
                <div className="relative min-h-[280px]">
                  {/* Email Step */}
                  <div className={`transition-all duration-500 ease-in-out ${
                    step === 'email' ? 'opacity-100' : 'opacity-0 absolute inset-0 pointer-events-none'
                  }`}>
                    <form onSubmit={handleEmailSubmit} className="space-y-4">
                      {error && step === 'email' && (
                        <div className="bg-red-900 border border-red-700 rounded-lg p-3">
                          <div className="text-sm text-red-200">{error}</div>
                        </div>
                      )}

                      <div>
                        <input
                          id="email-mobile"
                          name="email"
                          type="email"
                          autoComplete="email"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="appearance-none block w-full px-4 py-3 bg-transparent border-2 border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
                          placeholder="Email or phone"
                          autoFocus
                        />
                      </div>

                      <div className="space-y-3">
                        <button
                          type="button"
                          onClick={() => setShowForgotModal(true)}
                          className="text-sm text-blue-400 hover:text-blue-300 block"
                        >
                          Forgot email?
                        </button>
                      </div>

                      <div className="pt-4">
                        <button
                          type="submit"
                          disabled={isLoading || !email.trim()}
                          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white px-6 py-3 rounded-full text-base font-medium disabled:cursor-not-allowed transition-colors"
                        >
                          {isLoading ? (
                            <div className="flex items-center justify-center">
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                              Loading...
                            </div>
                          ) : (
                            'Next'
                          )}
                        </button>
                      </div>
                    </form>
                  </div>

                  {/* Password Step */}
                  <div className={`transition-all duration-500 ease-in-out ${
                    step === 'password' ? 'opacity-100' : 'opacity-0 absolute inset-0 pointer-events-none'
                  }`}>
                    <form onSubmit={handlePasswordSubmit} className="space-y-4">
                      {error && step === 'password' && (
                        <div className="bg-red-900 border border-red-700 rounded-lg p-3">
                          <div className="text-sm text-red-200">{error}</div>
                        </div>
                      )}

                      {/* Show email with back button */}
                      <div className="flex items-center space-x-3 text-sm">
                        <button
                          type="button"
                          onClick={handleBack}
                          className="text-blue-400 hover:text-blue-300 flex items-center"
                        >
                          ← Back
                        </button>
                        <span className="text-gray-400 truncate">{email}</span>
                      </div>

                      <div>
                        <div className="relative">
                          <input
                            id="password-mobile"
                            name="password"
                            type={showPassword ? 'text' : 'password'}
                            autoComplete="current-password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="appearance-none block w-full px-4 py-3 pr-12 bg-transparent border-2 border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
                            placeholder="Enter your password"
                            autoFocus
                          />
                          <button
                            type="button"
                            className="absolute inset-y-0 right-0 pr-4 flex items-center"
                            onClick={() => setShowPassword(!showPassword)}
                          >
                            {showPassword ? (
                              <EyeOff className="h-5 w-5 text-gray-400 hover:text-gray-300" />
                            ) : (
                              <Eye className="h-5 w-5 text-gray-400 hover:text-gray-300" />
                            )}
                          </button>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <button
                          type="button"
                          onClick={() => setShowForgotModal(true)}
                          className="text-sm text-blue-400 hover:text-blue-300 block"
                        >
                          Forgot password?
                        </button>
                      </div>

                      <div className="pt-4">
                        <button
                          type="submit"
                          disabled={isLoading || !password.trim()}
                          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white px-6 py-3 rounded-full text-base font-medium disabled:cursor-not-allowed transition-colors"
                        >
                          {isLoading ? (
                            <div className="flex items-center justify-center">
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                              Signing in...
                            </div>
                          ) : (
                            'Sign in'
                          )}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Desktop Layout */}
          <div className="hidden lg:block">
            <div className={`bg-gray-900 rounded-[2.5rem] overflow-hidden w-full flex transition-all duration-700 ease-in-out ${
              loginPhase !== 'form' ? 'min-h-[400px] items-center justify-center' : 'min-h-[378px]'
            }`}>
              {/* Desktop Loading Screen */}
              {loginPhase !== 'form' && (
                <div className="w-full text-center">
                  <div className="mb-8">
                    <img 
                      src="/wasabilogo.png" 
                      alt="WASABI Logo" 
                      className={`mx-auto transition-all duration-500 ease-in-out ${
                        loginPhase === 'logging-in' ? 'h-20 w-auto' : 'h-24 w-auto'
                      }`}
                    />
                  </div>
                  
                  <div className="space-y-6">
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-2 border-wasabi-green border-t-transparent"></div>
                    </div>
                    
                    <div className="relative h-20 flex flex-col items-center justify-center">
                      <h2 className={`text-2xl font-medium text-white transition-all duration-500 ease-in-out absolute ${
                        loginPhase === 'logging-in' 
                          ? 'opacity-100 transform translate-y-0' 
                          : 'opacity-0 transform -translate-y-2'
                      }`}>
                        Logging in...
                      </h2>
                      <h2 className={`text-xl font-medium text-white transition-all duration-500 ease-in-out absolute ${
                        loginPhase === 'connecting' 
                          ? 'opacity-100 transform translate-y-0' 
                          : 'opacity-0 transform translate-y-2'
                      }`}>
                        Connecting to WASABI
                      </h2>
                    </div>
                    <p className="text-gray-400 text-sm mt-2">
                      Please wait...
                    </p>
                  </div>
                </div>
              )}

              {/* Desktop Form */}
              {loginPhase === 'form' && (
                <>
                  {/* Left side - Sign in text */}
                  <div className="flex-1 p-16 flex flex-col justify-start pt-12">
                    <div className="mb-6">
                      <img 
                        src="/wasabilogo.png" 
                        alt="WASABI Logo" 
                        className="h-16 w-auto"
                      />
                    </div>
                    <h1 className="text-4xl font-medium text-white mb-3 tracking-tight">
                      Sign in
                    </h1>
                    <p className="text-xl text-gray-300">
                      to continue to WASABI
                    </p>
                  </div>

                  {/* Right side - Form */}
                  <div className={`w-[520px] bg-gray-950 flex items-center justify-center transition-all duration-700 ease-in-out ${
                    loginPhase !== 'form' ? 'min-h-[400px] items-center justify-center' : 'min-h-[378px]'
                  }`}>
                    <div className="w-full px-16 py-12">
                      {/* Email Form */}
                      <form 
                        id="email-form-desktop" 
                        onSubmit={handleEmailSubmit}
                        className={`space-y-6 transition-all duration-500 ease-in-out ${
                          step === 'email' ? 'opacity-100' : 'opacity-0 absolute pointer-events-none'
                        }`}
                      >
                        {error && step === 'email' && (
                          <div className="bg-red-900 border border-red-700 rounded-lg p-4">
                            <div className="text-sm text-red-200">{error}</div>
                          </div>
                        )}

                        <div>
                          <input
                            id="email-desktop"
                            name="email"
                            type="email"
                            autoComplete="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="appearance-none block w-full px-4 py-3 bg-transparent border-2 border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="Email or phone"
                            autoFocus
                          />
                        </div>

                        <div className="space-y-4">
                          <button
                            type="button"
                            onClick={() => setShowForgotModal(true)}
                            className="text-sm text-blue-400 hover:text-blue-300 block"
                          >
                            Forgot email?
                          </button>
                        </div>

                        <div className="mt-8">
                          <button
                            type="submit"
                            disabled={isLoading || !email.trim()}
                            className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white px-6 py-2 rounded-full text-sm font-medium disabled:cursor-not-allowed transition-colors w-full"
                          >
                            {isLoading ? (
                              <div className="flex items-center justify-center">
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                Loading...
                              </div>
                            ) : (
                              'Next'
                            )}
                          </button>
                        </div>
                      </form>

                      {/* Password Form */}
                      <form 
                        id="password-form-desktop" 
                        onSubmit={handlePasswordSubmit}
                        className={`space-y-6 transition-all duration-500 ease-in-out ${
                          step === 'password' ? 'opacity-100' : 'opacity-0 absolute pointer-events-none'
                        }`}
                      >
                        {error && step === 'password' && (
                          <div className="bg-red-900 border border-red-700 rounded-lg p-4">
                            <div className="text-sm text-red-200">{error}</div>
                          </div>
                        )}

                        {/* Show email with back button */}
                        <div className="flex items-center space-x-3 text-sm">
                          <button
                            type="button"
                            onClick={handleBack}
                            className="text-blue-400 hover:text-blue-300 flex items-center"
                          >
                            ← Back
                          </button>
                          <span className="text-gray-400 truncate">{email}</span>
                        </div>

                        <div>
                          <div className="relative">
                            <input
                              id="password-desktop"
                              name="password"
                              type={showPassword ? 'text' : 'password'}
                              autoComplete="current-password"
                              required
                              value={password}
                              onChange={(e) => setPassword(e.target.value)}
                              className="appearance-none block w-full px-4 py-3 pr-12 bg-transparent border-2 border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              placeholder="Enter your password"
                              autoFocus
                            />
                            <button
                              type="button"
                              className="absolute inset-y-0 right-0 pr-4 flex items-center"
                              onClick={() => setShowPassword(!showPassword)}
                            >
                              {showPassword ? (
                                <EyeOff className="h-5 w-5 text-gray-400 hover:text-gray-300" />
                              ) : (
                                <Eye className="h-5 w-5 text-gray-400 hover:text-gray-300" />
                              )}
                            </button>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <button
                            type="button"
                            onClick={() => setShowForgotModal(true)}
                            className="text-sm text-blue-400 hover:text-blue-300 block"
                          >
                            Forgot password?
                          </button>
                        </div>

                        <div className="mt-8">
                          <button
                            type="submit"
                            disabled={isLoading || !password.trim()}
                            className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white px-6 py-2 rounded-full text-sm font-medium disabled:cursor-not-allowed transition-colors w-full"
                          >
                            {isLoading ? (
                              <div className="flex items-center justify-center">
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                Signing in...
                              </div>
                            ) : (
                              'Sign in'
                            )}
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}