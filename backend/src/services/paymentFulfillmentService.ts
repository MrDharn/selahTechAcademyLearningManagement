import { prismaDatabaseClient } from '../database/prismaDatabaseClient';
import { ApplicationError } from '../utilities/ApplicationError';
import { resetStudentCourseProgressForRetake } from './courseRetakeService';
import { grantOrRenewEnrollment } from './enrollmentAccessService';
import { notifyStudentOfSuccessfulPayment } from './studentNotificationService';
import { verifyPaystackTransaction } from './paystackPaymentService';

export interface PaymentFulfillmentResult {
  paymentStatus: 'PENDING' | 'SUCCESSFUL' | 'FAILED';
  courseId: string;
  accessExpiresAt: Date | null;
  gracePeriodEndsAt: Date | null;
}

/**
 * Safe to call many times for the same reference (browser callback AND Paystack webhook can both arrive).
 * Only the call that flips PENDING -> SUCCESSFUL grants access.
 */
export async function fulfillPaymentByPaystackReference(paystackReference: string): Promise<PaymentFulfillmentResult> {
  const matchingPayment = await prismaDatabaseClient.payment.findUnique({ where: { paystackReference } });

  if (!matchingPayment) {
    throw new ApplicationError(404, 'No payment was found for this reference.', 'PAYMENT_NOT_FOUND');
  }

  const currentEnrollment = () =>
    prismaDatabaseClient.enrollment.findUnique({
      where: { studentUserId_courseId: { studentUserId: matchingPayment.studentUserId, courseId: matchingPayment.courseId } },
    });

  if (matchingPayment.paymentStatus === 'SUCCESSFUL') {
    const alreadyGrantedEnrollment = await currentEnrollment();
    return {
      paymentStatus: 'SUCCESSFUL',
      courseId: matchingPayment.courseId,
      accessExpiresAt: alreadyGrantedEnrollment?.accessExpiresAt ?? null,
      gracePeriodEndsAt: alreadyGrantedEnrollment?.gracePeriodEndsAt ?? null,
    };
  }

  const paystackTransaction = await verifyPaystackTransaction(paystackReference);

  if (paystackTransaction.status !== 'success') {
    const hasPaymentDefinitelyFailed = ['failed', 'abandoned', 'reversed'].includes(paystackTransaction.status);

    if (hasPaymentDefinitelyFailed) {
      await prismaDatabaseClient.payment.updateMany({
        where: { id: matchingPayment.id, paymentStatus: 'PENDING' },
        data: { paymentStatus: 'FAILED' },
      });
    }

    return {
      paymentStatus: hasPaymentDefinitelyFailed ? 'FAILED' : 'PENDING',
      courseId: matchingPayment.courseId,
      accessExpiresAt: null,
      gracePeriodEndsAt: null,
    };
  }

  if (paystackTransaction.amount !== matchingPayment.amountInKobo || paystackTransaction.currency !== 'NGN') {
    await prismaDatabaseClient.payment.updateMany({
      where: { id: matchingPayment.id, paymentStatus: 'PENDING' },
      data: { paymentStatus: 'FAILED' },
    });
    throw new ApplicationError(409, 'The amount paid does not match the course price.', 'PAYMENT_AMOUNT_MISMATCH');
  }

  const paymentCompletedAt = paystackTransaction.paid_at ? new Date(paystackTransaction.paid_at) : new Date();

  let didThisCallCompleteThePayment = false;

  await prismaDatabaseClient.$transaction(async (databaseTransactionClient) => {
    const numberOfPaymentsFlippedToSuccessful = await databaseTransactionClient.payment.updateMany({
      where: { id: matchingPayment.id, paymentStatus: 'PENDING' },
      data: { paymentStatus: 'SUCCESSFUL', paidAt: paymentCompletedAt },
    });

    if (numberOfPaymentsFlippedToSuccessful.count === 1) {
      didThisCallCompleteThePayment = true;
      await grantOrRenewEnrollment(databaseTransactionClient, {
        studentUserId: matchingPayment.studentUserId,
        courseId: matchingPayment.courseId,
        paymentCompletedAt,
        purchasedEnrollmentType: matchingPayment.isScholarshipPayment ? 'SCHOLARSHIP' : 'STANDARD',
      });
      if (matchingPayment.paymentKind === 'RETAKE') {
        await resetStudentCourseProgressForRetake(databaseTransactionClient, matchingPayment.studentUserId, matchingPayment.courseId);
      }
    }
  });

  // The browser callback and the Paystack webhook can both arrive; only the call that completed the payment sends the e-mail.
  if (didThisCallCompleteThePayment) void notifyStudentOfSuccessfulPayment(paystackReference);

  const grantedEnrollment = await currentEnrollment();

  return {
    paymentStatus: 'SUCCESSFUL',
    courseId: matchingPayment.courseId,
    accessExpiresAt: grantedEnrollment?.accessExpiresAt ?? null,
    gracePeriodEndsAt: grantedEnrollment?.gracePeriodEndsAt ?? null,
  };
}
