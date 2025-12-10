import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Link } from 'react-router-dom';

type Message = { role: "user" | "assistant"; content: string };

const MAX_MESSAGE_LENGTH = 2000;

export const ChatBot = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const { user, session } = useAuth();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const streamChat = async (userMessage: Message) => {
    if (!session?.access_token) {
      toast({
        title: "Authentication required",
        description: "Please sign in to use the chat.",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ messages: [...messages, userMessage] }),
        }
      );

      if (!response.ok) {
        if (response.status === 401) {
          toast({
            title: "Session expired",
            description: "Please sign in again.",
            variant: "destructive",
          });
          return;
        }
        if (response.status === 429) {
          toast({
            title: "Rate limit exceeded",
            description: "Please try again later.",
            variant: "destructive",
          });
          return;
        }
        if (response.status === 402) {
          toast({
            title: "Service unavailable",
            description: "Please try again later.",
            variant: "destructive",
          });
          return;
        }
        if (response.status === 400) {
          const errorData = await response.json();
          toast({
            title: "Invalid request",
            description: errorData.error || "Please check your message.",
            variant: "destructive",
          });
          return;
        }
        throw new Error('Failed to start stream');
      }

      if (!response.body) throw new Error('No response body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = '';
      let streamDone = false;
      let assistantContent = '';

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') {
            streamDone = true;
            break;
          }

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              assistantContent += content;
              setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last?.role === 'assistant') {
                  return prev.map((m, i) => 
                    i === prev.length - 1 ? { ...m, content: assistantContent } : m
                  );
                }
                return [...prev, { role: 'assistant', content: assistantContent }];
              });
            }
          } catch {
            textBuffer = line + '\n' + textBuffer;
            break;
          }
        }
      }
    } catch (error) {
      console.error('Chat error:', error);
      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = async () => {
    const trimmedInput = input.trim();
    if (!trimmedInput || isLoading) return;

    // Client-side validation
    if (trimmedInput.length > MAX_MESSAGE_LENGTH) {
      toast({
        title: "Message too long",
        description: `Maximum ${MAX_MESSAGE_LENGTH} characters allowed.`,
        variant: "destructive",
      });
      return;
    }

    if (!user) {
      toast({
        title: "Sign in required",
        description: "Please sign in to use the chat.",
        variant: "destructive",
      });
      return;
    }

    const userMessage: Message = { role: 'user', content: trimmedInput };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    await streamChat(userMessage);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Show sign-in prompt if not authenticated
  if (!user) {
    return (
      <div className="flex flex-col h-full bg-background items-center justify-center p-8">
        <div className="text-center space-y-4">
          <h2 className="text-xl font-semibold text-foreground">AI Assistant</h2>
          <p className="text-muted-foreground">Sign in to chat with our AI assistant about bookings and grooming tips!</p>
          <Link to="/auth">
            <Button className="mt-4">Sign In to Chat</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="p-4 border-b border-border">
        <h2 className="text-xl font-semibold text-foreground">AI Assistant</h2>
        <p className="text-sm text-muted-foreground">Ask me anything about bookings or grooming!</p>
      </div>

      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        <div className="space-y-4">
          {messages.length === 0 && (
            <div className="text-center text-muted-foreground py-8">
              <p>Start a conversation with your AI assistant!</p>
            </div>
          )}
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-lg px-4 py-2 ${
                  msg.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-foreground'
                }`}
              >
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
              </div>
            </div>
          ))}
          {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
            <div className="flex justify-start">
              <div className="bg-muted rounded-lg px-4 py-2">
                <div className="flex space-x-2">
                  <div className="w-2 h-2 bg-foreground rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-foreground rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-2 h-2 bg-foreground rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="p-4 border-t border-border">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value.slice(0, MAX_MESSAGE_LENGTH))}
            onKeyPress={handleKeyPress}
            placeholder="Type your message..."
            disabled={isLoading}
            className="flex-1"
            maxLength={MAX_MESSAGE_LENGTH}
          />
          <Button onClick={handleSend} disabled={!input.trim() || isLoading}>
            <span className="material-symbols-outlined">send</span>
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-1 text-right">
          {input.length}/{MAX_MESSAGE_LENGTH}
        </p>
      </div>
    </div>
  );
};
