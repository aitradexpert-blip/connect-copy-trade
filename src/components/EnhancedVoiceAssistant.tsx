import { useState, useEffect, useRef } from "react";
import { Mic, MicOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface Message {
  role: 'user' | 'assistant';
  text: string;
  action?: any;
  data?: any;
}

export default function EnhancedVoiceAssistant() {
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [recognition, setRecognition] = useState<any>(null);
  const [conversation, setConversation] = useState<Message[]>([]);
  const { toast } = useToast();
  const { user } = useAuth();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Check if browser supports Web Speech API
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      console.warn('Web Speech API not supported');
      return;
    }

    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    const recognitionInstance = new SpeechRecognition();
    
    recognitionInstance.continuous = false;
    recognitionInstance.interimResults = false;
    recognitionInstance.lang = 'en-US';

    recognitionInstance.onresult = async (event: any) => {
      const transcript = event.results[0][0].transcript;
      console.log('Voice command:', transcript);
      
      await handleCommand(transcript);
    };

    recognitionInstance.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
      
      if (event.error === 'not-allowed') {
        toast({
          title: "Microphone Access Denied",
          description: "Please allow microphone access to use voice commands.",
          variant: "destructive",
        });
      }
    };

    recognitionInstance.onend = () => {
      setIsListening(false);
    };

    setRecognition(recognitionInstance);

    return () => {
      if (recognitionInstance) {
        recognitionInstance.stop();
      }
    };
  }, []);

  useEffect(() => {
    // Auto-scroll to bottom when new messages arrive
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [conversation]);

  const handleCommand = async (transcript: string) => {
    // Add user message to conversation
    setConversation(prev => [...prev, { role: 'user', text: transcript }]);
    setIsProcessing(true);

    try {
      // Call Lovable AI edge function
      const { data, error } = await supabase.functions.invoke('voice-ai-assistant', {
        body: { 
          transcript,
          user_id: user?.id
        }
      });

      if (error) throw error;

      // Add AI response to conversation
      const assistantMessage: Message = { 
        role: 'assistant', 
        text: data.text,
        action: data.action,
        data: data.data
      };
      
      setConversation(prev => [...prev, assistantMessage]);

      // Speak response
      speak(data.text);

      // Execute action if present
      if (data.action?.type === 'prepare_execution') {
        toast({
          title: "Trade Prepared",
          description: "Review the trade details and click Execute to confirm",
        });
        // Note: The actual modal opening would be handled by parent component
      }
    } catch (error: any) {
      console.error('Command handling error:', error);
      const errorMessage = 'Sorry, I encountered an error processing your request.';
      setConversation(prev => [...prev, { role: 'assistant', text: errorMessage }]);
      speak(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  const speak = (text: string) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    window.speechSynthesis.speak(utterance);
  };

  const toggleListening = () => {
    if (!recognition) {
      toast({
        title: "Not Supported",
        description: "Voice commands are not supported in this browser.",
        variant: "destructive",
      });
      return;
    }

    if (isListening) {
      recognition.stop();
      setIsListening(false);
    } else {
      recognition.start();
      setIsListening(true);
      toast({
        title: "Listening...",
        description: "Speak your command now",
      });
    }
  };

  return (
    <div className="space-y-4">
      {/* Mic Button with Animation */}
      <div className="flex justify-center">
        <div className="relative">
          <Button
            onClick={toggleListening}
            variant={isListening ? "destructive" : "default"}
            size="icon"
            className="rounded-full h-16 w-16 shadow-lg relative overflow-hidden"
            title="Voice Assistant"
          >
            {isListening ? (
              <>
                <MicOff className="h-7 w-7 animate-pulse relative z-10" />
                <div className="absolute inset-0 bg-destructive animate-ping opacity-75" />
              </>
            ) : (
              <Mic className="h-7 w-7" />
            )}
          </Button>
        </div>
      </div>

      {/* Conversation Display */}
      {conversation.length > 0 && (
        <Card className="bg-card border-border">
          <CardContent className="p-0">
            <ScrollArea className="h-96" ref={scrollRef}>
              <div className="space-y-4 p-4">
                {conversation.map((msg, idx) => (
                  <div 
                    key={idx} 
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-[80%] rounded-lg p-3 ${
                      msg.role === 'user' 
                        ? 'bg-primary text-primary-foreground' 
                        : 'bg-muted'
                    }`}>
                      <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
                      
                      {/* Display signal data if present */}
                      {msg.data?.signals && msg.data.signals.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-border/50 space-y-1">
                          {msg.data.signals.slice(0, 3).map((signal: any) => (
                            <div key={signal.id} className="text-xs opacity-90">
                              <span className="font-medium">{signal.symbol}</span> {signal.direction} @ {signal.lot_size} lots
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                
                {isProcessing && (
                  <div className="flex justify-start">
                    <div className="bg-muted rounded-lg p-3 flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm">Processing...</span>
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {conversation.length === 0 && (
        <Card className="bg-accent/50 border-border">
          <CardContent className="pt-6 text-center">
            <p className="text-sm text-muted-foreground">
              Click the microphone and ask about your balance, positions, or signals
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
