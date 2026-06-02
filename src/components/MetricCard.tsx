import { LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface MetricCardProps {
  title: string;
  value: string;
  change?: string;
  changeType?: "profit" | "loss" | "neutral";
  icon: LucideIcon;
  trend?: "up" | "down" | "neutral";
}

export function MetricCard({ 
  title, 
  value, 
  change, 
  changeType = "neutral", 
  icon: Icon,
  trend = "neutral" 
}: MetricCardProps) {
  const getChangeColor = () => {
    switch (changeType) {
      case "profit":
        return "text-profit";
      case "loss":
        return "text-loss";
      default:
        return "text-muted-foreground";
    }
  };

  return (
    <Card className="bg-gradient-card border-border shadow-card transition-smooth hover:shadow-elevated">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-foreground">{value}</div>
        {change && (
          <p className={cn("text-xs", getChangeColor())}>
            {change}
          </p>
        )}
      </CardContent>
    </Card>
  );
}