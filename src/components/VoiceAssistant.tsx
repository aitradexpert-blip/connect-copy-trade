import { useState, useEffect } from "react";
import { Mic, MicOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface VoiceAssistantProps {
  onCommand?: (command: string) => void;
}

export default function VoiceAssistant({ onCommand }: VoiceAssistantProps) {
  const [isListening, setIsListening] = useState(false);
  const [recognition, setRecognition] = useState<any>(null);
  const { toast } = useToast();

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
      onCommand?.(transcript);
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

  const handleCommand = async (command: string) => {
    const lowerCommand = command.toLowerCase();

    try {
      // Balance query
      if (lowerCommand.includes('balance')) {
        const { data: accounts } = await supabase
          .from('trading_accounts')
          .select('balance')
          .eq('user_id', (await supabase.auth.getUser()).data.user?.id);
        
        if (accounts && accounts.length > 0) {
          const totalBalance = accounts.reduce((sum, acc) => sum + Number(acc.balance || 0), 0);
          speak(`Your total balance is ${totalBalance.toFixed(2)} dollars`);
        } else {
          speak('No trading accounts found');
        }
      }
      // Positions query
      else if (lowerCommand.includes('position') || lowerCommand.includes('trade')) {
        const { data: positions } = await supabase
          .from('trade_history')
          .select('symbol, direction, volume, status')
          .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
          .eq('status', 'open');
        
        if (positions && positions.length > 0) {
          const positionText = positions.map(p => 
            `${p.direction} ${p.volume} lots of ${p.symbol}`
          ).join(', ');
          speak(`You have ${positions.length} open positions: ${positionText}`);
        } else {
          speak('You have no open positions');
        }
      }
      // Signals query
      else if (lowerCommand.includes('signal')) {
        const { data: signals } = await supabase
          .from('trading_signals')
          .select('symbol, direction, lot_size')
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(3);
        
        if (signals && signals.length > 0) {
          const signalText = signals.map(s => 
            `${s.direction} ${s.symbol} at ${s.lot_size} lots`
          ).join(', ');
          speak(`Latest signals are: ${signalText}`);
        } else {
          speak('No active signals available');
        }
      }
      // Trading advice (blocked)
      else if (
        lowerCommand.includes('should i') || 
        lowerCommand.includes('recommend') || 
        lowerCommand.includes('suggest') ||
        lowerCommand.includes('buy') ||
        lowerCommand.includes('sell')
      ) {
        speak('I cannot provide trading advice. I can only help you navigate the platform and show your data.');
      }
      // Default
      else {
        speak('I can help you check your balance, view positions, or see the latest signals. What would you like to know?');
      }
    } catch (error) {
      console.error('Command handling error:', error);
      speak('Sorry, I encountered an error processing your request.');
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
    <Button
      onClick={toggleListening}
      variant={isListening ? "destructive" : "default"}
      size="icon"
      className="rounded-full h-14 w-14 shadow-lg"
      title="Voice Assistant"
    >
      {isListening ? (
        <MicOff className="h-6 w-6 animate-pulse" />
      ) : (
        <Mic className="h-6 w-6" />
      )}
    </Button>
  );
}
