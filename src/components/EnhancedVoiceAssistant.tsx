import { useState, useEffect, useRef } from "react";
import { Mic, MicOff, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
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
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [textInput, setTextInput] = useState("");
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

  // Load available voices for young female voice selection
  useEffect(() => {
    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      setAvailableVoices(voices);
      console.log('Available voices:', voices.map(v => `${v.name} (${v.lang})`));
    };
    
    // Voices load asynchronously in some browsers
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
    
    loadVoices();
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
      console.log('Invoking voice-ai-assistant with:', { transcript, user_id: user?.id });
      
      // Call Lovable AI edge function
      const { data, error } = await supabase.functions.invoke('voice-ai-assistant', {
        body: { 
          transcript,
          user_id: user?.id
        }
      });

      console.log('Edge function response:', { data, error });

      if (error) {
        console.error('Edge function error:', error);
        throw new Error(error.message || 'Failed to process voice command');
      }

      if (!data || !data.text) {
        console.error('Invalid response from edge function:', data);
        throw new Error('Invalid response from AI assistant');
      }

      // Add AI response to conversation
      const assistantMessage: Message = { 
        role: 'assistant', 
        text: data.text,
        action: data.action,
        data: data.data
      };
      
      setConversation(prev => [...prev, assistantMessage]);

      // Speak response with young female voice
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
      const errorMessage = error.message || 'Sorry, I encountered an error processing your request. Please try again.';
      
      setConversation(prev => [...prev, { role: 'assistant', text: errorMessage }]);
      speak(errorMessage);
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const speak = (text: string) => {
    const utterance = new SpeechSynthesisUtterance(text);
    
    // Young female voice settings
    utterance.pitch = 1.3;  // Higher pitch for young girl voice
    utterance.rate = 1.1;   // Slightly faster speech
    utterance.volume = 0.8;
    
    // Find and select a young female voice
    if (availableVoices.length > 0) {
      // Priority order for voice selection
      const femaleVoice = availableVoices.find(voice => 
        voice.name.toLowerCase().includes('samantha') ||
        voice.name.toLowerCase().includes('victoria') ||
        voice.name.toLowerCase().includes('karen') ||
        voice.name.toLowerCase().includes('google us english') && voice.name.toLowerCase().includes('female') ||
        voice.name.toLowerCase().includes('zira') ||
        voice.name.toLowerCase().includes('female')
      ) || availableVoices.find(voice => 
        voice.lang.startsWith('en') && voice.name.toLowerCase().includes('female')
      );
      
      if (femaleVoice) {
        console.log('Using voice:', femaleVoice.name);
        utterance.voice = femaleVoice;
      } else {
        console.log('Using default voice, female voice not found');
      }
    }
    
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

  const handleTextSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    
    if (!textInput.trim() || isProcessing) return;
    
    const message = textInput.trim();
    setTextInput("");
    await handleCommand(message);
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Chat Messages Area */}
      <Card className="flex-1 bg-card border-border overflow-hidden flex flex-col">
        <CardContent className="p-0 flex-1 flex flex-col">
          {conversation.length > 0 ? (
            <ScrollArea className="flex-1" ref={scrollRef}>
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
                      <span className="text-sm">HuMi is thinking...</span>
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          ) : (
            <div className="flex-1 flex items-center justify-center p-6">
              <div className="text-center space-y-2">
                <p className="text-sm text-muted-foreground">
                  Start a conversation with HuMi! Use voice or type your message.
                </p>
                <p className="text-xs text-muted-foreground">
                  Try: "What's my balance?" or "Show me EUR/USD analysis"
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Input Area */}
      <Card className="bg-card border-border">
        <CardContent className="p-4">
          <form onSubmit={handleTextSubmit} className="flex items-center gap-2">
            {/* Voice Button */}
            <Button
              type="button"
              onClick={toggleListening}
              variant={isListening ? "destructive" : "outline"}
              size="icon"
              className="rounded-full h-10 w-10 flex-shrink-0"
              title="Voice Input"
              disabled={isProcessing}
            >
              {isListening ? (
                <MicOff className="h-5 w-5 animate-pulse" />
              ) : (
                <Mic className="h-5 w-5" />
              )}
            </Button>

            {/* Text Input */}
            <Input
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="Type a message or use voice..."
              className="flex-1"
              disabled={isProcessing || isListening}
            />

            {/* Send Button */}
            <Button
              type="submit"
              size="icon"
              className="rounded-full h-10 w-10 flex-shrink-0"
              disabled={!textInput.trim() || isProcessing || isListening}
            >
              <Send className="h-5 w-5" />
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
