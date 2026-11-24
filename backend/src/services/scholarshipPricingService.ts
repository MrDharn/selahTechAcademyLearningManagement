import { environmentConfiguration } from '../configuration/environmentConfiguration';
import { calculateDiscountedPriceInKobo } from '../rules/coursePricingRules';

/** Full price minus the scholarship discount (50% by default), rounded to a whole kobo. */
export function calculateScholarshipPriceInKobo(fullCoursePriceInKobo: number): number {
  return calculateDiscountedPriceInKobo(fullCoursePriceInKobo, environmentConfiguration.scholarshipDiscountPercentage);
}
