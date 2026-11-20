import { environmentConfiguration } from '../configuration/environmentConfiguration';
import { prismaDatabaseClient } from '../database/prismaDatabaseClient';
import { sendEmail } from './emailDeliveryService';
import { buildPaymentSuccessEmail, buildRegistrationWelcomeEmail } from './emailTemplates';

/**
 * Both functions are "fire and forget": call them WITHOUT await so the student never waits for the mail server.
 * They catch everything themselves, so they can never crash the request that triggered them.
 */
export async function notifyStudentOfSuccessfulRegistration(registeredStudent: { fullName: string; emailAddress: string }): Promise<void> {
  try {
    await sendEmail(
      buildRegistrationWelcomeEmail({
        recipientEmailAddress: registeredStudent.emailAddress,
        studentFullName: registeredStudent.fullName,
        signInPageUrl: `${environmentConfiguration.frontendBaseUrl}/login`,
        coursesPageUrl: `${environmentConfiguration.frontendBaseUrl}/courses`,
      }),
    );
  } catch (notificationError) {
    console.error('Could not prepare the registration e-mail:', notificationError);
  }
}

export async function notifyStudentOfSuccessfulPayment(paystackReference: string): Promise<void> {
  try {
    const completedPayment = await prismaDatabaseClient.payment.findUnique({ where: { paystackReference } });
    if (!completedPayment || completedPayment.paymentStatus !== 'SUCCESSFUL') return;

    const [paidStudent, purchasedCourse, grantedEnrollment] = await Promise.all([
      prismaDatabaseClient.user.findUnique({ where: { id: completedPayment.studentUserId } }),
      prismaDatabaseClient.course.findUnique({ where: { id: completedPayment.courseId } }),
      prismaDatabaseClient.enrollment.findUnique({
        where: { studentUserId_courseId: { studentUserId: completedPayment.studentUserId, courseId: completedPayment.courseId } },
      }),
    ]);
    if (!paidStudent || !purchasedCourse) return;

    await sendEmail(
      buildPaymentSuccessEmail({
        recipientEmailAddress: paidStudent.emailAddress,
        studentFullName: paidStudent.fullName,
        courseTitle: purchasedCourse.title,
        amountPaidInKobo: completedPayment.amountInKobo,
        paymentReference: completedPayment.paystackReference,
        paymentCompletedAt: completedPayment.paidAt ?? new Date(),
        accessExpiresAt: grantedEnrollment?.accessExpiresAt ?? null,
        gracePeriodEndsAt: grantedEnrollment?.gracePeriodEndsAt ?? null,
        isScholarshipPayment: completedPayment.isScholarshipPayment,
        myLearningPageUrl: `${environmentConfiguration.frontendBaseUrl}/my-learning`,
      }),
    );
  } catch (notificationError) {
    console.error('Could not prepare the payment e-mail:', notificationError);
  }
}
