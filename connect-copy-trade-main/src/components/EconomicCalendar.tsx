import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, Clock, TrendingUp, AlertTriangle, RefreshCw, Loader2, ExternalLink } from 'lucide-react';
import { 
  getEconomicCalendar, 
  EconomicEvent, 
  getImpactLabel, 
  getImpactColor 
} from '@/services/derivCalendar';

interface EconomicCalendarProps {
  className?: string;
  compact?: boolean;
}

export default function EconomicCalendar({ className, compact = false }: EconomicCalendarProps) {
  const [events, setEvents] = useState<EconomicEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currencyFilter, setCurrencyFilter] = useState<string>('all');
  const [impactFilter, setImpactFilter] = useState<string>('all');

  const loadEvents = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const now = new Date();
      const weekFromNow = new Date();
      weekFromNow.setDate(weekFromNow.getDate() + 7);
      
      const data = await getEconomicCalendar(now, weekFromNow);
      setEvents(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load economic calendar');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvents();
  }, []);

  const filteredEvents = events.filter(event => {
    if (currencyFilter !== 'all' && event.currency !== currencyFilter) return false;
    if (impactFilter !== 'all' && event.impact !== parseInt(impactFilter)) return false;
    return true;
  });

  const currencies = [...new Set(events.map(e => e.currency))].sort();

  const formatDate = (epoch: number) => {
    const date = new Date(epoch * 1000);
    return date.toLocaleDateString(undefined, { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const formatTime = (epoch: number) => {
    const date = new Date(epoch * 1000);
    return date.toLocaleTimeString(undefined, { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  if (compact) {
    return (
      <Card className={className}>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Calendar className="w-4 h-4" />
            Economic Events
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {loading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
            </div>
          ) : error ? (
            <p className="text-sm text-muted-foreground">{error}</p>
          ) : filteredEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground">No upcoming events</p>
          ) : (
            filteredEvents.slice(0, 5).map((event, index) => (
              <div key={index} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {event.currency}
                  </Badge>
                  <span className="truncate max-w-[150px]">{event.event_name}</span>
                </div>
                <span className={getImpactColor(event.impact)}>
                  {getImpactLabel(event.impact)}
                </span>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Economic Calendar
            </CardTitle>
            <CardDescription>
              Upcoming market-moving events for the next 7 days
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" asChild>
              <a href="https://www.tradingview.com/economic-calendar/" target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-4 h-4 mr-2" />
                TradingView
              </a>
            </Button>
            <Button variant="outline" size="sm" onClick={loadEvents} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex gap-4">
          <Select value={currencyFilter} onValueChange={setCurrencyFilter}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Currency" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Currencies</SelectItem>
              {currencies.map(currency => (
                <SelectItem key={currency} value={currency}>{currency}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Select value={impactFilter} onValueChange={setImpactFilter}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Impact" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Impact</SelectItem>
              <SelectItem value="3">High Only</SelectItem>
              <SelectItem value="2">Medium+</SelectItem>
              <SelectItem value="1">Low+</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Events List */}
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : error ? (
          <div className="text-center py-8">
            <AlertTriangle className="w-8 h-8 text-destructive mx-auto mb-2" />
            <p className="text-muted-foreground">{error}</p>
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="text-center py-8">
            <Calendar className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-muted-foreground">No events match your filters</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {filteredEvents.map((event, index) => {
              const tvUrl = `https://www.tradingview.com/economic-calendar/?currencies=${encodeURIComponent(event.currency || '')}`;
              return (
              <a 
                key={index} 
                href={tvUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted hover:border-primary/40 border border-transparent transition-colors group"
                title="Open on TradingView"
              >
                <div className="flex items-center gap-3">
                  <div className="text-center min-w-[60px]">
                    <div className="text-xs text-muted-foreground">
                      {formatDate(event.release_date)}
                    </div>
                    <div className="text-sm font-medium flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatTime(event.release_date)}
                    </div>
                  </div>
                  <div className="border-l pl-3 border-border">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{event.currency}</Badge>
                      <span className="font-medium group-hover:text-primary transition-colors">{event.event_name}</span>
                      <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-60 transition-opacity" />
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 flex gap-4">
                      {event.forecast && (
                        <span>Forecast: {event.forecast.display_value}</span>
                      )}
                      {event.previous && (
                        <span>Previous: {event.previous.display_value}</span>
                      )}
                      {event.actual && (
                        <span className="text-foreground font-medium">
                          Actual: {event.actual.display_value}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <Badge 
                  className={`${
                    event.impact === 3 
                      ? 'bg-loss/20 text-loss border-loss/30' 
                      : event.impact === 2 
                        ? 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30'
                        : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {event.impact === 3 && <TrendingUp className="w-3 h-3 mr-1" />}
                  {getImpactLabel(event.impact)}
                </Badge>
              </a>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
