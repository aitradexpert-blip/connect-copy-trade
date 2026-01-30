import { useState, useEffect, useRef } from "react";
import { Mic, MicOff, Loader2, Send, Wallet, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";

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

interface TradingAccountSummary {
  id: string;
  name: string;
  broker_name?: string;
  balance: number;
  is_virtual?: boolean;
  connection_type?: string;
}

export default function EnhancedVoiceAssistant() {
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [recognition, setRecognition] = useState<any>(null);
  const [conversation, setConversation] = useState<Message[]>([]);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [textInput, setTextInput] = useState("");
  const [pendingConfirmation, setPendingConfirmation] = useState<any>(null);
  const [accountsSummary, setAccountsSummary] = useState<TradingAccountSummary[]>([]);
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
  const navigate = useNavigate();

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
    };
    
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
    loadVoices();
  }, []);

  // Load accounts summary
  useEffect(() => {
    if (!user) return;
    
    const loadAccounts = async () => {
      const { data } = await supabase
        .from('trading_accounts')
        .select('id, name, broker_name, balance, is_virtual, connection_type')
        .eq('user_id', user.id)
        .eq('connection_status', 'connected');
      
      if (data) {
        setAccountsSummary(data);
      }
    };
    
    loadAccounts();
  }, [user]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [conversation]);

  const handleCommand = async (transcript: string) => {
    setConversation(prev => [...prev, { role: 'user', text: transcript }]);
    setIsProcessing(true);

    try {
      const { data, error } = await supabase.functions.invoke('voice-ai-assistant', {
        body: { 
          transcript,
          user_id: user?.id
        }
      });

      if (data?.error) {
        const errorMessage = data.text || "I'm having trouble right now. Please try again in a moment.";
        setConversation(prev => [...prev, { role: 'assistant', text: errorMessage }]);
        speak(errorMessage);
        setIsProcessing(false);
        return;
      }

      if (!data || !data.text) {
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
      } else if (data.action?.type === 'trade_executed') {
        setPendingConfirmation(null);
        toast({
          title: "Trade Executed!",
          description: data.text,
        });
      } else if (data.action?.type === 'prepare_execution') {
        setPendingConfirmation(null);
        toast({
          title: "Trade Prepared",
          description: "Review the trade details and click Execute to confirm",
        });
      } else if (data.action?.type === 'navigate') {
        setTimeout(() => {
          navigate(data.action.path);
        }, 1500);
      }

      // Update accounts if returned
      if (data.data?.accounts) {
        setAccountsSummary(data.data.accounts.slice(0, 5));
      }
    } catch (error: any) {
      console.error('Command handling error:', error);
      const errorMessage = 'Sorry, I encountered an error. Please try again.';
      setConversation(prev => [...prev, { role: 'assistant', text: errorMessage }]);
      speak(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  const speak = (text: string) => {
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
    
    let selectedVoice = null;

    if (voicePreference.name) {
      selectedVoice = availableVoices.find(v => v.name === voicePreference.name);
    }
    
    if (!selectedVoice && voicePreference.type === 'female') {
      const femaleVoices = availableVoices.filter(voice => 
        voice.name.toLowerCase().includes('samantha') ||
        voice.name.toLowerCase().includes('victoria') ||
        voice.name.toLowerCase().includes('karen') ||
        voice.name.toLowerCase().includes('zira') ||
        voice.name.toLowerCase().includes('tessa')
      );
      selectedVoice = femaleVoices[0];
    } else if (!selectedVoice && voicePreference.type === 'male') {
      const maleVoices = availableVoices.filter(voice =>
        voice.name.toLowerCase().includes('alex') ||
        voice.name.toLowerCase().includes('daniel')
      );
      selectedVoice = maleVoices[0];
    }

    if (!selectedVoice) {
      selectedVoice = availableVoices.find(v => v.lang.startsWith('en'));
    }

    if (selectedVoice) {
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

  const totalBalance = accountsSummary.reduce((sum, acc) => sum + (acc.balance || 0), 0);

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Account Summary Header */}
      {accountsSummary.length > 0 && (
        <div className="flex items-center gap-2 px-2">
          <Wallet className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            {accountsSummary.length} account{accountsSummary.length > 1 ? 's' : ''} • ${totalBalance.toFixed(2)}
          </span>
          {pendingConfirmation && (
            <Badge variant="secondary" className="ml-auto animate-pulse">
              Awaiting confirmation
            </Badge>
          )}
        </div>
      )}

      <Card className="flex-1 bg-card border-border overflow-hidden flex flex-col">
        <CardContent className="p-4 border-b">
          <div className="space-y-1">
            <h3 className="text-lg font-semibold">Khumo — The Market's Memory</h3>
            <p className="text-sm text-muted-foreground">
              I can check balances, execute trades, show positions, and navigate the platform. Try "What's my balance?" or "Buy EUR/USD".
            </p>
            {pendingConfirmation && (
              <div className="mt-2 p-2 bg-primary/10 rounded text-xs text-primary font-medium flex items-center gap-2">
                <RefreshCw className="h-3 w-3 animate-spin" />
                Pending: {pendingConfirmation.direction} {pendingConfirmation.lot_size || 0.01} {pendingConfirmation.symbol}
                {pendingConfirmation.account?.broker_name && ` on ${pendingConfirmation.account.broker_name}`}
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
                    <div className={`max-w-[85%] rounded-lg p-3 ${
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
                              onClick={() => navigate(link.path)}
                              className="text-xs"
                            >
                              {link.label}
                            </Button>
                          ))}
                        </div>
                      )}

                      {msg.data?.positions && msg.data.positions.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-border/50 space-y-1">
                          <p className="text-xs font-medium mb-1">Open Positions:</p>
                          {msg.data.positions.slice(0, 3).map((pos: any, i: number) => (
                            <div key={i} className="text-xs opacity-90">
                              {pos.type || pos.direction} {pos.volume || 1} {pos.symbol || pos.display_name}
                              {pos.profit !== undefined && (
                                <span className={pos.profit >= 0 ? 'text-profit' : 'text-loss'}>
                                  {' '}({pos.profit >= 0 ? '+' : ''}{pos.profit?.toFixed(2)})
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {msg.data?.history && msg.data.history.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-border/50 space-y-1">
                          <p className="text-xs font-medium mb-1">Recent History:</p>
                          {msg.data.history.slice(0, 3).map((h: any, i: number) => (
                            <div key={i} className="text-xs opacity-90">
                              {h.direction} {h.volume} {h.symbol}
                              {h.profit_loss !== undefined && (
                                <span className={h.profit_loss >= 0 ? 'text-profit' : 'text-loss'}>
                                  {' '}({h.profit_loss >= 0 ? '+' : ''}${h.profit_loss?.toFixed(2)})
                                </span>
                              )}
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
                  Your AI trading assistant. I can help you trade, check balances, view positions, and more.
                </p>
                <div className="flex flex-wrap gap-2 justify-center mt-4">
                  <Badge variant="outline" className="text-xs cursor-pointer hover:bg-accent" onClick={() => handleCommand("What's my balance?")}>
                    Check balance
                  </Badge>
                  <Badge variant="outline" className="text-xs cursor-pointer hover:bg-accent" onClick={() => handleCommand("List my accounts")}>
                    My accounts
                  </Badge>
                  <Badge variant="outline" className="text-xs cursor-pointer hover:bg-accent" onClick={() => handleCommand("Show open positions")}>
                    Positions
                  </Badge>
                </div>
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
              placeholder="Ask about balance, positions, or say 'Buy EUR/USD'..."
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
