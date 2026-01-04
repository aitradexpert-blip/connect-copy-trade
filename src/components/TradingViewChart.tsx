import { memo, useMemo } from 'react';
import { AdvancedRealTimeChart } from 'react-ts-tradingview-widgets';
import { useTheme } from 'next-themes';

interface TradingViewChartProps {
  symbol: string;
  height?: number;
}

// Map HuMi symbols to TradingView format
const TRADINGVIEW_SYMBOL_MAP: Record<string, string> = {
  // Forex Majors
  'EUR/USD': 'FX:EURUSD',
  'GBP/USD': 'FX:GBPUSD',
  'USD/JPY': 'FX:USDJPY',
  'USD/CHF': 'FX:USDCHF',
  'AUD/USD': 'FX:AUDUSD',
  'NZD/USD': 'FX:NZDUSD',
  'USD/CAD': 'FX:USDCAD',
  
  // Forex Minors
  'EUR/GBP': 'FX:EURGBP',
  'EUR/JPY': 'FX:EURJPY',
  'GBP/JPY': 'FX:GBPJPY',
  'EUR/CHF': 'FX:EURCHF',
  'EUR/AUD': 'FX:EURAUD',
  'GBP/CHF': 'FX:GBPCHF',
  'AUD/JPY': 'FX:AUDJPY',
  'NZD/JPY': 'FX:NZDJPY',
  'CHF/JPY': 'FX:CHFJPY',
  'CAD/JPY': 'FX:CADJPY',
  'AUD/NZD': 'FX:AUDNZD',
  'AUD/CAD': 'FX:AUDCAD',
  'EUR/NZD': 'FX:EURNZD',
  'EUR/CAD': 'FX:EURCAD',
  'GBP/AUD': 'FX:GBPAUD',
  'GBP/CAD': 'FX:GBPCAD',
  'GBP/NZD': 'FX:GBPNZD',
  
  // Metals
  'XAU/USD': 'OANDA:XAUUSD',
  'XAG/USD': 'OANDA:XAGUSD',
  'GOLD': 'TVC:GOLD',
  'SILVER': 'TVC:SILVER',
  
  // Crypto
  'BTC/USD': 'BITSTAMP:BTCUSD',
  'ETH/USD': 'BITSTAMP:ETHUSD',
  'LTC/USD': 'BITSTAMP:LTCUSD',
  'XRP/USD': 'BITSTAMP:XRPUSD',
  'BCH/USD': 'BITSTAMP:BCHUSD',
  'SOL/USD': 'BINANCE:SOLUSDT',
  'DOGE/USD': 'BINANCE:DOGEUSDT',
  'ADA/USD': 'BINANCE:ADAUSDT',
  'DOT/USD': 'BINANCE:DOTUSDT',
  'AVAX/USD': 'BINANCE:AVAXUSDT',
  
  // Indices
  'US30': 'FOREXCOM:DJI',
  'US500': 'FOREXCOM:SPX500',
  'NAS100': 'NASDAQ:NDX',
  'UK100': 'SPREADEX:UK100',
  'GER40': 'SPREADEX:GER40',
  'JP225': 'TVC:NI225',
  'AUS200': 'SPREADEX:AUS200',
  'FRA40': 'SPREADEX:FRA40',
  'HK50': 'SPREADEX:HK50',
  
  // Commodities
  'OIL': 'TVC:USOIL',
  'USOIL': 'TVC:USOIL',
  'UKOIL': 'TVC:UKOIL',
  'NATGAS': 'TVC:NATGAS',
};

function getTradingViewSymbol(humiSymbol: string): string {
  // Direct match
  if (TRADINGVIEW_SYMBOL_MAP[humiSymbol]) {
    return TRADINGVIEW_SYMBOL_MAP[humiSymbol];
  }
  
  // Try without slash
  const withoutSlash = humiSymbol.replace('/', '');
  for (const [key, value] of Object.entries(TRADINGVIEW_SYMBOL_MAP)) {
    if (key.replace('/', '') === withoutSlash) {
      return value;
    }
  }
  
  // Fallback: assume forex pair format
  if (humiSymbol.includes('/')) {
    return `FX:${humiSymbol.replace('/', '')}`;
  }
  
  // Last resort: try as-is with FX prefix
  return `FX:${humiSymbol}`;
}

const TradingViewChart = memo(function TradingViewChart({ 
  symbol, 
  height = 500 
}: TradingViewChartProps) {
  const { theme } = useTheme();
  
  const tvSymbol = useMemo(() => getTradingViewSymbol(symbol), [symbol]);
  const tvTheme = theme === 'dark' ? 'dark' : 'light';
  
  return (
    <div className="w-full rounded-lg overflow-hidden border border-border" style={{ height }}>
      <AdvancedRealTimeChart
        symbol={tvSymbol}
        theme={tvTheme}
        autosize
        interval="60"
        timezone="Etc/UTC"
        style="1"
        locale="en"
        toolbar_bg={theme === 'dark' ? '#1e293b' : '#ffffff'}
        enable_publishing={false}
        allow_symbol_change={false}
        hide_top_toolbar={false}
        hide_legend={false}
        save_image={false}
        container_id={`tradingview-${symbol.replace(/[^a-zA-Z0-9]/g, '')}`}
      />
    </div>
  );
});

export default TradingViewChart;
