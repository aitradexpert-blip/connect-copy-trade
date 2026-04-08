import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, Clock, TrendingUp, TrendingDown, Play, Copy, Bot, Lightbulb, RefreshCw, Globe } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ForexSession {
  name: string;
  city: string;
  openHour: number; // UTC
  closeHour: number; // UTC
  pairs: string[];
  color: string;
}

interface TradeSuggestion {
  symbol: string;
  direction: "BUY" | "SELL";
  entry: string;
  stopLoss: string;
  takeProfit: string;
  analysis: string;
  session: string;
  confidence: "High" | "Medium" | "Low";
}

interface KhumoForexSessionsProps {
  onPublishIdea?: (suggestion: TradeSuggestion) => void;
  onCopyTrade?: (suggestion: TradeSuggestion) => void;
  onAddToBot?: (suggestion: TradeSuggestion) => void;
  mentorId?: string;
  compact?: boolean;
}

const FOREX_SESSIONS: ForexSession[] = [
  {
    name: "Sydney",
    city: "Sydney",
    openHour: 21, // 21:00 UTC (previous day)
    closeHour: 6,  // 06:00 UTC
    pairs: ["AUDUSD", "AUDJPY", "NZDUSD", "AUDNZD", "EURAUD"],
    color: "bg-blue-500"
  },
  {
    name: "Tokyo",
    city: "Tokyo",
    openHour: 0,   // 00:00 UTC
    closeHour: 9,  // 09:00 UTC
    pairs: ["USDJPY", "EURJPY", "GBPJPY", "AUDJPY", "NZDJPY"],
    color: "bg-red-500"
  },
  {
    name: "London",
    city: "London",
    openHour: 7,   // 07:00 UTC
    closeHour: 16, // 16:00 UTC
    pairs: ["GBPUSD", "EURGBP", "GBPJPY", "EURUSD", "GBPCAD"],
    color: "bg-indigo-500"
  },
  {
    name: "New York",
    city: "New York",
    openHour: 12,  // 12:00 UTC
    closeHour: 21, // 21:00 UTC
    pairs: ["EURUSD", "GBPUSD", "USDCAD", "USDCHF", "XAUUSD"],
    color: "bg-green-500"
  }
];

function getCurrentUTCHour(): number {
  return new Date().getUTCHours();
}

function isSessionActive(session: ForexSession): boolean {
  const hour = getCurrentUTCHour();
  if (session.openHour > session.closeHour) {
    // Session spans midnight (like Sydney)
    return hour >= session.openHour || hour < session.closeHour;
  }
  return hour >= session.openHour && hour < session.closeHour;
}

function getActiveSessions(): ForexSession[] {
  return FOREX_SESSIONS.filter(isSessionActive);
}

function getSessionOverlaps(): string[] {
  const active = getActiveSessions();
  if (active.length >= 2) {
    return active.map(s => s.name);
  }
  return [];
}

function getRelevantPairs(): string[] {
  const active = getActiveSessions();
  const pairs = new Set<string>();
  active.forEach(session => {
    session.pairs.forEach(pair => pairs.add(pair));
  });
  // Add major pairs that are always relevant
  ["EURUSD", "GBPUSD", "USDJPY", "XAUUSD"].forEach(p => pairs.add(p));
  return Array.from(pairs);
}

function getNextSessionEvent(): { type: "open" | "close"; session: ForexSession; minutesUntil: number } | null {
  const now = new Date();
  const hour = now.getUTCHours();
  const minute = now.getUTCMinutes();
  const currentMinutes = hour * 60 + minute;

  let closest: { type: "open" | "close"; session: ForexSession; minutesUntil: number } | null = null;

  for (const session of FOREX_SESSIONS) {
    const openMinutes = session.openHour * 60;
    const closeMinutes = session.closeHour * 60;

    // Calculate minutes until open
    let untilOpen = openMinutes - currentMinutes;
    if (untilOpen < 0) untilOpen += 24 * 60;

    // Calculate minutes until close
    let untilClose = closeMinutes - currentMinutes;
    if (untilClose < 0) untilClose += 24 * 60;

    // Only consider if session is active for close, or inactive for open
    const active = isSessionActive(session);
    
    if (!active && (!closest || untilOpen < closest.minutesUntil)) {
      closest = { type: "open", session, minutesUntil: untilOpen };
    }
    if (active && (!closest || untilClose < closest.minutesUntil)) {
      closest = { type: "close", session, minutesUntil: untilClose };
    }
  }

  return closest;
}

export function KhumoForexSessions({ 
  onPublishIdea, 
  onCopyTrade, 
  onAddToBot, 
  mentorId,
  compact = false 
}: KhumoForexSessionsProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [activeSessions, setActiveSessions] = useState<ForexSession[]>([]);
  const [suggestion, setSuggestion] = useState<TradeSuggestion | null>(null);
  const [loading, setLoading] = useState(false);
  const [autoLoading, setAutoLoading] = useState(false);
  const [nextEvent, setNextEvent] = useState<ReturnType<typeof getNextSessionEvent>>(null);
  const [lastAutoSuggestionTime, setLastAutoSuggestionTime] = useState<number>(0);

  // Update active sessions every minute
  useEffect(() => {
    const updateSessions = () => {
      setActiveSessions(getActiveSessions());
      setNextEvent(getNextSessionEvent());
    };
    updateSessions();
    const interval = setInterval(updateSessions, 60000);
    return () => clearInterval(interval);
  }, []);

  // Auto-generate suggestion at session open/close (within 5 minutes)
  useEffect(() => {
    if (!user) return;
    
    const checkAutoSuggestion = () => {
      const event = getNextSessionEvent();
      if (!event) return;
      
      // If within 5 minutes of session event and haven't auto-suggested in last 30 minutes
      const now = Date.now();
      if (event.minutesUntil <= 5 && now - lastAutoSuggestionTime > 30 * 60 * 1000) {
        setAutoLoading(true);
        fetchSuggestion(true).finally(() => {
          setAutoLoading(false);
          setLastAutoSuggestionTime(now);
        });
      }
    };

    checkAutoSuggestion();
    const interval = setInterval(checkAutoSuggestion, 60000);
    return () => clearInterval(interval);
  }, [user, lastAutoSuggestionTime]);

  const fetchSuggestion = useCallback(async (isAuto = false) => {
    if (!user) return;
    if (!isAuto) setLoading(true);

    try {
      const active = getActiveSessions();
      const overlaps = getSessionOverlaps();
      const relevantPairs = getRelevantPairs();
      
      const sessionContext = active.length > 0
        ? `Active sessions: ${active.map(s => s.name).join(", ")}. ${overlaps.length >= 2 ? `Session overlap detected (${overlaps.join(" + ")}) - expect high volatility.` : ""}`
        : "Markets are in low-activity period between sessions.";

      const prompt = `You are a professional forex analyst. Based on the current market conditions:

${sessionContext}

Relevant currency pairs for active sessions: ${relevantPairs.join(", ")}

Provide ONE specific trading idea with:
1. Symbol (from the relevant pairs)
2. Direction (BUY or SELL)
3. Entry price (approximate current market level)
4. Stop Loss level
5. Take Profit level
6. Brief 2-sentence technical analysis
7. Confidence level (High/Medium/Low)

Format your response EXACTLY like this JSON (no markdown, just pure JSON):
{
  "symbol": "EURUSD",
  "direction": "BUY",
  "entry": "1.0850",
  "stopLoss": "1.0820",
  "takeProfit": "1.0910",
  "analysis": "Price bounced from key support at 1.0840 with bullish engulfing candle. London session momentum supports upside continuation.",
  "confidence": "Medium"
}`;

      const { data, error } = await supabase.functions.invoke('khumo-chat', {
        body: {
          message: prompt,
          user_id: user.id,
          context: "forex_session_suggestion",
        }
      });

      if (error) throw error;

      // Parse the JSON response
      const text = data?.text || "";
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          const newSuggestion: TradeSuggestion = {
            symbol: parsed.symbol?.toUpperCase() || "EURUSD",
            direction: parsed.direction?.toUpperCase() === "SELL" ? "SELL" : "BUY",
            entry: parsed.entry || "Market",
            stopLoss: parsed.stopLoss || "N/A",
            takeProfit: parsed.takeProfit || "N/A",
            analysis: parsed.analysis || "No analysis provided.",
            session: active.map(s => s.name).join(" + ") || "Off-hours",
            confidence: parsed.confidence || "Medium",
          };
          setSuggestion(newSuggestion);
          
          if (isAuto) {
            toast({
              title: "New Trade Idea",
              description: `Khumo AI suggests ${newSuggestion.direction} ${newSuggestion.symbol}`,
            });
          }
        } catch (parseErr) {
          console.error("Failed to parse AI response:", parseErr);
          toast({ title: "Parse Error", description: "Could not parse AI suggestion", variant: "destructive" });
        }
      } else {
        toast({ title: "No suggestion", description: text.slice(0, 100), variant: "destructive" });
      }
    } catch (err: any) {
      console.error("Khumo suggestion error:", err);
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      if (!isAuto) setLoading(false);
    }
  }, [user, toast]);

  const handlePublish = () => {
    if (suggestion && onPublishIdea) {
      onPublishIdea(suggestion);
      toast({ title: "Published to Ideas" });
    }
  };

  const handleCopy = () => {
    if (suggestion && onCopyTrade) {
      onCopyTrade(suggestion);
      toast({ title: "Added to Copy Trading" });
    }
  };

  const handleBot = () => {
    if (suggestion && onAddToBot) {
      onAddToBot(suggestion);
      toast({ title: "Added to AI Bot" });
    }
  };

  if (compact) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              <span className="font-semibold text-sm">Khumo Session Ideas</span>
            </div>
            <div className="flex items-center gap-1">
              {activeSessions.map(s => (
                <Badge key={s.name} variant="outline" className="text-xs">
                  {s.name}
                </Badge>
              ))}
            </div>
          </div>
          
          {suggestion ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge className={suggestion.direction === "BUY" ? "bg-green-500" : "bg-red-500"}>
                    {suggestion.direction === "BUY" ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
                    {suggestion.direction}
                  </Badge>
                  <span className="font-bold">{suggestion.symbol}</span>
                </div>
                <Badge variant="outline">{suggestion.confidence}</Badge>
              </div>
              <p className="text-xs text-muted-foreground line-clamp-2">{suggestion.analysis}</p>
              <div className="flex gap-2">
                {onPublishIdea && (
                  <Button size="sm" variant="outline" onClick={handlePublish} className="flex-1">
                    <Lightbulb className="w-3 h-3 mr-1" /> Publish
                  </Button>
                )}
                {onCopyTrade && (
                  <Button size="sm" variant="outline" onClick={handleCopy} className="flex-1">
                    <Copy className="w-3 h-3 mr-1" /> Copy
                  </Button>
                )}
                {onAddToBot && (
                  <Button size="sm" variant="outline" onClick={handleBot} className="flex-1">
                    <Bot className="w-3 h-3 mr-1" /> Bot
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <Button 
              onClick={() => fetchSuggestion()} 
              disabled={loading} 
              variant="outline" 
              className="w-full"
            >
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
              Get Session Idea
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Globe className="w-5 h-5 text-primary" />
              Forex Session Intelligence
            </CardTitle>
            <CardDescription>AI-powered trade ideas based on active market sessions</CardDescription>
          </div>
          {autoLoading && (
            <Badge variant="outline" className="animate-pulse">
              <Loader2 className="w-3 h-3 mr-1 animate-spin" /> Auto-updating...
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Active Sessions */}
        <div className="flex flex-wrap gap-2">
          {FOREX_SESSIONS.map(session => {
            const active = isSessionActive(session);
            return (
              <Badge 
                key={session.name} 
                variant={active ? "default" : "outline"}
                className={`${active ? session.color + " text-white" : "text-muted-foreground"} transition-all`}
              >
                <Clock className="w-3 h-3 mr-1" />
                {session.name} {active ? "(Active)" : ""}
              </Badge>
            );
          })}
        </div>

        {/* Next Event */}
        {nextEvent && (
          <div className="text-sm text-muted-foreground flex items-center gap-1">
            <Clock className="w-4 h-4" />
            {nextEvent.session.name} {nextEvent.type === "open" ? "opens" : "closes"} in {Math.floor(nextEvent.minutesUntil / 60)}h {nextEvent.minutesUntil % 60}m
          </div>
        )}

        {/* Session Overlap Alert */}
        {getSessionOverlaps().length >= 2 && (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 text-sm">
            <span className="font-semibold text-amber-600">Session Overlap:</span> {getSessionOverlaps().join(" + ")} - Higher volatility expected
          </div>
        )}

        {/* Suggestion Card */}
        {suggestion ? (
          <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Badge className={`${suggestion.direction === "BUY" ? "bg-green-500" : "bg-red-500"} text-white px-3 py-1`}>
                  {suggestion.direction === "BUY" ? <TrendingUp className="w-4 h-4 mr-1" /> : <TrendingDown className="w-4 h-4 mr-1" />}
                  {suggestion.direction}
                </Badge>
                <span className="text-xl font-bold">{suggestion.symbol}</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{suggestion.session}</Badge>
                <Badge variant={suggestion.confidence === "High" ? "default" : suggestion.confidence === "Medium" ? "secondary" : "outline"}>
                  {suggestion.confidence}
                </Badge>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 text-sm">
              <div className="bg-background rounded p-2">
                <div className="text-muted-foreground text-xs">Entry</div>
                <div className="font-mono font-semibold">{suggestion.entry}</div>
              </div>
              <div className="bg-background rounded p-2">
                <div className="text-muted-foreground text-xs">Stop Loss</div>
                <div className="font-mono font-semibold text-red-500">{suggestion.stopLoss}</div>
              </div>
              <div className="bg-background rounded p-2">
                <div className="text-muted-foreground text-xs">Take Profit</div>
                <div className="font-mono font-semibold text-green-500">{suggestion.takeProfit}</div>
              </div>
            </div>

            <p className="text-sm text-muted-foreground">{suggestion.analysis}</p>

            <div className="flex flex-wrap gap-2 pt-2">
              {onPublishIdea && (
                <Button size="sm" onClick={handlePublish}>
                  <Lightbulb className="w-4 h-4 mr-2" /> Publish Idea
                </Button>
              )}
              {onCopyTrade && (
                <Button size="sm" variant="outline" onClick={handleCopy}>
                  <Copy className="w-4 h-4 mr-2" /> Copy Trade
                </Button>
              )}
              {onAddToBot && (
                <Button size="sm" variant="outline" onClick={handleBot}>
                  <Bot className="w-4 h-4 mr-2" /> Add to Bot
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={() => fetchSuggestion()}>
                <RefreshCw className="w-4 h-4 mr-2" /> Refresh
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-center py-6">
            <Sparkles className="w-10 h-10 mx-auto text-primary mb-3 opacity-50" />
            <p className="text-muted-foreground mb-4">Get AI-powered trade suggestions based on active forex sessions</p>
            <Button onClick={() => fetchSuggestion()} disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
              Generate Session Idea
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default KhumoForexSessions;
