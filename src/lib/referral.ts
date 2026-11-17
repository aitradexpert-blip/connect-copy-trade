const KEY = "humi_ref";
const TTL_MS = 30 * 24 * 60 * 60 * 1000;

export interface StoredReferral { ref: string; idea?: string | null; src?: string | null; at: number; }

/** Store a referral code (plus shared idea + source) from the URL for 30 days so it survives until signup. */
export function captureReferral(search: string = window.location.search, pathname: string = window.location.pathname) {
  try {
    const p = new URLSearchParams(search);
    const slugFromPath = pathname.match(/^\/ref\/([^/?#]+)/)?.[1];
    const ref = p.get("ref") || (slugFromPath ? decodeURIComponent(slugFromPath) : null);
    if (ref) localStorage.setItem(KEY, JSON.stringify({ ref, idea: p.get("idea"), src: p.get("src"), at: Date.now() }));
  } catch { /* storage unavailable */ }
}

export function getStoredReferralDetails(): StoredReferral | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as StoredReferral;
    if (Date.now() - data.at > TTL_MS) { localStorage.removeItem(KEY); return null; }
    return data;
  } catch { return null; }
}

export function getStoredReferral(): string | null {
  return getStoredReferralDetails()?.ref ?? null;
}

export const SITE_URL = "https://humi.co.za";
export const referralLink = (code: string) => `${SITE_URL}/auth?ref=${encodeURIComponent(code)}`;

export type SharerKind = "mentor" | "affiliate" | "none";

/** Build a tracked share link: mentors link to their page, affiliates to signup with their code. */
export function buildShareLink(kind: SharerKind, code: string | null, ideaId?: string) {
  const q = new URLSearchParams({ src: "share" });
  if (ideaId) q.set("idea", ideaId);
  if (kind === "mentor" && code) return `${SITE_URL}/ref/${encodeURIComponent(code)}?${q}`;
  if (kind === "affiliate" && code) { q.set("ref", code); return `${SITE_URL}/auth?${q}`; }
  return `${SITE_URL}/auth?${q}`;
}
