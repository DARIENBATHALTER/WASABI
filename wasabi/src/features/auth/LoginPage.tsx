import React, { useState, useEffect } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useStore } from '../../store';
import { useNavigate } from 'react-router-dom';

const DEFAULT_USER = {
  email: 'techsupport@wayman.org',
  password: 'OOoo00))',
  name: 'Tech Support',
  role: 'Administrator'
};

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState<'email' | 'password'>('email');
  const [showForgotModal, setShowForgotModal] = useState(false);
  
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

    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 800));

    if (email === DEFAULT_USER.email && password === DEFAULT_USER.password) {
      setCurrentUser({
        id: '1',
        email: DEFAULT_USER.email,
        name: DEFAULT_USER.name,
        role: DEFAULT_USER.role
      });
      navigate('/');
    } else {
      setError('Wrong password. Try again or click Forgot password to reset it.');
    }
    
    setIsLoading(false);
  };

  const handleBack = () => {
    setStep('email');
    setPassword('');
    setError('');
  };

  const handleDevLogin = async () => {
    setError('');
    setIsLoading(true);
    
    // Simulate quick API call
    await new Promise(resolve => setTimeout(resolve, 300));
    
    setCurrentUser({
      id: '1',
      email: DEFAULT_USER.email,
      name: DEFAULT_USER.name,
      role: DEFAULT_USER.role
    });
    navigate('/');
  };

  return (
    <>
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

      <div className="min-h-screen bg-gray-800 flex items-center justify-center p-4">
        {/* Responsive Container */}
        <div className="w-full max-w-md lg:max-w-5xl">
          
          {/* Mobile/Tablet Layout (sm and below) */}
          <div className="lg:hidden">
            <div className="bg-gray-900 rounded-3xl p-8 w-full max-w-sm mx-auto">
              {/* Mobile Header */}
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

              {/* Mobile Form Container */}
              <div className="relative min-h-[280px]">
                {/* Email Step */}
                <div className={`transition-all duration-500 ease-in-out ${
                  step === 'email' ? 'opacity-100' : 'opacity-0 absolute inset-0 pointer-events-none'
                }`}>
                  <div className="space-y-4">
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
                      <button
                        type="button"
                        onClick={handleDevLogin}
                        disabled={isLoading}
                        className="text-sm text-green-400 hover:text-green-300 disabled:text-green-600 block"
                      >
                        🚀 Dev Login (Quick Access)
                      </button>
                    </div>

                    <div className="pt-4">
                      <button
                        type="button"
                        onClick={(e) => handleEmailSubmit(e as any)}
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
                  </div>
                </div>

                {/* Password Step */}
                <div className={`transition-all duration-500 ease-in-out ${
                  step === 'password' ? 'opacity-100' : 'opacity-0 absolute inset-0 pointer-events-none'
                }`}>
                  <div className="space-y-4">
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
                      <button
                        type="button"
                        onClick={handleDevLogin}
                        disabled={isLoading}
                        className="text-sm text-green-400 hover:text-green-300 disabled:text-green-600 block"
                      >
                        🚀 Dev Login (Quick Access)
                      </button>
                    </div>

                    <div className="pt-4">
                      <button
                        type="button"
                        onClick={(e) => handlePasswordSubmit(e as any)}
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
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Desktop Layout (lg and above) */}
          <div className="hidden lg:block">
            <div className="bg-gray-900 rounded-[2.5rem] overflow-hidden w-full flex min-h-[378px]">
              {/* Left side - Branding */}
              <div className="flex-1 flex flex-col px-10 pt-10">
                <div className="max-w-md">
                  <div className="mb-8">
                    <img 
                      src="/wasabilogo.png" 
                      alt="WASABI Logo" 
                      className="h-[52px] w-auto mb-4"
                    />
                    <h1 className="text-4xl font-medium text-white mb-3" style={{ fontFamily: 'Poppins, sans-serif', letterSpacing: '-0.02em' }}>
                      <span style={{ fontSize: '2.5rem' }}>S</span>ign in
                    </h1>
                    <p className="text-lg text-gray-300">
                      to continue to WASABI
                    </p>
                  </div>
                </div>
              </div>

              {/* Right side - Form */}
              <div className="flex-1 flex flex-col justify-center px-10 relative">
                <div className="w-full max-w-sm">
                  <div className="relative overflow-hidden min-h-[200px]">
                    {/* Email Step */}
                    <div className={`w-full transition-all duration-500 ease-in-out ${
                      step === 'email' ? 'opacity-100' : 'opacity-0 absolute inset-0 pointer-events-none'
                    }`}>
                      <div className="space-y-4">
                        {error && step === 'email' && (
                          <div className="bg-red-900 border border-red-700 rounded-lg p-3">
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
                            className="appearance-none block w-full px-4 py-4 bg-transparent border-2 border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
                            placeholder="Email or phone"
                            autoFocus
                          />
                        </div>

                        <div className="space-y-2">
                          <button
                            type="button"
                            onClick={() => setShowForgotModal(true)}
                            className="text-sm text-blue-400 hover:text-blue-300 block"
                          >
                            Forgot email?
                          </button>
                          <button
                            type="button"
                            onClick={handleDevLogin}
                            disabled={isLoading}
                            className="text-sm text-green-400 hover:text-green-300 disabled:text-green-600 block"
                          >
                            🚀 Dev Login (Quick Access)
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Password Step */}
                    <div className={`w-full transition-all duration-500 ease-in-out ${
                      step === 'password' ? 'opacity-100' : 'opacity-0 absolute inset-0 pointer-events-none'
                    }`}>
                      <div className="space-y-4">
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
                          <span className="text-gray-400">{email}</span>
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
                              className="appearance-none block w-full px-4 py-4 pr-12 bg-transparent border-2 border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
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

                        <div className="space-y-2">
                          <button
                            type="button"
                            onClick={() => setShowForgotModal(true)}
                            className="text-sm text-blue-400 hover:text-blue-300 block"
                          >
                            Forgot password?
                          </button>
                          <button
                            type="button"
                            onClick={handleDevLogin}
                            disabled={isLoading}
                            className="text-sm text-green-400 hover:text-green-300 disabled:text-green-600 block"
                          >
                            🚀 Dev Login (Quick Access)
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Desktop Action Button - Bottom Right */}
                <div className="absolute bottom-8 right-8">
                  {step === 'email' ? (
                    <button
                      type="button"
                      onClick={(e) => handleEmailSubmit(e as any)}
                      disabled={isLoading || !email.trim()}
                      className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white px-6 py-2 rounded-full text-sm font-medium disabled:cursor-not-allowed transition-colors"
                    >
                      {isLoading ? (
                        <div className="flex items-center">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Loading...
                        </div>
                      ) : (
                        'Next'
                      )}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={(e) => handlePasswordSubmit(e as any)}
                      disabled={isLoading || !password.trim()}
                      className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white px-6 py-2 rounded-full text-sm font-medium disabled:cursor-not-allowed transition-colors"
                    >
                      {isLoading ? (
                        <div className="flex items-center">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Signing in...
                        </div>
                      ) : (
                        'Sign in'
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}