/** Basic subscription in ZAR cents. */
export const BASIC_PRICE_CENTS = 34900;
/** Mentors pay HuMi 50% of the Basic subscription per active follower each month. */
export const MENTOR_SEAT_FEE_CENTS = BASIC_PRICE_CENTS / 2; // 17450
/** Affiliates earn 50% of each referred user's subscription every active month. */
export const AFFILIATE_COMMISSION_PCT = 50;

export function mentorSplit(priceCents: number, feeCents = MENTOR_SEAT_FEE_CENTS) {
  if (!Number.isInteger(priceCents) || priceCents < feeCents) throw new Error("Price must be at least the platform fee");
  return { gross: priceCents, platformFee: feeCents, mentorNet: priceCents - feeCents };
}

export function affiliateCommission(subscriptionCents: number, pct = AFFILIATE_COMMISSION_PCT) {
  return Math.round((subscriptionCents * pct) / 100);
}

export const formatZar = (cents: number) =>
  `R${(cents / 100).toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
