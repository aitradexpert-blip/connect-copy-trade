import { useState, useMemo } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { COMPREHENSIVE_WATCHLIST } from '@/config/watchlist';

interface WatchlistDropdownProps {
  onSymbolSelect: (symbol: string) => void;
  activeSymbol: string;
}

export const WatchlistDropdown = ({ onSymbolSelect, activeSymbol }: WatchlistDropdownProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const filteredWatchlist = useMemo(() => {
    if (!searchTerm) return COMPREHENSIVE_WATCHLIST;
    
    const filtered: Record<string, string[]> = {};
    Object.entries(COMPREHENSIVE_WATCHLIST).forEach(([category, symbols]) => {
      const matchedSymbols = symbols.filter(symbol =>
        symbol.toLowerCase().includes(searchTerm.toLowerCase())
      );
      if (matchedSymbols.length > 0) {
        filtered[category] = matchedSymbols;
      }
    });
    return filtered;
  }, [searchTerm]);

  return (
    <div className="relative w-full max-w-md">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search 170+ symbols..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onFocus={() => setIsOpen(true)}
          className="pl-10"
        />
      </div>

      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg z-50">
            <ScrollArea className="max-h-96">
              {Object.entries(filteredWatchlist).map(([category, symbols]) => (
                <div key={category}>
                  <div className="px-3 py-2 text-muted-foreground text-xs font-semibold border-b border-border bg-muted/50 sticky top-0">
                    {category}
                  </div>
                  {symbols.map(symbol => (
                    <button
                      key={symbol}
                      className={`w-full px-3 py-2 text-left text-sm hover:bg-accent transition-colors ${
                        activeSymbol === symbol ? 'bg-primary/10 text-primary font-medium' : 'text-foreground'
                      }`}
                      onClick={() => {
                        onSymbolSelect(symbol);
                        setIsOpen(false);
                        setSearchTerm('');
                      }}
                    >
                      {symbol}
                    </button>
                  ))}
                </div>
              ))}
              
              {Object.keys(filteredWatchlist).length === 0 && (
                <div className="px-3 py-8 text-center text-muted-foreground text-sm">
                  No symbols found matching "{searchTerm}"
                </div>
              )}
            </ScrollArea>
          </div>
        </>
      )}
    </div>
  );
};
