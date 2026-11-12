export interface AcademyLesson {
  id: string;
  title: string;
  summary: string;
  points: string[];
  keyTakeaway?: string;
}
export interface QuizQuestion {
  q: string;
  options: string[];
  answer: number;
}
export interface AcademyModule {
  id: string;
  number: number;
  title: string;
  level: "beginner" | "intermediate" | "advanced";
  description: string;
  lessons: AcademyLesson[];
  quiz: QuizQuestion[];
}

export const PASS_MARK = 0.7;

export const academyModules: AcademyModule[] = [
  {
    id: "m1", number: 1, title: "Forex Foundations", level: "beginner",
    description: "What the market is, when it trades, and the numbers behind every trade.",
    lessons: [
      { id: "m1-l1", title: "What is Forex?", summary: "The world's largest financial market.",
        points: ["Forex (FX) means foreign exchange: exchanging one currency for another.", "It is the biggest market in the world, trading roughly $6 trillion per day.", "When trading Forex, you buy one currency and sell another at the same time."] },
      { id: "m1-l2", title: "Market Sessions", summary: "A 24-hour market split into three sessions.",
        points: ["Asian (Tokyo) session: 01:00 – 10:00.", "European (London) session: 09:00 – 18:00.", "North American (New York) session: 14:00 – 22:00.", "The market opens Sunday evening and closes Friday evening.", "Session overlaps (London / New York) usually bring the most movement."],
        keyTakeaway: "Know which session you are trading in — volatility changes with it." },
      { id: "m1-l3", title: "Currencies & Currency Pairs", summary: "Majors, codes, base and quote.",
        points: ["There are 8 major currencies — the most widely traded.", "Currency codes have 3 letters: the first two are the country, the last is the currency (US + D = USD).", "Forex is always traded in pairs: one currency against another.", "In USD/ZAR, the Dollar is the base currency and the Rand is the quote currency."] },
      { id: "m1-l4", title: "Leverage", summary: "Controlling a large position with a small deposit.",
        points: ["Leverage is borrowing from the broker to get bigger market exposure.", "At 1:100, $1,000 controls a $100,000 position.", "A 2% move on $100,000 is $2,000 — growing a $1,000 account to $3,000.", "Leverage magnifies losses exactly as much as profits."],
        keyTakeaway: "Leverage is a tool, not free money. Size positions with risk in mind." },
      { id: "m1-l5", title: "Pips", summary: "How price movement is measured.",
        points: ["Pip = Percentage in Point — the 4th decimal of the exchange rate.", "The number of pips moved determines your profit or loss.", "Example: buy GBP/USD at 1.5734, exit at 1.5818 → 5818 − 5734 = 84 pips."] },
    ],
    quiz: [
      { q: "Roughly how much is traded on the Forex market per day?", options: ["$6 million", "$600 billion", "$6 trillion", "$60 trillion"], answer: 2 },
      { q: "In USD/ZAR, which is the base currency?", options: ["ZAR", "USD", "Both", "Neither"], answer: 1 },
      { q: "At 1:100 leverage, how much can $1,000 control?", options: ["$10,000", "$100,000", "$1,000,000", "$1,100"], answer: 1 },
      { q: "Entry 1.5734, exit 1.5818 on GBP/USD. How many pips?", options: ["84", "8.4", "840", "48"], answer: 0 },
    ],
  },
  {
    id: "m2", number: 2, title: "Analysis, Candles & Trends", level: "beginner",
    description: "Fundamental vs technical analysis, reading candlesticks, and identifying trend.",
    lessons: [
      { id: "m2-l1", title: "Fundamental Analysis", summary: "Trading economic data and news.",
        points: ["Based on economic data and press releases.", "News releases are volatile — false moves can trap you quickly.", "Key events: Non-Farm Payrolls (NFP), PMI, CPI, Retail Sales, and major local political news.", "Check news even if you don't trade it: investing.com, forexfactory.com, bloomberg.com, moneyweb.co.za."],
        keyTakeaway: "Always check the economic calendar before you trade." },
      { id: "m2-l2", title: "Technical Analysis", summary: "Trading what the chart shows.",
        points: ["Based on chart interpretation and clear setups.", "Entry, stop loss and take profit are precisely determined.", "Fundamental trading is free-flowing; technical trading is more accurate and specific."] },
      { id: "m2-l3", title: "The Story & Japanese Candlesticks", summary: "Bulls vs Bears, told by candles.",
        points: ["Forex is a fight between Bulls (push price up) and Bears (push price down).", "A candlestick shows price movement over a time period: 1m, 5m, 15m, 30m, 1H, 4H, 1D, 1W, 1M.", "Bullish candle: close is higher than open.", "Bearish candle: close is lower than open."] },
      { id: "m2-l4", title: "Trends", summary: "Up, down or sideways.",
        points: ["Uptrend: Higher Highs and Higher Lows.", "Downtrend: Lower Highs and Lower Lows.", "Sideways price is called consolidation."],
        keyTakeaway: "The trend is your friend — don't trade against it without a reason." },
    ],
    quiz: [
      { q: "A bullish candle means…", options: ["Close lower than open", "Close higher than open", "No movement", "High volume"], answer: 1 },
      { q: "Higher Highs and Higher Lows describe…", options: ["A downtrend", "Consolidation", "An uptrend", "A reversal"], answer: 2 },
      { q: "Which analysis style gives precise entry, SL and TP?", options: ["Fundamental", "Technical", "Sentiment", "None"], answer: 1 },
      { q: "Which is a high-impact news event?", options: ["NFP", "EMA cross", "Pip value", "Spread"], answer: 0 },
    ],
  },
  {
    id: "m3", number: 3, title: "The Market Maker Method", level: "intermediate",
    description: "How large players move price — and the weekly cycle they leave behind.",
    lessons: [
      { id: "m3-l1", title: "What is the Market Maker?", summary: "The intermediary who can move price.",
        points: ["Market Makers (MMs) are intermediaries — e.g. banks matching buyers and sellers.", "They are traders whose goal is profit, often trading against retail traders.", "Their massive volume lets them move price at will: buy low, sell high."] },
      { id: "m3-l2", title: "The Market Maker's Playbook", summary: "Three tactics to recognise.",
        points: ["1. Induce traders into positions — trick them into a direction, then reverse.", "2. Create panic and fear: quick moves, spike candles, news releases, 'inexplicable' price behaviour.", "3. Hit the stops and clear the board — pushing traders into margin trouble."],
        keyTakeaway: "When a move feels designed to scare you, it probably is." },
      { id: "m3-l3", title: "Weekly Price Movements", summary: "A repeating pattern across the week.",
        points: ["The weekly pattern is seen on 15m, 1H or 4H charts over a week — not the weekly timeframe.", "MMs also show seasonal variations on longer timeframes, but those are too slow to trade well.", "Study the week as a whole to see where you are in the cycle."] },
    ],
    quiz: [
      { q: "The weekly pattern is best viewed on…", options: ["The weekly chart", "15m, 1H or 4H charts", "1-minute only", "Monthly"], answer: 1 },
      { q: "Which is a Market Maker tactic?", options: ["Paying dividends", "Hitting the stops", "Fixing spreads", "Closing the market"], answer: 1 },
      { q: "Spike candles and fast moves are used to…", options: ["Create panic and fear", "Reduce volatility", "Signal holidays", "Show fair value"], answer: 0 },
    ],
  },
  {
    id: "m4", number: 4, title: "Counting Levels", level: "intermediate",
    description: "Know where you are in the cycle: Peak Formation, Levels I–III, and back.",
    lessons: [
      { id: "m4-l1", title: "The Cycle of Threes", summary: "Intraday, 3-day and weekly counts.",
        points: ["Understanding the intraday, 3-day and weekly count is everything.", "A consistent pattern of 3 moves entices traders in one direction — then the brakes are applied.", "MMs don't have infinite capital: they must retrace to book profit, causing sudden pullbacks.", "A trade up 100 pips that drops to 20 may still be valid if the previous low holds."],
        keyTakeaway: "Your first job is to identify the zone and the current place in the cycle." },
      { id: "m4-l2", title: "Peak Formation High & Level I", summary: "The top, and the first drop.",
        points: ["Peak Formation High: the highest formation on the chart; price pulls away quickly forming an M.", "Level I + consolidation: stops are hit up, stops are hit down, then price drops again.", "Never trade against the Peak Formation out of Level I consolidation."] },
      { id: "m4-l3", title: "Level II & Level III", summary: "Continuation and exhaustion.",
        points: ["Level II: price drops from Level I into a new consolidation, hits stops both ways, then drops to Level III.", "Level III looks disorganised — price chops back and forth in a wide range.", "Choppy Level III means a reversal is imminent.", "Level III often forms a head and shoulders (a special M/W) — enter on the 2nd shoulder.", "Lost? Find the last Level III as your reference point."] },
      { id: "m4-l4", title: "Peak Formation Low", summary: "Where the cycle restarts.",
        points: ["After Level III, a new Peak Formation Low forms and the cycle begins again.", "This is where you buy with the MM — even when everything else says 'sell'.", "You are buying against the crowd and against the old trend."] },
    ],
    quiz: [
      { q: "Price chopping in a wide range usually signals…", options: ["Level I", "Level III — reversal soon", "Peak Formation High", "News"], answer: 1 },
      { q: "On a head and shoulders at Level III, enter on…", options: ["The head", "The 1st shoulder", "The 2nd shoulder", "The neckline only"], answer: 2 },
      { q: "You should never trade against the Peak Formation out of…", options: ["Level I consolidation", "Level III", "Friday close", "The 800 EMA"], answer: 0 },
      { q: "Why do sudden pullbacks happen?", options: ["Brokers close", "MMs retrace to book profit", "Spreads widen", "Random"], answer: 1 },
    ],
  },
  {
    id: "m5", number: 5, title: "M & W, EMAs and TDI", level: "advanced",
    description: "Reversal signatures and the indicators that confirm them.",
    lessons: [
      { id: "m5-l1", title: "Anatomy of an M and W", summary: "The core reversal pattern.",
        points: ["M (top) and W (bottom) are strong reversal patterns used by MMs.", "The gap between the two peaks usually lasts 30–90 minutes.", "Fastest version: a 'railroad track' (15m up followed by 15m down).", "Longer formations accumulate trapped traders who followed the technical trend."] },
      { id: "m5-l2", title: "EMAs: 5, 13, 50, 200, 800", summary: "Direction, momentum and targets.",
        points: ["EMAs can show direction, momentum, entry/exit signals, moving support/resistance and TP targets.", "5 and 13 EMA = signal lines.", "50 EMA = balance line, the intraday trend.", "200 EMA = home base, the longer trend. Price always returns to home base.", "The 200 EMA approximates the 50 EMA of the next higher timeframe.", "In Level III the EMAs point the wrong way; after reversal the crossover confirms. EMAs follow, they don't lead."],
        keyTakeaway: "No indicator tells you when to enter. Pattern and count come first." },
      { id: "m5-l3", title: "TDI — Traders Dynamic Index", summary: "An upgraded RSI.",
        points: ["Lines: RSI line, trade signal line, market baseline, and volatility bands.", "Signal line crosses give earlier entries than the RSI midline.", "Volatility bands act as support/resistance based on close.", "When the bands re-contain the RSI after a breakout, weakness and a stop hunt are likely."] },
      { id: "m5-l4", title: "Shark Fin Short & Long", summary: "TDI entry patterns.",
        points: ["Shark Fin Short: RSI overbought with agreeing price action → sell zone.", "RSI crosses back below the signal line (the 'fin') — still a valid entry; also a place to add.", "Exit when RSI reaches the opposite volatility band and re-crosses the signal line.", "Only valid where price action shows the stop hunt (the M/W) — meaningless in consolidation.", "Shark Fin Long is the same, upside down."] },
    ],
    quiz: [
      { q: "The 200 EMA is known as…", options: ["Signal line", "Balance line", "Home base", "Baseline"], answer: 2 },
      { q: "Typical time between the two peaks of an M/W?", options: ["1–5 min", "30–90 min", "1–2 days", "1 week"], answer: 1 },
      { q: "A Shark Fin is meaningful when it appears…", options: ["Anywhere", "During consolidation", "At the stop hunt / M-W area", "Only on Fridays"], answer: 2 },
      { q: "Which EMAs are the signal lines?", options: ["5 and 13", "50 and 200", "200 and 800", "13 and 50"], answer: 0 },
    ],
  },
  {
    id: "m6", number: 6, title: "Risk & The Golden Rules", level: "advanced",
    description: "Discipline that keeps you in the game.",
    lessons: [
      { id: "m6-l1", title: "The 12 Golden Rules", summary: "Rules from the Pro Forex Institute.",
        points: ["1. Never add to a losing trade.", "2. Always set Stop Loss and Take Profit before entering.", "3. Apply risk management on every trade.", "4. Be flexible when market conditions change.", "5. The trend is your friend — don't counter the trend or the MM's moves.", "6. Don't trade in low liquidity or excessive volatility.", "7. If you doubt yourself, don't take the trade.", "8. Practice, practice, practice.", "9. Never trade emotional — you need 100% focus.", "10. Never stop learning and researching.", "11. Journal every trade: what went right, what went wrong.", "12. Let's profit!"],
        keyTakeaway: "Use the HuMi Journal to track every trade — rule 11 in action." },
    ],
    quiz: [
      { q: "When should SL and TP be set?", options: ["After entry", "Before entry", "Only when losing", "Never"], answer: 1 },
      { q: "What should you do with a losing trade?", options: ["Add to it", "Never add to it", "Double the lot", "Remove the stop"], answer: 1 },
      { q: "If you doubt a setup you should…", options: ["Take it smaller", "Not take it", "Ask a friend", "Use more leverage"], answer: 1 },
    ],
  },
];

export const totalLessons = academyModules.reduce((n, m) => n + m.lessons.length, 0);

/** A module unlocks once the previous module's quiz is passed. */
export function isModuleUnlocked(index: number, passedQuizzes: Record<string, boolean>): boolean {
  if (index === 0) return true;
  return !!passedQuizzes[academyModules[index - 1].id];
}

export function scoreQuiz(quiz: QuizQuestion[], answers: number[]): { correct: number; passed: boolean } {
  const correct = quiz.filter((q, i) => answers[i] === q.answer).length;
  return { correct, passed: correct / quiz.length >= PASS_MARK };
}
