import type { PaymentKind } from '@prisma/client';
import { prismaDatabaseClient } from '../database/prismaDatabaseClient';
import { calculateRenewalPriceInKobo, calculateRetakePriceInKobo } from '../rules/coursePricingRules';
import { buildStudentCourseProgress } from './courseProgressService';

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
