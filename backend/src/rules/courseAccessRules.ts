import { addMonthsToDate } from '../utilities/calendarDateUtilities';

/** Pure access rules (no database, no environment), so they can be tested on their own. */
export function determineCourseAccessStatus(
  enrollmentAccessDates: { accessExpiresAt: Date; gracePeriodEndsAt: Date },
  currentDate: Date = new Date(),
): 'ACTIVE' | 'GRACE_PERIOD' | 'EXPIRED' {
  if (currentDate <= enrollmentAccessDates.accessExpiresAt) return 'ACTIVE';
  if (currentDate <= enrollmentAccessDates.gracePeriodEndsAt) return 'GRACE_PERIOD';
  return 'EXPIRED';
}

/**
 * New access dates after a payment. Time is added on top of whatever paid time is still left;
 * if access already ended (or this is the first purchase) it starts from the payment date.
 */
export function calculateAccessDatesAfterPayment(details: {
  existingAccessExpiresAt: Date | null;
  paymentCompletedAt: Date;
  accessDurationInMonths: number;
  gracePeriodInMonths: number;
}): { accessExpiresAt: Date; gracePeriodEndsAt: Date } {
  const startingPoint =
    details.existingAccessExpiresAt && details.existingAccessExpiresAt > details.paymentCompletedAt
      ? details.existingAccessExpiresAt
      : details.paymentCompletedAt;

  const accessExpiresAt = addMonthsToDate(startingPoint, details.accessDurationInMonths);
  return { accessExpiresAt, gracePeriodEndsAt: addMonthsToDate(accessExpiresAt, details.gracePeriodInMonths) };
}
