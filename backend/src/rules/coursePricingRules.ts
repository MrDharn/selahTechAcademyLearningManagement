/**
 * Pure pricing rules (no database, no environment), so they can be tested on their own.
 *
 * RENEWAL RULE: a student who already has the course pays HALF of the part of the course that is still left.
 *   price = course price x (100 - percentage covered) / 100 x 0.5
 *   Example: 50% covered -> 25% of the price. 80% covered -> 10% of the price. 0% covered -> 50% of the price.
 */
export const RENEWAL_SHARE_OF_REMAINING_COURSE_PRICE = 0.5;

/**
 * RETAKE RULE (a student who covered 100%): the price of a retake as a percentage of the course price.
 * ASSUMPTION: the full price. Change this one number to change the retake price (for example 25, or 0 for free).
 */
export const RETAKE_PRICE_AS_PERCENTAGE_OF_COURSE_PRICE = 100;

/** 1 naira: a paid course never becomes accidentally free. */
export const SMALLEST_CHARGED_AMOUNT_IN_KOBO = 100;

function roundToWholeNaira(amountInKobo: number): number {
  return Math.round(amountInKobo / 100) * 100;
}

export function calculateRenewalPriceInKobo(basePriceInKobo: number, completionPercentage: number): number {
  if (basePriceInKobo === 0) return 0;
  const remainingPercentage = Math.min(100, Math.max(0, 100 - completionPercentage));
  const rawPriceInKobo = basePriceInKobo * (remainingPercentage / 100) * RENEWAL_SHARE_OF_REMAINING_COURSE_PRICE;
  return Math.max(SMALLEST_CHARGED_AMOUNT_IN_KOBO, roundToWholeNaira(rawPriceInKobo));
}

export function calculateRetakePriceInKobo(basePriceInKobo: number): number {
  return roundToWholeNaira((basePriceInKobo * RETAKE_PRICE_AS_PERCENTAGE_OF_COURSE_PRICE) / 100);
}

/** Full price minus a discount percentage (the scholarship), rounded to a whole kobo. */
export function calculateDiscountedPriceInKobo(fullPriceInKobo: number, discountPercentage: number): number {
  return Math.round((fullPriceInKobo * (100 - discountPercentage)) / 100);
}
