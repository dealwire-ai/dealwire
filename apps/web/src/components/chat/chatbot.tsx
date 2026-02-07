'use client';

import { useChat } from 'ai/react';
import { useState } from 'react';
import { X, Send, MessageCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export function Chatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const { messages, input, handleInputChange, handleSubmit, isLoading, error } = useChat({
    api: '/api/chat',
  });

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setIsOpen(true)}
        className={cn(
          'fixed bottom-6 right-6 z-50',
          'h-14 w-14 rounded-full',
          'bg-[#3ECFA0] hover:bg-[#35b88f] text-black',
          'shadow-lg hover:shadow-xl',
          'flex items-center justify-center',
          'transition-all duration-200',
          'focus:outline-none focus:ring-2 focus:ring-[#3ECFA0] focus:ring-offset-2 focus:ring-offset-black'
        )}
        aria-label="Open chat"
      >
        <MessageCircle className="h-6 w-6" />
      </button>

      {/* Chat panel */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-end pointer-events-none">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
          />

          {/* Chat window */}
          <div className="relative w-full max-w-md h-[600px] bg-zinc-900 border border-zinc-800 rounded-t-lg shadow-2xl flex flex-col pointer-events-auto">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-zinc-800">
              <h2 className="text-lg font-semibold text-white">Chat Assistant</h2>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
                aria-label="Close chat"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 && (
                <div className="text-center text-zinc-400 py-8">
                  <MessageCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">Ask me anything about your deals, contacts, or properties!</p>
                  <p className="text-xs mt-2 text-zinc-500">Try: "Show me all deals from New York"</p>
                </div>
              )}

              {messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    'flex',
                    message.role === 'user' ? 'justify-end' : 'justify-start'
                  )}
                >
                  <div
                    className={cn(
                      'max-w-[80%] rounded-lg px-4 py-2',
                      message.role === 'user'
                        ? 'bg-[#3ECFA0] text-black'
                        : 'bg-zinc-800 text-white'
                    )}
                  >
                    <div className="text-sm whitespace-pre-wrap break-words">
                      {message.content}
                    </div>
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-zinc-800 text-white rounded-lg px-4 py-2">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce" />
                      <div className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                      <div className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce [animation-delay:0.4s]" />
                    </div>
                  </div>
                </div>
              )}

              {error && (
                <div className="bg-red-900/20 border border-red-900/50 text-red-400 rounded-lg px-4 py-2 text-sm">
                  {error.message || 'An error occurred. Please try again.'}
                </div>
              )}
            </div>

            {/* Input form */}
            <form onSubmit={handleSubmit} className="p-4 border-t border-zinc-800">
              <div className="flex gap-2">
                <input
                  value={input}
                  onChange={handleInputChange}
                  placeholder="Ask about deals, contacts, or properties..."
                  disabled={isLoading}
                  className={cn(
                    'flex-1 px-4 py-2 rounded-lg',
                    'bg-zinc-800 border border-zinc-700',
                    'text-white placeholder-zinc-500',
                    'focus:outline-none focus:ring-2 focus:ring-[#3ECFA0] focus:border-transparent',
                    'disabled:opacity-50 disabled:cursor-not-allowed'
                  )}
                />
                <Button
                  type="submit"
                  disabled={isLoading || !input.trim()}
                  size="default"
                  className="px-4"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
