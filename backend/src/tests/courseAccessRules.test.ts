import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { calculateAccessDatesAfterPayment, determineCourseAccessStatus } from '../rules/courseAccessRules';
import { addMonthsToDate } from '../utilities/calendarDateUtilities';

const accessExpiresAt = new Date(2026, 5, 15, 12, 0, 0);
const gracePeriodEndsAt = new Date(2026, 6, 15, 12, 0, 0);

describe('course access status', () => {
  it('is ACTIVE up to and including the moment access expires', () => {
    assert.equal(determineCourseAccessStatus({ accessExpiresAt, gracePeriodEndsAt }, new Date(2026, 0, 1)), 'ACTIVE');
    assert.equal(determineCourseAccessStatus({ accessExpiresAt, gracePeriodEndsAt }, accessExpiresAt), 'ACTIVE');
  });
  it('is GRACE_PERIOD right after expiry, up to the end of the grace period', () => {
    assert.equal(determineCourseAccessStatus({ accessExpiresAt, gracePeriodEndsAt }, new Date(accessExpiresAt.getTime() + 1)), 'GRACE_PERIOD');
    assert.equal(determineCourseAccessStatus({ accessExpiresAt, gracePeriodEndsAt }, gracePeriodEndsAt), 'GRACE_PERIOD');
  });
  it('is EXPIRED after the grace period', () => {
    assert.equal(determineCourseAccessStatus({ accessExpiresAt, gracePeriodEndsAt }, new Date(gracePeriodEndsAt.getTime() + 1)), 'EXPIRED');
  });
});

describe('access dates after a payment (3 months + 1 month grace)', () => {
  const durations = { accessDurationInMonths: 3, gracePeriodInMonths: 1 };

  it('first purchase starts from the payment date', () => {
    const paymentCompletedAt = new Date(2026, 0, 10, 9, 0, 0);
    const result = calculateAccessDatesAfterPayment({ existingAccessExpiresAt: null, paymentCompletedAt, ...durations });
    assert.deepEqual(result.accessExpiresAt, new Date(2026, 3, 10, 9, 0, 0));
    assert.deepEqual(result.gracePeriodEndsAt, new Date(2026, 4, 10, 9, 0, 0));
  });

  it('renewing early adds the new time on top of the time still left', () => {
    const existingAccessExpiresAt = new Date(2026, 3, 10, 9, 0, 0);
    const paymentCompletedAt = new Date(2026, 3, 1, 9, 0, 0);
    const result = calculateAccessDatesAfterPayment({ existingAccessExpiresAt, paymentCompletedAt, ...durations });
    assert.deepEqual(result.accessExpiresAt, new Date(2026, 6, 10, 9, 0, 0));
  });

  it('renewing after access ended starts from the payment date, not the old expiry', () => {
    const existingAccessExpiresAt = new Date(2026, 3, 10, 9, 0, 0);
    const paymentCompletedAt = new Date(2026, 3, 20, 9, 0, 0);
    const result = calculateAccessDatesAfterPayment({ existingAccessExpiresAt, paymentCompletedAt, ...durations });
    assert.deepEqual(result.accessExpiresAt, new Date(2026, 6, 20, 9, 0, 0));
  });

  it('the grace period always ends one month after access ends', () => {
    const result = calculateAccessDatesAfterPayment({ existingAccessExpiresAt: null, paymentCompletedAt: new Date(2026, 10, 30, 8, 0, 0), ...durations });
    assert.deepEqual(result.gracePeriodEndsAt, addMonthsToDate(result.accessExpiresAt, 1));
  });
});

describe('adding calendar months', () => {
  it('clamps to the last day of a shorter month', () => {
    assert.deepEqual(addMonthsToDate(new Date(2026, 0, 31), 1), new Date(2026, 1, 28));
    assert.deepEqual(addMonthsToDate(new Date(2028, 0, 31), 1), new Date(2028, 1, 29)); // leap year
  });
  it('rolls over the year', () => {
    assert.deepEqual(addMonthsToDate(new Date(2026, 10, 15), 3), new Date(2027, 1, 15));
  });
});
