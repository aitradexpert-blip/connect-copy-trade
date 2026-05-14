// Live price feed with Deriv WS primary, cached fallbacks.
// Used by Khumo signal generation so AI ideas reflect actual market prices.
import { getCurrentPrice } from "./derivMarketData";
import { getSharedDerivWS } from "./derivWebSocket";

interface CacheEntry { price: number; ts: number; }
const cache = new Map<string, CacheEntry>();
const TTL_MS = 30_000;

/**
 * Best-effort live price for a symbol. Returns null if all sources fail.
 * Order: cache (30s) → Deriv tick → null.
 */
export async function getLivePrice(symbol: string): Promise<number | null> {
  const key = symbol.toUpperCase();
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && now - hit.ts < TTL_MS) return hit.price;

  try {
    const ws = getSharedDerivWS();
    await ws.connect();
    const price = await getCurrentPrice(symbol, ws);
    if (price && Number.isFinite(price)) {
      cache.set(key, { price, ts: now });
      return price;
    }
  } catch (err) {
    console.warn("[priceFeed] Deriv tick failed for", symbol, err);
  }

  // Fallback: stale cache if available
  if (hit) return hit.price;
  return null;
}

/**
 * Compute reasonable Entry/SL/TP offsets for a symbol class.
 * Returns object the AI prompt can reference, or null if no live price.
 */
export async function getPriceContext(symbol: string, direction: "BUY" | "SELL") {
  const price = await getLivePrice(symbol);
  if (!price) return null;

  const upper = symbol.toUpperCase();
  let pip = 0.0001;
  let slPips = 30;
  let tpPips = 60;

  if (upper.includes("JPY")) { pip = 0.01; slPips = 30; tpPips = 60; }
  else if (upper.includes("XAU") || upper.includes("GOLD")) { pip = 0.1; slPips = 50; tpPips = 100; }
  else if (upper.includes("XAG") || upper.includes("SILVER")) { pip = 0.01; slPips = 30; tpPips = 60; }
  else if (upper.includes("BTC") || upper.includes("ETH")) { pip = 1; slPips = 100; tpPips = 200; }
  else if (upper.includes("VOLATILITY") || upper.startsWith("R_") || upper.includes("BOOM") || upper.includes("CRASH")) {
    // Synthetic indices: use percentage-based offsets
    const slPct = 0.005; // 0.5%
    const tpPct = 0.01;
    const sl = direction === "BUY" ? price * (1 - slPct) : price * (1 + slPct);
    const tp = direction === "BUY" ? price * (1 + tpPct) : price * (1 - tpPct);
    return { entry: price, stopLoss: sl, takeProfit: tp, currentPrice: price };
  }
  else if (upper.includes("US30") || upper.includes("NAS100") || upper.includes("SPX") || upper.includes("DAX")) {
    pip = 1; slPips = 30; tpPips = 60;
  }

  const sl = direction === "BUY" ? price - slPips * pip : price + slPips * pip;
  const tp = direction === "BUY" ? price + tpPips * pip : price - tpPips * pip;
  return { entry: price, stopLoss: sl, takeProfit: tp, currentPrice: price };
}
