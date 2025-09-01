import React, { useState, useRef, useEffect } from 'react';
import { Maximize2, X, Send } from 'lucide-react';
import { SpiralIcon } from './SpiralIcon';
import { useStore } from '../../store';
import { useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { openAIService, type OpenAIMessage } from '../../services/openai';
import { StudentDataRetrieval } from '../../services/studentDataRetrieval';
import { StudentNameTranslationService } from '../../services/studentNameTranslation';

export default function NoriBubble() {
  const { 
    noriMinimized, 
    setNoriMinimized,
    noriMessages,
    addNoriMessage,
    updateNoriMessage
  } = useStore();
  const [showMiniChat, setShowMiniChat] = useState(false);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isAnalyzingData, setIsAnalyzingData] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [noriMessages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleMaximize = () => {
    setNoriMinimized(false);
    setShowMiniChat(false);
    navigate('/ai-assistant');
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
      const nameTranslation = await StudentNameTranslationService.translateNamesToIds(userMessage.content);
      
      // Step 2: Retrieve relevant student data based on the translated query
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

  if (!noriMinimized) return null;

  return (
    <>
      {/* Floating Nori Bubble */}
      <div className="fixed bottom-6 right-6 z-50">
        <button
          onClick={() => setShowMiniChat(!showMiniChat)}
          className="rounded-full p-4 transition-all transform hover:scale-110"
          style={{
            background: 'radial-gradient(circle at 25% 25%, #c084fc, #6d28d9)',
            boxShadow: '0 6px 15px rgba(0, 0, 0, 0.2), 0 2px 6px rgba(0, 0, 0, 0.15)',
          }}
          title="Ask Nori..."
        >
          <div className="flex items-center justify-center">
            <SpiralIcon size={28} className="text-white" style={{ marginTop: '1px', marginLeft: '1px' }} />
          </div>
        </button>
      </div>

      {/* Mini Chat Window */}
      {showMiniChat && (
        <div className="fixed bottom-28 right-6 z-50 w-96 h-[520px] bg-white dark:bg-gray-800 rounded-xl shadow-2xl flex flex-col">
          <div className="bg-purple-500 text-white p-3 rounded-t-xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <SpiralIcon size={22} className="text-white" />
              <div>
                <div className="font-medium text-lg">Nori</div>
                <div className="text-xs text-purple-100">🔒 Sessions not saved</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleMaximize}
                className="hover:bg-purple-600 p-2 rounded-lg transition-colors"
                title="Maximize"
              >
                <Maximize2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setShowMiniChat(false)}
                className="hover:bg-purple-600 p-2 rounded-lg transition-colors"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
          

          {/* Mini chat messages */}
          <div className="flex-1 overflow-y-auto p-4">
            {noriMessages.length === 0 ? (
              <div className="py-6">
                <div className="bg-gray-100 dark:bg-gray-700 rounded-xl px-3 py-3 text-sm text-gray-900 dark:text-gray-100 mb-4">
                  <div className="flex items-center gap-3 mb-3">
                    <SpiralIcon size={18} className="text-purple-500" />
                    <span className="font-medium text-sm text-purple-600 dark:text-purple-400">Nori</span>
                  </div>
                  <p className="text-sm leading-relaxed mb-3">
                    Hi! I'm Nori, your AI assistant for student analytics. I can help you:
                  </p>
                  <ul className="text-sm mt-3 space-y-2 text-gray-700 dark:text-gray-300">
                    <li>• Find students with specific performance metrics</li>
                    <li>• Analyze class and grade-level trends</li>
                    <li>• Answer questions about attendance & behavior</li>
                    <li>• Provide data-driven insights</li>
                  </ul>
                  <p className="text-sm mt-4 text-gray-600 dark:text-gray-400">
                    Ask me anything about your student data!
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {noriMessages.map((message) => (
                  <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                      message.role === 'user' 
                        ? 'bg-purple-500 text-white' 
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100'
                    }`}>
                      {message.role === 'assistant' ? (
                        <div className="mini-chat-content">
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                              h1: ({children}) => <h1 className="text-lg font-bold mb-3 mt-4">{children}</h1>,
                              h2: ({children}) => <h2 className="text-base font-bold mb-2 mt-3">{children}</h2>,
                              h3: ({children}) => <h3 className="text-sm font-bold mb-2 mt-3">{children}</h3>,
                              h4: ({children}) => <h4 className="text-sm font-semibold mb-2 mt-2">{children}</h4>,
                              p: ({children}) => <p className="mb-2 text-xs leading-relaxed">{children}</p>,
                              ul: ({children}) => <ul className="list-disc mb-3 ml-5 text-xs space-y-1">{children}</ul>,
                              ol: ({children}) => <ol className="list-decimal mb-3 ml-5 text-xs space-y-1">{children}</ol>,
                              li: ({children}) => <li className="mb-1 text-xs leading-relaxed">{children}</li>,
                              strong: ({children}) => <strong className="font-semibold">{children}</strong>,
                              code: ({children}) => <code className="bg-gray-200 dark:bg-gray-600 px-2 py-1 rounded text-xs font-mono">{children}</code>,
                            }}
                          >
                            {message.content}
                          </ReactMarkdown>
                        </div>
                      ) : (
                        <div className="whitespace-pre-wrap text-sm leading-relaxed">
                          {message.content}
                        </div>
                      )}
                      {message.isStreaming && (
                        <span className="inline-block ml-2">
                          <SpiralIcon size={14} className="animate-spin" />
                        </span>
                      )}
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Mini input */}
          <div className="border-t border-gray-200 dark:border-gray-700 p-3">
            <div className="flex gap-3">
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                placeholder="Ask Nori anything..."
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                disabled={isLoading}
              />
              <button
                onClick={sendMessage}
                disabled={!inputMessage.trim() || isLoading}
                className="bg-purple-500 hover:bg-purple-600 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white p-3 rounded-xl transition-colors disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <SpiralIcon size={18} className="animate-spin" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}