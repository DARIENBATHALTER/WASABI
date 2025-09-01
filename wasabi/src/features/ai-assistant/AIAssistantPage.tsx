import React, { useState, useRef, useEffect } from 'react';
import { Bot, Send, User, Loader2, Trash2, Download, Settings, AlertCircle, Database, Users, Loader, Minimize2, Maximize2, X, MessageCircle } from 'lucide-react';
import { SpiralIcon } from '../../shared/components/SpiralIcon';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../store';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { openAIService, type OpenAIMessage } from '../../services/openai';
import { StudentDataRetrieval } from '../../services/studentDataRetrieval';
import { StudentNameTranslationService } from '../../services/studentNameTranslation';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
}

interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
}

export default function AIAssistantPage() {
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [isAnalyzingData, setIsAnalyzingData] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const navigate = useNavigate();
  const { 
    theme, 
    noriMinimized, 
    setNoriMinimized,
    noriMessages,
    addNoriMessage,
    updateNoriMessage,
    clearNoriMessages
  } = useStore();

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [noriMessages]);

  // Auto-maximize when navigating to this page
  useEffect(() => {
    if (noriMinimized) {
      setNoriMinimized(false);
    }
  }, [noriMinimized, setNoriMinimized]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Clear all messages
  const clearChat = () => {
    clearNoriMessages();
  };

  // Send message to AI
  const sendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: inputMessage.trim(),
      timestamp: new Date()
    };

    // Add user message
    addNoriMessage(userMessage);
    setInputMessage('');
    setIsLoading(true);

    try {
      setApiError(null);
      setIsAnalyzingData(true);

      // Create assistant message with streaming indicator
      const assistantMessage = {
        id: `msg_${Date.now() + 1}`,
        role: 'assistant' as const,
        content: 'Nori is thinking...',
        timestamp: new Date(),
        isStreaming: true
      };

      addNoriMessage(assistantMessage);

      // Step 1: Translate student names to WASABI IDs for privacy
      console.log('🔄 Translating student names to WASABI IDs...');
      const nameTranslation = await StudentNameTranslationService.translateNamesToIds(userMessage.content);
      
      if (nameTranslation.translations.length > 0) {
        console.log('📝 Name translations:', nameTranslation.translations);
      }
      
      // Step 2: Retrieve relevant student data based on the translated query
      console.log('🔍 Starting RAG data retrieval for query:', nameTranslation.translatedMessage);
      const studentDataContext = await StudentDataRetrieval.retrieveRelevantData(nameTranslation.translatedMessage);
      
      // Add original query for subject analysis
      (studentDataContext as any).originalQuery = userMessage.content;
      
      setIsAnalyzingData(false);
      
      // Update message to show data analysis complete
      updateNoriMessage(assistantMessage.id, { 
        content: 'Nori is thinking...', 
        isStreaming: true 
      });

      // Step 3: Prepare OpenAI messages with translated query
      // Include conversation history + current user message for proper context
      const allMessages = [...noriMessages, userMessage];
      const openAIMessages: OpenAIMessage[] = allMessages
        .filter(msg => msg.role !== 'assistant' || !msg.isStreaming)
        .map(msg => ({
          role: msg.role,
          content: msg.role === 'user' && msg.content === userMessage.content 
            ? nameTranslation.translatedMessage  // Use translated message for the current query
            : msg.content
        }));

      // Step 4: Send to OpenAI with streaming and student data context
      let accumulatedContent = '';
      const rawResponse = await openAIService.sendMessage(
        openAIMessages,
        studentDataContext, // RAG context with relevant student data
        async (chunk: string) => {
          accumulatedContent += chunk;
          
          // Step 5: Translate WASABI IDs back to names in real-time
          const translatedChunk = await StudentNameTranslationService.translateIdsToNames(accumulatedContent);
          
          updateNoriMessage(assistantMessage.id, { 
            content: translatedChunk, 
            isStreaming: true 
          });
        }
      );

      // Step 6: Final translation and mark as complete
      const finalTranslatedResponse = await StudentNameTranslationService.translateIdsToNames(accumulatedContent);
      
      updateNoriMessage(assistantMessage.id, { 
        content: finalTranslatedResponse, 
        isStreaming: false 
      });

    } catch (error) {
      console.error('Error sending message to AI:', error);
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setApiError(errorMessage);
      
      // Add error message
      const errorResponse = {
        id: `msg_${Date.now() + 2}`,
        role: 'assistant' as const,
        content: `Sorry, I encountered an error: ${errorMessage}. Please check your API configuration and try again.`,
        timestamp: new Date()
      };

      addNoriMessage(errorResponse);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleMinimize = () => {
    setNoriMinimized(true);
    navigate('/');
  };

  const handleMaximize = () => {
    setNoriMinimized(false);
    setShowMiniChat(false);
  };

  // Don't render the full UI when minimized - the NoriBubble component handles the minimized state
  if (noriMinimized) {
    return null;
  }

  return (
    <div className="h-full p-4 dark:bg-gray-900" style={{ backgroundColor: theme === 'dark' ? undefined : '#d1d9e3' }}>
      <div className="h-full max-w-6xl mx-auto flex flex-col bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-3 rounded-t-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <SpiralIcon size={24} className="text-purple-500" />
            <div>
              <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                Nori
                <span className="bg-blue-500 text-white text-xs px-1.5 py-0.5 rounded-full font-medium">
                  BETA
                </span>
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                AI-Powered Student Analytics and Insights • 🔒 Chat sessions are not saved
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {apiError && (
              <div className="flex items-center gap-2 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                <p className="text-xs text-red-600 dark:text-red-300">API Error</p>
              </div>
            )}
            <button
              onClick={handleMinimize}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
              title="Minimize"
            >
              <Minimize2 className="w-5 h-5" />
            </button>
            <button
              onClick={clearChat}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
              title="Clear chat"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>


      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {noriMessages.length === 0 ? (
          <div className="text-center py-12">
            <SpiralIcon size={64} className="mx-auto mb-4 text-purple-500 opacity-50" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
              Hi! I'm Nori, your AI assistant
            </h3>
            <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto mb-6">
              I can help you analyze student data, find performance patterns, track attendance, and provide data-driven insights for better educational outcomes.
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              <button
                onClick={() => setInputMessage("Which students need immediate intervention?")}
                className="text-sm bg-red-100 dark:bg-red-900/20 hover:bg-red-200 dark:hover:bg-red-800/30 text-red-700 dark:text-red-300 px-3 py-2 rounded-lg transition-colors"
              >
                🚨 Students at risk
              </button>
              <button
                onClick={() => setInputMessage('How is "John Smith" performing academically?')}
                className="text-sm bg-yellow-100 dark:bg-yellow-900/20 hover:bg-yellow-200 dark:hover:bg-yellow-800/30 text-yellow-700 dark:text-yellow-300 px-3 py-2 rounded-lg transition-colors"
              >
                👤 Individual student
              </button>
              <button
                onClick={() => setInputMessage("Show me Grade 5 performance patterns")}
                className="text-sm bg-blue-100 dark:bg-blue-900/20 hover:bg-blue-200 dark:hover:bg-blue-800/30 text-blue-700 dark:text-blue-300 px-3 py-2 rounded-lg transition-colors"
              >
                📊 Grade analysis
              </button>
              <button
                onClick={() => setInputMessage("Find correlations between attendance and test scores")}
                className="text-sm bg-green-100 dark:bg-green-900/20 hover:bg-green-200 dark:hover:bg-green-800/30 text-green-700 dark:text-green-300 px-3 py-2 rounded-lg transition-colors"
              >
                🔍 Data patterns
              </button>
              <button
                onClick={() => setInputMessage("What interventions should I prioritize this week?")}
                className="text-sm bg-purple-100 dark:bg-purple-900/20 hover:bg-purple-200 dark:hover:bg-purple-800/30 text-purple-700 dark:text-purple-300 px-3 py-2 rounded-lg transition-colors"
              >
                💡 Action plan
              </button>
            </div>
          </div>
        ) : (
          noriMessages.map((message) => (
            <div
              key={message.id}
              className={`flex gap-3 ${
                message.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              {message.role === 'assistant' && (
                <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center flex-shrink-0">
                  <SpiralIcon size={16} className="text-white" />
                </div>
              )}
              
              <div
                className={`max-w-[70%] rounded-lg px-3 py-2 ${
                  message.role === 'user'
                    ? 'bg-blue-500 text-white ml-auto'
                    : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700'
                }`}
              >
                <div className="message-content">
                  {message.role === 'assistant' ? (
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        // Custom styling for markdown elements - headers larger than paragraphs
                        h1: ({children}) => <h1 className="text-2xl font-bold mt-5 mb-3 text-gray-900 dark:text-gray-100">{children}</h1>,
                        h2: ({children}) => <h2 className="text-xl font-bold mt-4 mb-3 text-gray-900 dark:text-gray-100">{children}</h2>,
                        h3: ({children}) => <h3 className="text-lg font-bold mt-4 mb-2 text-gray-900 dark:text-gray-100">{children}</h3>,
                        h4: ({children}) => <h4 className="text-base font-semibold mt-3 mb-2 text-gray-900 dark:text-gray-100">{children}</h4>,
                        p: ({children}) => <p className="mb-3 text-sm leading-relaxed text-gray-900 dark:text-gray-100">{children}</p>,
                        ul: ({children}) => <ul className="list-disc mb-3 ml-8 space-y-1 text-sm text-gray-900 dark:text-gray-100">{children}</ul>,
                        ol: ({children}) => <ol className="list-decimal mb-3 ml-8 space-y-1 text-sm text-gray-900 dark:text-gray-100">{children}</ol>,
                        li: ({children}) => <li className="mb-1 text-sm leading-relaxed text-gray-900 dark:text-gray-100">{children}</li>,
                        strong: ({children}) => <strong className="font-semibold text-gray-900 dark:text-gray-100">{children}</strong>,
                        em: ({children}) => <em className="italic text-gray-900 dark:text-gray-100">{children}</em>,
                        code: ({children}) => <code className="bg-gray-100 dark:bg-gray-700 px-1 py-0.5 rounded text-xs font-mono text-blue-600 dark:text-blue-400">{children}</code>,
                        pre: ({children}) => <pre className="bg-gray-100 dark:bg-gray-700 p-3 rounded-lg overflow-x-auto text-xs font-mono mb-2">{children}</pre>,
                        blockquote: ({children}) => <blockquote className="border-l-4 border-gray-300 dark:border-gray-600 pl-3 italic text-gray-700 dark:text-gray-300 mb-2">{children}</blockquote>,
                        table: ({children}) => <table className="min-w-full border-collapse border border-gray-300 dark:border-gray-600 mb-2 text-sm">{children}</table>,
                        th: ({children}) => <th className="border border-gray-300 dark:border-gray-600 px-2 py-1 bg-gray-100 dark:bg-gray-700 font-semibold text-gray-900 dark:text-gray-100">{children}</th>,
                        td: ({children}) => <td className="border border-gray-300 dark:border-gray-600 px-2 py-1 text-gray-900 dark:text-gray-100">{children}</td>,
                      }}
                    >
                      {message.content}
                    </ReactMarkdown>
                  ) : (
                    <div className="whitespace-pre-wrap">
                      {message.content}
                    </div>
                  )}
                  {message.isStreaming && (
                    <span className="inline-block ml-2">
                      <SpiralIcon size={14} className="animate-spin text-purple-500" />
                    </span>
                  )}
                </div>
                <div className="text-xs opacity-70 mt-2">
                  {message.timestamp.toLocaleTimeString()}
                </div>
              </div>

              {message.role === 'user' && (
                <div className="w-8 h-8 bg-gray-300 dark:bg-gray-600 rounded-full flex items-center justify-center flex-shrink-0">
                  <User className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                </div>
              )}
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-3 rounded-b-lg">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask Nori about student data, performance trends, or any educational insights..."
              className="w-full p-3 pr-12 border-2 border-gray-300 dark:border-gray-600 rounded-lg resize-none bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              rows={3}
              disabled={isLoading}
            />
            <div className="absolute bottom-2 right-2 text-xs text-gray-400">
              Enter to send • Shift+Enter for new line
            </div>
          </div>
          <button
            onClick={sendMessage}
            disabled={!inputMessage.trim() || isLoading}
            className="bg-purple-500 hover:bg-purple-600 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white p-3 rounded-lg transition-colors disabled:cursor-not-allowed flex items-center justify-center min-w-[48px]"
          >
            {isLoading ? (
              isAnalyzingData ? (
                <Database className="w-5 h-5 animate-pulse" />
              ) : (
                <SpiralIcon size={20} className="animate-spin" />
              )
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>
      </div>
    </div>
  );
}