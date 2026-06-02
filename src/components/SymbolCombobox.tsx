import { useState, useMemo } from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { COMPREHENSIVE_WATCHLIST } from "@/config/watchlist";

interface SymbolComboboxProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

/**
 * Searchable symbol picker covering all 170+ symbols (forex majors/minors,
 * indices, metals, synthetics, crypto, stocks). Allows free-text fallback for
 * broker-specific symbols. Use anywhere a trader needs to pick a tradable instrument.
 */
export function SymbolCombobox({ value, onChange, placeholder = "Select symbol...", className }: SymbolComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const groups = useMemo(() => COMPREHENSIVE_WATCHLIST, []);
  const queryUpper = query.trim().toUpperCase();
  const isCustom = queryUpper.length > 0 && !Object.values(groups).flat().some(s => s.toUpperCase() === queryUpper);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between font-normal", className)}
        >
          <span className={cn(!value && "text-muted-foreground")}>
            {value || placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={true}>
          <CommandInput
            placeholder="Search symbol (e.g. USDZAR, NAS100)..."
            value={query}
            onValueChange={setQuery}
          />
          <CommandList className="max-h-[300px]">
            <CommandEmpty>
              {isCustom ? (
                <button
                  type="button"
                  className="w-full px-3 py-2 text-left text-sm hover:bg-accent"
                  onClick={() => { onChange(queryUpper); setOpen(false); setQuery(""); }}
                >
                  <Search className="inline mr-2 h-4 w-4" />
                  Use custom symbol "{queryUpper}"
                </button>
              ) : (
                "No symbol found"
              )}
            </CommandEmpty>
            {Object.entries(groups).map(([groupName, symbols]) => (
              <CommandGroup key={groupName} heading={groupName}>
                {symbols.map((symbol) => (
                  <CommandItem
                    key={symbol}
                    value={symbol}
                    onSelect={() => { onChange(symbol); setOpen(false); setQuery(""); }}
                  >
                    <Check className={cn("mr-2 h-4 w-4", value === symbol ? "opacity-100" : "opacity-0")} />
                    {symbol}
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
