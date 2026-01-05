import { Button } from "@/components/ui/button";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { BarChart2, TrendingUp, Clock, Settings2 } from "lucide-react";

interface ChartControlsProps {
  interval: string;
  chartStyle: string;
  onIntervalChange: (interval: string) => void;
  onChartStyleChange: (style: string) => void;
}

const TIMEFRAMES = [
  { value: "1", label: "1m" },
  { value: "5", label: "5m" },
  { value: "15", label: "15m" },
  { value: "60", label: "1H" },
  { value: "240", label: "4H" },
  { value: "D", label: "1D" },
  { value: "W", label: "1W" },
];

const CHART_STYLES = [
  { value: "1", label: "Candlestick" },
  { value: "0", label: "Bars" },
  { value: "2", label: "Line" },
  { value: "8", label: "Heikin-Ashi" },
  { value: "9", label: "Hollow Candles" },
  { value: "3", label: "Area" },
];

export default function ChartControls({
  interval,
  chartStyle,
  onIntervalChange,
  onChartStyleChange,
}: ChartControlsProps) {
  return (
    <div className="flex flex-wrap items-center gap-3 p-3 bg-muted/30 rounded-lg border border-border/50">
      {/* Timeframe Quick Buttons */}
      <div className="flex items-center gap-1">
        <Clock className="w-4 h-4 text-muted-foreground mr-1" />
        {TIMEFRAMES.map((tf) => (
          <Button
            key={tf.value}
            variant={interval === tf.value ? "default" : "ghost"}
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => onIntervalChange(tf.value)}
          >
            {tf.label}
          </Button>
        ))}
      </div>

      <div className="h-6 w-px bg-border hidden md:block" />

      {/* Chart Type Selector */}
      <div className="flex items-center gap-2">
        <BarChart2 className="w-4 h-4 text-muted-foreground" />
        <Select value={chartStyle} onValueChange={onChartStyleChange}>
          <SelectTrigger className="h-8 w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CHART_STYLES.map((style) => (
              <SelectItem key={style.value} value={style.value}>
                {style.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="h-6 w-px bg-border hidden lg:block" />

      {/* Market Session Indicator */}
      <MarketSessionIndicator />
    </div>
  );
}

function MarketSessionIndicator() {
  const now = new Date();
  const utcHour = now.getUTCHours();

  // Market sessions (approximate UTC times)
  const sessions = [
    { name: "Sydney", start: 22, end: 7, color: "bg-blue-500" },
    { name: "Tokyo", start: 0, end: 9, color: "bg-pink-500" },
    { name: "London", start: 8, end: 17, color: "bg-green-500" },
    { name: "New York", start: 13, end: 22, color: "bg-yellow-500" },
  ];

  const activeSessions = sessions.filter((s) => {
    if (s.start > s.end) {
      // Overnight session
      return utcHour >= s.start || utcHour < s.end;
    }
    return utcHour >= s.start && utcHour < s.end;
  });

  return (
    <div className="flex items-center gap-2 text-xs">
      <TrendingUp className="w-4 h-4 text-muted-foreground" />
      {activeSessions.length > 0 ? (
        <div className="flex gap-1">
          {activeSessions.map((s) => (
            <span
              key={s.name}
              className={`px-2 py-0.5 rounded-full text-white ${s.color}`}
            >
              {s.name}
            </span>
          ))}
        </div>
      ) : (
        <span className="text-muted-foreground">Markets Closed</span>
      )}
    </div>
  );
}
