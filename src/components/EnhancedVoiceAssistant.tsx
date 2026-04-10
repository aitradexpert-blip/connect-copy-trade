import { useState, useEffect, useRef } from "react";
import { Mic, MicOff, Loader2, Send, Wallet, RefreshCw, Volume2 } from "lucide-react";
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
  links?: Array<{ label: string; path: string; description?: string; }>;
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
  const [textInput, setTextInput] = useState("");
  const [pendingConfirmation, setPendingConfirmation] = useState<any>(null);
  const [accountsSummary, setAccountsSummary] = useState<TradingAccountSummary[]>([]);
  const [voicePreference, setVoicePreference] = useState<{voiceId: string; gender: string}>({
    voiceId: 'EXAVITQu4vr4xnSDxMaL',
    gender: 'female'
  });
  const { toast } = useToast();
  const { user } = useAuth();
  const scrollRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Load voice preference
  useEffect(() => {
    const loadVoicePref = async () => {
      if (!user) return;
      try {
        const { data } = await supabase
          .from('user_settings')
          .select('voice_preference')
          .eq('user_id', user.id)
          .maybeSingle();
        if (data?.voice_preference) {
          const pref = data.voice_preference as any;
          setVoicePreference({
            voiceId: pref.voiceId || 'EXAVITQu4vr4xnSDxMaL',
            gender: pref.gender || 'female'
          });
        }
      } catch (e) {
        console.error('Failed to load voice preference:', e);
      }
      // Also try localStorage fallback
      const saved = localStorage.getItem('voice_preferences');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed.voiceId) setVoicePreference(parsed);
        } catch (e) {}
      }
    };
    loadVoicePref();
  }, [user]);

  // Setup speech recognition - transcribes to input box
  useEffect(() => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) return;

    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    const recognitionInstance = new SpeechRecognition();
    recognitionInstance.continuous = false;
    recognitionInstance.interimResults = true;
    recognitionInstance.lang = 'en-US';

    recognitionInstance.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      // Fill the input box instead of auto-sending
      setTextInput(transcript);
      if (event.results[0].isFinal) {
        setIsListening(false);
      }
    };

    recognitionInstance.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
      if (event.error === 'not-allowed') {
        toast({ title: "Microphone Access Denied", description: "Please allow microphone access.", variant: "destructive" });
      }
    };

    recognitionInstance.onend = () => setIsListening(false);
    setRecognition(recognitionInstance);

    return () => { if (recognitionInstance) recognitionInstance.stop(); };
  }, []);

  // Load accounts
  useEffect(() => {
    if (!user) return;
    const loadAccounts = async () => {
      const { data } = await supabase
        .from('trading_accounts')
        .select('id, name, broker_name, balance, is_virtual, connection_type')
        .eq('user_id', user.id)
        .eq('connection_status', 'connected');
      if (data) setAccountsSummary(data);
    };
    loadAccounts();
  }, [user]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [conversation]);

  // Load chat history on mount
  useEffect(() => {
    if (!user) return;
    const loadHistory = async () => {
      const { data } = await supabase
        .from('chat_history')
        .select('role, content')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);
      if (data && data.length > 0) {
        setConversation(data.reverse().map(m => ({ role: m.role as 'user' | 'assistant', text: m.content })));
      }
    };
    loadHistory();
  }, [user]);

  const handleCommand = async (transcript: string) => {
    setConversation(prev => [...prev, { role: 'user', text: transcript }]);
    setIsProcessing(true);

    try {
      const { data, error } = await supabase.functions.invoke('voice-ai-assistant', {
        body: { transcript, user_id: user?.id }
      });

      if (data?.error) {
        const errorMessage = data.text || "I'm having trouble right now. Please try again.";
        setConversation(prev => [...prev, { role: 'assistant', text: errorMessage }]);
        speak(errorMessage);
        setIsProcessing(false);
        return;
      }

      if (!data || !data.text) throw new Error('Invalid response');

      const assistantMessage: Message = {
        role: 'assistant', text: data.text, action: data.action, data: data.data, links: data.links
      };
      setConversation(prev => [...prev, assistantMessage]);

      // Save to chat history
      if (user) {
        await supabase.from('chat_history').insert([
          { user_id: user.id, role: 'user', content: transcript },
          { user_id: user.id, role: 'assistant', content: data.text }
        ]);
      }

      const cleanText = data.text.replace(/[\u{1F600}-\u{1F64F}]/gu, '').replace(/[\u{1F300}-\u{1F5FF}]/gu, '').replace(/[\u{1F680}-\u{1F6FF}]/gu, '').replace(/[\u{2600}-\u{26FF}]/gu, '').replace(/[\u{2700}-\u{27BF}]/gu, '').replace(/\*/g, '').replace(/#/g, '').replace(/\[.*?\]/g, '').trim();
      speak(cleanText);

      // Handle actions
      if (data.action?.type === 'request_confirmation') {
        setPendingConfirmation(data.action.trade);
      } else if (data.action?.type === 'trade_executed') {
        setPendingConfirmation(null);
        toast({ title: "Trade Executed!", description: data.text });
      }
      // Don't auto-navigate — links are shown inline in the chat instead

      if (data.data?.accounts) setAccountsSummary(data.data.accounts.slice(0, 5));
    } catch (error: any) {
      console.error('Command handling error:', error);
      const errorMessage = 'Sorry, I encountered an error. Please try again.';
      setConversation(prev => [...prev, { role: 'assistant', text: errorMessage }]);
      speak(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  // ElevenLabs TTS only — no browser fallback to avoid dual voices
  const speak = async (text: string) => {
    window.speechSynthesis.cancel();
    const cleanedText = text.replace(/\*/g, '').replace(/#/g, '').replace(/\[.*?\]/g, '').replace(/\(.*?\)/g, '').trim();

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-tts`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ text: cleanedText, voiceId: voicePreference.voiceId }),
        }
      );

      const contentType = response.headers.get('content-type');
      if (contentType?.includes('audio')) {
        const audioBlob = await response.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        audio.play();
      }
      // If ElevenLabs fails or returns fallback, silently skip — no browser TTS
    } catch (error) {
      console.warn('ElevenLabs TTS failed:', error);
      // No browser fallback — avoids dual voice issue
    }
  };

  const browserSpeak = (text: string) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.1;
    utterance.volume = 0.8;
    const voices = window.speechSynthesis.getVoices();
    const englishVoice = voices.find(v => v.lang.startsWith('en'));
    if (englishVoice) utterance.voice = englishVoice;
    window.speechSynthesis.speak(utterance);
  };

  const toggleListening = () => {
    if (!recognition) {
      toast({ title: "Not Supported", description: "Voice commands not supported in this browser.", variant: "destructive" });
      return;
    }
    if (isListening) {
      recognition.stop();
      setIsListening(false);
    } else {
      recognition.start();
      setIsListening(true);
      toast({ title: "Listening...", description: "Speak now — text will appear in the input box" });
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
    <div className="flex flex-col space-y-3" style={{ maxHeight: '480px' }}>
      {accountsSummary.length > 0 && (
        <div className="flex items-center gap-2 px-2">
          <Wallet className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            {accountsSummary.length} account{accountsSummary.length > 1 ? 's' : ''} • ${totalBalance.toFixed(2)}
          </span>
          {pendingConfirmation && (
            <Badge variant="secondary" className="ml-auto animate-pulse">Awaiting confirmation</Badge>
          )}
        </div>
      )}

      <Card className="flex-1 bg-card border-border overflow-hidden flex flex-col" style={{ maxHeight: '320px' }}>
        <CardContent className="p-4 border-b">
          <div className="space-y-1">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              Khumo — The Market's Memory
              <Volume2 className="h-4 w-4 text-primary" />
            </h3>
            <p className="text-sm text-muted-foreground">
              Powered by ElevenLabs voice • Ask about balance, trades, strategies
            </p>
            {pendingConfirmation && (
              <div className="mt-2 p-2 bg-primary/10 rounded text-xs text-primary font-medium flex items-center gap-2">
                <RefreshCw className="h-3 w-3 animate-spin" />
                Pending: {pendingConfirmation.direction} {pendingConfirmation.lot_size || 0.01} {pendingConfirmation.symbol}
              </div>
            )}
          </div>
        </CardContent>
        
        <CardContent className="p-0 flex-1 flex flex-col">
          {conversation.length > 0 ? (
            <ScrollArea className="flex-1" ref={scrollRef}>
              <div className="space-y-4 p-4">
                {conversation.map((msg, idx) => (
                  <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] rounded-lg p-3 ${msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                      <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
                      {msg.links && msg.links.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {msg.links.map((link: any, i: number) => (
                            <Button key={i} variant="outline" size="sm" onClick={() => navigate(link.path)} className="text-xs">{link.label}</Button>
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
                <p className="text-xs text-muted-foreground">Your AI trading assistant with South African voice</p>
                <div className="flex flex-wrap gap-2 justify-center mt-4">
                  <Badge variant="outline" className="text-xs cursor-pointer hover:bg-accent" onClick={() => handleCommand("What's my balance?")}>Check balance</Badge>
                  <Badge variant="outline" className="text-xs cursor-pointer hover:bg-accent" onClick={() => handleCommand("List my accounts")}>My accounts</Badge>
                  <Badge variant="outline" className="text-xs cursor-pointer hover:bg-accent" onClick={() => handleCommand("Show open positions")}>Positions</Badge>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardContent className="p-4">
          <form onSubmit={handleTextSubmit} className="flex items-center gap-2">
            <Button type="button" onClick={toggleListening} variant={isListening ? "destructive" : "outline"} size="icon" className={`rounded-full h-10 w-10 flex-shrink-0 ${isListening ? 'animate-pulse' : ''}`} disabled={isProcessing}>
              {isListening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            </Button>
            <Input value={textInput} onChange={(e) => setTextInput(e.target.value)} placeholder={isListening ? "Listening... speak now" : "Ask Khumo anything..."} className="flex-1" disabled={isProcessing} />
            <Button type="submit" size="icon" className="rounded-full h-10 w-10 flex-shrink-0" disabled={!textInput.trim() || isProcessing}>
              <Send className="h-5 w-5" />
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
