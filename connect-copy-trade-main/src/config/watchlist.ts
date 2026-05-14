// Comprehensive tradeable symbol catalog organised by category.
// Used by SymbolCombobox, WatchlistDropdown and the Publish Trading Idea form.
export const COMPREHENSIVE_WATCHLIST = {
  "FOREX — MAJORS (USD pairs)": [
    "EUR/USD", "GBP/USD", "USD/JPY", "USD/CHF", "AUD/USD", "USD/CAD", "NZD/USD"
  ],
  "FOREX — MINORS (Cross pairs)": [
    "EUR/GBP", "EUR/JPY", "EUR/CHF", "EUR/AUD", "EUR/CAD", "EUR/NZD",
    "GBP/JPY", "GBP/CHF", "GBP/AUD", "GBP/CAD", "GBP/NZD",
    "AUD/JPY", "AUD/CAD", "AUD/CHF", "AUD/NZD",
    "CAD/JPY", "CAD/CHF", "CHF/JPY", "NZD/JPY", "NZD/CAD", "NZD/CHF"
  ],
  "FOREX — EXOTICS (incl. ZAR)": [
    "USD/ZAR", "EUR/ZAR", "GBP/ZAR",
    "USD/TRY", "EUR/TRY", "USD/SGD", "USD/HKD", "USD/CNH",
    "USD/MXN", "USD/INR", "USD/THB", "USD/SEK", "USD/NOK", "USD/DKK",
    "USD/PLN", "USD/HUF", "USD/CZK", "EUR/SEK", "EUR/NOK", "EUR/PLN"
  ],
  "INDICES — US": [
    "US30", "US500", "USTEC", "NAS100", "SPX500", "DJI", "RUSSELL2000"
  ],
  "INDICES — EUROPE": [
    "DE30", "DAX40", "UK100", "FTSE100", "EU50", "ESTX50", "FR40", "CAC40",
    "FTSE250", "IBEX35", "FTSE_MIB", "SMI20", "AEX25", "OMXS30"
  ],
  "INDICES — ASIA & OCEANIA": [
    "JP225", "NIKKEI225", "TOPIX", "AUS200", "ASX200",
    "HK50", "HSI50", "SSE50", "SZSE100", "KOSPI200", "SENSEX", "NIFTY50", "TSX60"
  ],
  "METALS": [
    "XAU/USD", "XAG/USD", "XPT/USD", "XPD/USD", "XAU/EUR", "XAG/EUR",
    "XAU/GBP", "XAG/GBP", "XAU/JPY", "XAG/JPY", "XAU/AUD", "XAG/AUD"
  ],
  "SYNTHETIC INDICES — VOLATILITY (Deriv)": [
    "Volatility 10 (1s)", "Volatility 25 (1s)", "Volatility 50 (1s)",
    "Volatility 75 (1s)", "Volatility 100 (1s)",
    "Volatility 10", "Volatility 25", "Volatility 50",
    "Volatility 75", "Volatility 100"
  ],
  "SYNTHETIC INDICES — BOOM & CRASH (Deriv)": [
    "Boom 300", "Boom 500", "Boom 1000",
    "Crash 300", "Crash 500", "Crash 1000"
  ],
  "SYNTHETIC INDICES — JUMP & STEP (Deriv)": [
    "Step Index", "Jump 10", "Jump 25", "Jump 50", "Jump 75", "Jump 100"
  ],
  "STOCKS — US": [
    "AAPL", "TSLA", "MSFT", "AMZN", "GOOGL", "META", "NFLX", "NVDA", "AMD", "INTC",
    "IBM", "ORCL", "CSCO", "ADBE", "CRM", "PYPL", "SQ", "SHOP", "UBER", "LYFT",
    "BA", "CAT", "DE", "XOM", "CVX", "COP", "T", "VZ", "DIS",
    "NKE", "WMT", "TGT", "HD", "LOW", "MCD", "SBUX", "KO", "PEP", "JNJ",
    "PFE", "MRK", "ABT", "UNH", "JPM", "BAC", "WFC", "GS", "MS", "V", "MA"
  ],
  "STOCKS — EUROPE": [
    "BMW", "SAP", "HSBA", "BP", "VOD", "BARC", "GLEN", "SHEL"
  ],
  "STOCKS — SOUTH AFRICA (JSE)": [
    "NPN", "AGL", "SOL", "MTN", "SBK", "FSR", "ABG", "BHP", "CFR", "PRX"
  ],
  "CRYPTO — MAJOR": [
    "BTC/USD", "ETH/USD", "LTC/USD", "BCH/USD", "BNB/USD",
    "ETH/BTC", "LTC/BTC"
  ],
  "CRYPTO — ALTCOINS": [
    "XRP/USD", "ADA/USD", "SOL/USD", "DOT/USD", "DOGE/USD",
    "LINK/USD", "MATIC/USD", "AVAX/USD", "ATOM/USD", "FIL/USD",
    "ETC/USD", "XLM/USD", "XMR/USD", "ZEC/USD", "DASH/USD",
    "EOS/USD", "TRX/USD", "XTZ/USD", "ALGO/USD", "NEAR/USD", "FTM/USD",
    "SAND/USD", "MANA/USD", "GALA/USD", "ENJ/USD", "BAT/USD",
    "COMP/USD", "UNI/USD", "AAVE/USD", "MKR/USD", "YFI/USD"
  ]
};

export const ALL_SYMBOLS = Object.values(COMPREHENSIVE_WATCHLIST).flat();
