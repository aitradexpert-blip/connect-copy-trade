import { describe, it, expect } from "vitest";
import { mentorSplit, affiliateCommission, MENTOR_SEAT_FEE_CENTS, BASIC_PRICE_CENTS } from "./mentorFees";

describe("pricing rules", () => {
  it("Basic plan is R349", () => expect(BASIC_PRICE_CENTS).toBe(34900));
  it("mentor pays 50% of Basic per follower (R174.50)", () => expect(MENTOR_SEAT_FEE_CENTS).toBe(17450));
  it("R499 mentor plan nets mentor R324.50", () => expect(mentorSplit(49900).mentorNet).toBe(32450));
  it("rejects a mentor price below the platform fee", () => expect(() => mentorSplit(10000)).toThrow());
  it("affiliate earns 50% of R349 = R174.50", () => expect(affiliateCommission(34900)).toBe(17450));
});
