import type { PaymentKind } from '@prisma/client';
import { prismaDatabaseClient } from '../database/prismaDatabaseClient';
import { buildStudentCourseProgress } from './courseProgressService';

/**
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

const SMALLEST_CHARGED_AMOUNT_IN_KOBO = 100; // 1 naira: a paid course never becomes accidentally free

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

export interface CoursePurchaseQuote {
  purchaseKind: PaymentKind;
  amountInKobo: number;
  /** The price before the renewal/retake rule (the full price, or the scholarship price for a scholarship purchase). */
  basePriceInKobo: number;
  /** Null for a first purchase. */
  completionPercentage: number | null;
}

/** The one place that decides what a student pays. The quote endpoint and the payment start both use it, so they can never disagree. */
export async function buildCoursePurchaseQuote(details: {
  studentUserId: string;
  courseId: string;
  basePriceInKobo: number;
  isScholarshipPurchase: boolean;
}): Promise<CoursePurchaseQuote> {
  const existingEnrollment = await prismaDatabaseClient.enrollment.findUnique({
    where: { studentUserId_courseId: { studentUserId: details.studentUserId, courseId: details.courseId } },
  });

  // First purchase, or upgrading from the scholarship to the full course: the normal price.
  const isFirstPurchaseOrUpgrade = !existingEnrollment || (existingEnrollment.enrollmentType === 'SCHOLARSHIP' && !details.isScholarshipPurchase);
  if (isFirstPurchaseOrUpgrade) {
    return { purchaseKind: 'ENROLLMENT', amountInKobo: details.basePriceInKobo, basePriceInKobo: details.basePriceInKobo, completionPercentage: null };
  }

  const courseProgress = await buildStudentCourseProgress(details.studentUserId, details.courseId);

  if (courseProgress.isCourseFullyCompleted) {
    return { purchaseKind: 'RETAKE', amountInKobo: calculateRetakePriceInKobo(details.basePriceInKobo), basePriceInKobo: details.basePriceInKobo, completionPercentage: 100 };
  }

  // Rounding must never show 100% while lessons are still left.
  const completionPercentage = Math.min(99, courseProgress.completionPercentage);
  return {
    purchaseKind: 'RENEWAL',
    amountInKobo: calculateRenewalPriceInKobo(details.basePriceInKobo, completionPercentage),
    basePriceInKobo: details.basePriceInKobo,
    completionPercentage,
  };
}
