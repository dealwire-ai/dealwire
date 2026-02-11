'use client';

import { useChat } from 'ai/react';
import { useState } from 'react';
import { X, Send, MessageCircle, Bot, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import posthog from 'posthog-js';

export function Chatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const { messages, input, handleInputChange, handleSubmit, isLoading, error } = useChat({
    api: '/api/chat',
  });

  const handleOpen = () => {
    posthog.capture('chat_opened');
    setIsOpen(true);
  };

  const handleClose = () => {
    posthog.capture('chat_closed', { messages_count: messages.length });
    setIsOpen(false);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    posthog.capture('chat_message_sent', { message_length: input.length });
    handleSubmit(e);
  };

  return (
    <>
      {/* Floating button */}
      <button
        onClick={handleOpen}
        className={cn(
          'fixed bottom-6 right-6 z-50',
          'h-14 w-14 rounded-full',
          'bg-[#3ECFA0] hover:bg-[#35b88f] text-black',
          'shadow-lg hover:shadow-xl hover:scale-105',
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
        <div className="fixed inset-0 z-50 flex items-end justify-end pointer-events-none animate-in fade-in duration-200">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={handleClose}
          />

          {/* Chat window */}
          <Card className="relative w-full max-w-md h-[600px] dark:bg-zinc-900 dark:border-zinc-800 rounded-t-lg shadow-2xl flex flex-col pointer-events-auto animate-in slide-in-from-bottom-4 duration-300">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-zinc-800">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-[#3ECFA0] flex items-center justify-center">
                  <Bot className="h-4 w-4 text-black" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">Chat Assistant</h2>
                  <p className="text-xs text-zinc-400">Ask about your deals</p>
                </div>
              </div>
              <button
                onClick={handleClose}
                className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
                aria-label="Close chat"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 px-4">
              <div className="py-4 space-y-4">
                {messages.length === 0 && (
                  <div className="text-center text-zinc-400 py-12">
                    <div className="h-16 w-16 mx-auto mb-4 rounded-full bg-zinc-800 flex items-center justify-center">
                      <MessageCircle className="h-8 w-8 opacity-50" />
                    </div>
                    <p className="text-sm font-medium mb-1">Ask me anything</p>
                    <p className="text-xs text-zinc-500">Try: "Who sent me the most deals?"</p>
                  </div>
                )}

                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={cn(
                      'flex gap-3',
                      message.role === 'user' ? 'justify-end' : 'justify-start'
                    )}
                  >
                    {message.role === 'assistant' && (
                      <Avatar className="h-8 w-8 shrink-0">
                        <AvatarFallback className="bg-zinc-800 text-zinc-400">
                          <Bot className="h-4 w-4" />
                        </AvatarFallback>
                      </Avatar>
                    )}
                    <div
                      className={cn(
                        'max-w-[75%] rounded-lg px-4 py-2.5',
                        message.role === 'user'
                          ? 'bg-[#3ECFA0] text-black'
                          : 'bg-zinc-800 text-white'
                      )}
                    >
                      <div className="text-sm whitespace-pre-wrap break-words leading-relaxed">
                        {message.content}
                      </div>
                    </div>
                    {message.role === 'user' && (
                      <Avatar className="h-8 w-8 shrink-0">
                        <AvatarFallback className="bg-[#3ECFA0] text-black">
                          <User className="h-4 w-4" />
                        </AvatarFallback>
                      </Avatar>
                    )}
                  </div>
                ))}

                {isLoading && (
                  <div className="flex gap-3 justify-start">
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarFallback className="bg-zinc-800 text-zinc-400">
                        <Bot className="h-4 w-4" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="bg-zinc-800 text-white rounded-lg px-4 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" />
                        <div className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                        <div className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce [animation-delay:0.4s]" />
                      </div>
                    </div>
                  </div>
                )}

                {error && (
                  <div className="bg-red-900/20 border border-red-900/50 text-red-400 rounded-lg px-4 py-2.5 text-sm">
                    {error.message || 'An error occurred. Please try again.'}
                  </div>
                )}
              </div>
            </ScrollArea>

            {/* Input form */}
            <form onSubmit={handleFormSubmit} className="p-4 border-t border-zinc-800">
              <div className="flex gap-2">
                <Input
                  value={input}
                  onChange={handleInputChange}
                  placeholder="Ask about deals, contacts, or properties..."
                  disabled={isLoading}
                  className="dark:bg-zinc-800 dark:border-zinc-700 dark:text-white dark:placeholder:text-zinc-500 dark:focus-visible:ring-[#3ECFA0]"
                />
                <Button
                  type="submit"
                  disabled={isLoading || !input.trim()}
                  size="default"
                  className="shrink-0"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </>
  );
}
