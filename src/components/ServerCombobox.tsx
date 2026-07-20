import { useState, useEffect, useRef } from "react";
import { Server } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

const FALLBACK_SERVERS = [
  "Headway-Real",
  "Headway-Demo",
  "Deriv-Server",
  "Deriv-Demo",
  "DerivSVG-Server-02",
  "ICMarketsSC-Live",
  "ICMarketsSC-Demo",
  "XMGlobal-Real 3",
  "Exness-Real",
  "Exness-MT5Real",
  "FBS-Real",
  "FTMO-Demo",
  "OctaFX-Real",
  "Weltrade-Real",
  "Weltrade-Demo",
  "PXBTTrading-1",
];

interface ServerComboboxProps {
  value: string;
  onChange: (value: string) => void;
  servers?: string[];
  placeholder?: string;
  className?: string;
}

/**
 * Plain native input + manual suggestion list — deliberately avoids Radix
 * Popover/cmdk, which was silently stealing focus mid-keystroke on mobile
 * when the on-screen keyboard opened and the viewport resized.
 *
 * The suggestion list is FALLBACK_SERVERS merged with every distinct real
 * server already used across trading_accounts — so it grows on its own as
 * users connect new broker servers, no code change needed.
 */
export function ServerCombobox({
  value,
  onChange,
  servers,
  placeholder = "Type your broker server name...",
  className,
}: ServerComboboxProps) {
  const [open, setOpen] = useState(false);
  const [knownServers, setKnownServers] = useState<string[]>(servers ?? FALLBACK_SERVERS);
  const blurTimeout = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (servers) return; // explicit list passed in — don't override
    supabase
      .from("trading_accounts")
      .select("server")
      .not("server", "is", null)
      .then(({ data }) => {
        const real = (data || []).map((r) => (r.server || "").trim()).filter(Boolean);
        const merged = Array.from(new Set([...FALLBACK_SERVERS, ...real])).sort();
        setKnownServers(merged);
      });
  }, [servers]);

  const filtered = value.trim()
    ? knownServers.filter((s) => s.toLowerCase().includes(value.trim().toLowerCase()))
    : knownServers;

  const handleFocus = () => {
    if (blurTimeout.current) clearTimeout(blurTimeout.current);
    setOpen(true);
  };
  const handleBlur = () => {
    blurTimeout.current = setTimeout(() => setOpen(false), 150);
  };

  return (
    <div className={cn("relative", className)}>
      <div className="relative">
        <Server className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <input
          type="text"
          inputMode="text"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={placeholder}
          className="w-full h-10 rounded-md border border-input bg-background pl-9 pr-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
      {open && filtered.length > 0 && (
        <div className="absolute z-[100] mt-1 w-full max-h-[240px] overflow-y-auto rounded-md border border-border bg-popover shadow-md">
          {filtered.map((s) => (
            <button
              key={s}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { onChange(s); setOpen(false); }}
              className="w-full px-3 py-2 text-left text-sm hover:bg-accent"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
