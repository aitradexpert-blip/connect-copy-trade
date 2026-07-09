import { useState } from "react";
import { Check, ChevronsUpDown, Server } from "lucide-react";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const DEFAULT_SERVERS = [
  "Headway-Real",
  "Headway-Demo",
  "Deriv-Server",
  "Deriv-Demo",
  "ICMarketsSC-Live",
  "ICMarketsSC-Demo",
  "XMGlobal-Real 3",
  "Exness-Real",
  "Exness-MT5Real",
  "FBS-Real",
  "FTMO-Demo",
  "OctaFX-Real",
  "Weltrade-Live",
  "Weltrade-Demo",
  "Weltrade-ECN",
];

interface ServerComboboxProps {
  value: string;
  onChange: (value: string) => void;
  servers?: string[];
  placeholder?: string;
  className?: string;
}

/**
 * Broker server picker built on Radix Popover + shadcn Command. Users can either
 * scroll/search the pre-populated broker list OR type a custom server name.
 * Fixes the legacy datalist behaviour that clipped focus and dropped custom entries.
 */
export function ServerCombobox({
  value,
  onChange,
  servers = DEFAULT_SERVERS,
  placeholder = "Select or type your broker server...",
  className,
}: ServerComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const trimmed = query.trim();
  const isCustom =
    trimmed.length > 0 && !servers.some((s) => s.toLowerCase() === trimmed.toLowerCase());

  const commit = (v: string) => {
    onChange(v);
    setOpen(false);
    setQuery("");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between bg-background font-normal", className)}
        >
          <span className={cn("flex items-center gap-2 truncate", !value && "text-muted-foreground")}>
            <Server className="h-4 w-4 shrink-0 opacity-60" />
            <span className="truncate">{value || placeholder}</span>
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="z-[100] w-[--radix-popover-trigger-width] p-0"
        align="start"
        onOpenAutoFocus={(e) => {
          // Keep focus in the search input, not on the first item — prevents
          // the popover from stealing focus mid-typing.
          e.preventDefault();
        }}
      >
        <Command shouldFilter>
          <CommandInput
            placeholder="Search or type custom server..."
            value={query}
            onValueChange={setQuery}
            onKeyDown={(e) => {
              if (e.key === "Enter" && isCustom) {
                e.preventDefault();
                commit(trimmed);
              }
            }}
          />
          <CommandList className="max-h-[260px]">
            <CommandEmpty>
              {isCustom ? (
                <button
                  type="button"
                  onClick={() => commit(trimmed)}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-accent"
                >
                  Use custom server <span className="font-semibold">"{trimmed}"</span>
                </button>
              ) : (
                <span className="px-3 py-2 text-sm text-muted-foreground">No match — type to add a custom server.</span>
              )}
            </CommandEmpty>
            <CommandGroup heading="Popular brokers">
              {servers.map((s) => (
                <CommandItem key={s} value={s} onSelect={() => commit(s)}>
                  <Check
                    className={cn("mr-2 h-4 w-4", value === s ? "opacity-100" : "opacity-0")}
                  />
                  {s}
                </CommandItem>
              ))}
            </CommandGroup>
            {isCustom && (
              <CommandGroup heading="Custom">
                <CommandItem value={`__custom__${trimmed}`} onSelect={() => commit(trimmed)}>
                  <Check className="mr-2 h-4 w-4 opacity-0" />
                  Use "{trimmed}"
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
