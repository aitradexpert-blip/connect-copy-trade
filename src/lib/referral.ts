const KEY = "humi_ref";
const TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** Store a referral code from the URL for 30 days so it survives until signup. */
export function captureReferral(search: string = window.location.search) {
  try {
    const ref = new URLSearchParams(search).get("ref");
    if (ref) localStorage.setItem(KEY, JSON.stringify({ ref, at: Date.now() }));
  } catch { /* storage unavailable */ }
}

export function getStoredReferral(): string | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const { ref, at } = JSON.parse(raw);
    if (Date.now() - at > TTL_MS) { localStorage.removeItem(KEY); return null; }
    return ref;
  } catch { return null; }
}

export const SITE_URL = "https://humi.co.za";
export const referralLink = (code: string) => `${SITE_URL}/auth?ref=${encodeURIComponent(code)}`;
