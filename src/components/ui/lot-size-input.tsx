import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export interface LotSizeInputProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  className?: string;
}

export function LotSizeInput({
  value,
  onChange,
  min = 0.01,
  max = 100,
  step = 0.01,
  disabled = false,
  className,
}: LotSizeInputProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Round to 2 decimal places for display
  const formatValue = (val: number): string => {
    return val.toFixed(2);
  };

  // Clamp value between min and max
  const clamp = (val: number): number => {
    const rounded = Math.round(val * 100) / 100; // Round to 2 decimals
    return Math.max(min, Math.min(max, rounded));
  };

  const handleIncrement = () => {
    const newValue = clamp(value + step);
    onChange(newValue);
    inputRef.current?.focus();
  };

  const handleDecrement = () => {
    const newValue = clamp(value - step);
    onChange(newValue);
    inputRef.current?.focus();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    
    // Allow empty input temporarily for typing
    if (inputValue === "" || inputValue === ".") {
      return;
    }
    
    const parsed = parseFloat(inputValue);
    if (!isNaN(parsed)) {
      onChange(clamp(parsed));
    }
  };

  const handleBlur = () => {
    // Ensure value is valid on blur
    if (value < min) {
      onChange(min);
    } else if (value > max) {
      onChange(max);
    }
  };

  const isAtMin = value <= min;
  const isAtMax = value >= max;

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-10 w-10 shrink-0"
        onClick={handleDecrement}
        disabled={disabled || isAtMin}
        aria-label="Decrease lot size"
      >
        <Minus className="h-4 w-4" />
      </Button>
      
      <Input
        ref={inputRef}
        type="number"
        value={formatValue(value)}
        onChange={handleInputChange}
        onBlur={handleBlur}
        disabled={disabled}
        min={min}
        max={max}
        step={step}
        className="text-center font-mono h-10 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        aria-label="Lot size"
      />
      
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-10 w-10 shrink-0"
        onClick={handleIncrement}
        disabled={disabled || isAtMax}
        aria-label="Increase lot size"
      >
        <Plus className="h-4 w-4" />
      </Button>
    </div>
  );
}
