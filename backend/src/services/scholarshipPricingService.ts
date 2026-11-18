import { environmentConfiguration } from '../configuration/environmentConfiguration';

/** Full price minus the scholarship discount (50% by default), rounded to a whole kobo. */
export function calculateScholarshipPriceInKobo(fullCoursePriceInKobo: number): number {
  const percentageOfPriceStudentPays = 100 - environmentConfiguration.scholarshipDiscountPercentage;
  return Math.round((fullCoursePriceInKobo * percentageOfPriceStudentPays) / 100);
}
