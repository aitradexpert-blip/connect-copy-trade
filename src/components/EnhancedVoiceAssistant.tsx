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
  links?: Array<{
    label: string;
    path: string;
    description?: string;
  }>;
}

export default function EnhancedVoiceAssistant() {
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [recognition, setRecognition] = useState<any>(null);
  const [conversation, setConversation] = useState<Message[]>([]);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [textInput, setTextInput] = useState("");
  const [pendingConfirmation, setPendingConfirmation] = useState<any>(null);
  const [voicePreference, setVoicePreference] = useState({
    type: 'female',
    name: '',
    rate: 1.1,
    pitch: 1.3,
    volume: 0.8
  });
  const { toast } = useToast();
  const { user } = useAuth();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
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
    // Load voice preferences from localStorage
    const savedPrefs = localStorage.getItem('voice_preferences');
    if (savedPrefs) {
      try {
        setVoicePreference(JSON.parse(savedPrefs));
      } catch (e) {
        console.error('Failed to load voice preferences:', e);
      }
    }

    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      setAvailableVoices(voices);
      console.log('Available voices:', voices.map(v => `${v.name} (${v.lang})`));
    };
    
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
    
    loadVoices();
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [conversation]);

  const handleCommand = async (transcript: string) => {
    setConversation(prev => [...prev, { role: 'user', text: transcript }]);
    setIsProcessing(true);

    try {
      console.log('Invoking voice-ai-assistant with:', { transcript, user_id: user?.id });
      
      const { data, error } = await supabase.functions.invoke('voice-ai-assistant', {
        body: { 
          transcript,
          user_id: user?.id
        }
      });

      console.log('Edge function response:', { data, error });

      // Handle structured errors (server returns 200 with error field)
      if (data?.error) {
        const errorMessage = data.text || "I'm having trouble right now. Please try again in a moment.";
        setConversation(prev => [...prev, {
          role: 'assistant',
          text: errorMessage
        }]);
        speak(errorMessage);
        toast({
          title: "Temporary Issue",
          description: errorMessage,
          variant: "destructive",
        });
        setIsProcessing(false);
        return;
      }

      if (!data || !data.text) {
        console.error('Invalid response from edge function:', data);
        throw new Error('Invalid response from AI assistant');
      }

      const assistantMessage: Message = { 
        role: 'assistant', 
        text: data.text,
        action: data.action,
        data: data.data,
        links: data.links
      };
      
      setConversation(prev => [...prev, assistantMessage]);

      // Clean text for speech - remove emojis and markdown
      const cleanText = data.text
        .replace(/[\u{1F600}-\u{1F64F}]/gu, '')
        .replace(/[\u{1F300}-\u{1F5FF}]/gu, '')
        .replace(/[\u{1F680}-\u{1F6FF}]/gu, '')
        .replace(/[\u{2600}-\u{26FF}]/gu, '')
        .replace(/[\u{2700}-\u{27BF}]/gu, '')
        .replace(/\*/g, '')
        .replace(/#/g, '')
        .replace(/\[.*?\]/g, '')
        .trim();
      speak(cleanText);

      // Handle actions
      if (data.action?.type === 'request_confirmation') {
        setPendingConfirmation(data.action.trade);
      } else if (data.action?.type === 'prepare_execution') {
        setPendingConfirmation(null);
        toast({
          title: "Trade Prepared",
          description: "Review the trade details and click Execute to confirm",
        });
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
    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    const cleanedText = text
      .replace(/\*/g, '')
      .replace(/#/g, '')
      .replace(/\[.*?\]/g, '')
      .replace(/\(.*?\)/g, '')
      .trim();
    
    const utterance = new SpeechSynthesisUtterance(cleanedText);
    utterance.pitch = voicePreference.pitch;
    utterance.rate = voicePreference.rate;
    utterance.volume = voicePreference.volume;
    
    // Always select voice based on current preferences (consistent for both text and voice)
    let selectedVoice = null;

    // If custom voice name is set, use it
    if (voicePreference.name) {
      selectedVoice = availableVoices.find(v => v.name === voicePreference.name);
    }
    
    // Otherwise select by type preference
    if (!selectedVoice && voicePreference.type === 'female') {
      const femaleVoices = availableVoices.filter(voice => 
        voice.name.toLowerCase().includes('samantha') ||
        voice.name.toLowerCase().includes('victoria') ||
        voice.name.toLowerCase().includes('karen') ||
        voice.name.toLowerCase().includes('zira') ||
        voice.name.toLowerCase().includes('tessa') ||
        voice.name.toLowerCase().includes('allison') ||
        voice.name.toLowerCase().includes('joanna') ||
        voice.name.toLowerCase().includes('fiona') ||
        (voice.name.toLowerCase().includes('google') && voice.name.toLowerCase().includes('female'))
      );
      selectedVoice = femaleVoices[0];
    } else if (!selectedVoice && voicePreference.type === 'male') {
      const maleVoices = availableVoices.filter(voice =>
        voice.name.toLowerCase().includes('alex') ||
        voice.name.toLowerCase().includes('fred') ||
        voice.name.toLowerCase().includes('daniel') ||
        voice.name.toLowerCase().includes('diego') ||
        (voice.name.toLowerCase().includes('google') && voice.name.toLowerCase().includes('male'))
      );
      selectedVoice = maleVoices[0];
    }

    // Fallback to any English voice
    if (!selectedVoice) {
      selectedVoice = availableVoices.find(v => v.lang.startsWith('en'));
    }

    // Final fallback
    if (!selectedVoice && availableVoices.length > 0) {
      selectedVoice = availableVoices[0];
    }

    if (selectedVoice) {
      console.log('Using voice:', selectedVoice.name);
      utterance.voice = selectedVoice;
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
      <Card className="flex-1 bg-card border-border overflow-hidden flex flex-col">
        <CardContent className="p-4 border-b">
          <div className="space-y-1">
            <h3 className="text-lg font-semibold">Khumo — The Market's Memory</h3>
            <p className="text-sm text-muted-foreground">
              I study institutional footprints to help you understand WHY markets move. Ask about your balance, positions, trading concepts, or any trading pair.
            </p>
            {pendingConfirmation && (
              <div className="mt-2 p-2 bg-primary/10 rounded text-xs text-primary font-medium">
                Awaiting your confirmation for {pendingConfirmation.symbol} {pendingConfirmation.direction}
              </div>
            )}
          </div>
        </CardContent>
        
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
                      
                      {msg.links && msg.links.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {msg.links.map((link: any, linkIndex: number) => (
                            <Button
                              key={linkIndex}
                              variant="outline"
                              size="sm"
                              onClick={() => window.location.href = link.path}
                              className="text-xs"
                            >
                              {link.label}
                            </Button>
                          ))}
                        </div>
                      )}

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
                      <span className="text-sm">Khumo is researching...</span>
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          ) : (
            <div className="flex-1 flex items-center justify-center p-6">
              <div className="text-center space-y-2">
                <p className="text-sm font-medium">Welcome to Khumo</p>
                <p className="text-xs text-muted-foreground">
                  I help you understand market memory and institutional patterns. Ask about your balance, positions, trading concepts, or any symbol.
                </p>
                <p className="text-xs text-muted-foreground/70 mt-4">
                  Try: "What's my balance?", "Explain Fair Value Gaps", "Show me gold"
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardContent className="p-4">
          <form onSubmit={handleTextSubmit} className="flex items-center gap-2">
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

            <Input
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="Ask about market patterns, root causes, or your positions..."
              className="flex-1"
              disabled={isProcessing || isListening}
            />

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