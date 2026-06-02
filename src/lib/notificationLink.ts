// Maps legacy notification link paths to the actual React routes defined in App.tsx.
// Old triggers stored "/trading-ideas", "/ai-auto-trading", "/trading-accounts" — those routes don't exist.
const ALIAS: Record<string, string> = {
  '/trading-ideas': '/ideas',
  '/ai-auto-trading': '/ai-trading',
  '/trading-accounts': '/accounts',
};

export function resolveNotificationLink(link?: string | null): string | null {
  if (!link) return null;
  // Allow query strings to pass through ("/trading-ideas?signal=123" -> "/ideas?signal=123")
  for (const [from, to] of Object.entries(ALIAS)) {
    if (link === from) return to;
    if (link.startsWith(from + '?') || link.startsWith(from + '#')) {
      return to + link.slice(from.length);
    }
  }
  return link;
}
