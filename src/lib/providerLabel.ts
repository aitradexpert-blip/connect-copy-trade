// White-label helper: never expose underlying provider names like "metaapi".
// Per branding policy, Deriv accounts also render without a provider badge.
export function getProviderLabel(provider?: string | null): string {
  const p = (provider || '').toLowerCase();
  if (p === 'metaapi' || p === 'mt4' || p === 'mt5') return 'MT4/MT5';
  // Deriv and unknown providers render without a label
  return '';
}

export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidMetaApiId(id?: string | null): boolean {
  return !!id && UUID_REGEX.test(id);
}
