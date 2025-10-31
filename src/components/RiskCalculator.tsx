import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";

interface RiskCalculatorProps {
  accountBalance?: number;
  stopLossPips?: number;
  onCalculate?: (lotSize: number) => void;
}

export default function RiskCalculator({ accountBalance = 10000, stopLossPips = 50, onCalculate }: RiskCalculatorProps) {
  const [balance, setBalance] = useState(accountBalance);
  const [riskPercent, setRiskPercent] = useState(2);
  const [stopLoss, setStopLoss] = useState(stopLossPips);
  const [positionSize, setPositionSize] = useState(0);

  useEffect(() => {
    // Calculate position size
    const riskAmount = balance * (riskPercent / 100);
    const pipValue = 10;
    const calculatedSize = riskAmount / (stopLoss * pipValue);
    const finalSize = Number(calculatedSize.toFixed(2));
    setPositionSize(finalSize);
    onCalculate?.(finalSize);
  }, [balance, riskPercent, stopLoss, onCalculate]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Risk Calculator</CardTitle>
        <CardDescription>
          Calculate recommended position size based on your risk tolerance
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="balance">Account Balance ($)</Label>
          <Input
            id="balance"
            type="number"
            value={balance}
            onChange={(e) => setBalance(Number(e.target.value))}
          />
        </div>

        <div className="space-y-2">
          <Label>Risk Per Trade: {riskPercent}%</Label>
          <Slider
            value={[riskPercent]}
            onValueChange={(value) => setRiskPercent(value[0])}
            min={0.5}
            max={5}
            step={0.5}
            className="w-full"
          />
          <p className="text-sm text-muted-foreground">
            Risk Amount: ${(balance * (riskPercent / 100)).toFixed(2)}
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="stopLoss">Stop Loss (Pips)</Label>
          <Input
            id="stopLoss"
            type="number"
            value={stopLoss}
            onChange={(e) => setStopLoss(Number(e.target.value))}
          />
        </div>

        <div className="pt-4 border-t">
          <div className="text-center">
            <p className="text-sm text-muted-foreground mb-2">Recommended Position Size</p>
            <p className="text-3xl font-bold text-primary">{positionSize} lots</p>
          </div>
        </div>

        <div className="bg-muted p-4 rounded-lg text-sm">
          <p className="font-semibold mb-2">Important:</p>
          <ul className="space-y-1 text-muted-foreground">
            <li>• Never risk more than 2-3% per trade</li>
            <li>• Adjust position size based on your stop loss</li>
            <li>• This calculation assumes standard lots ($10 per pip)</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
