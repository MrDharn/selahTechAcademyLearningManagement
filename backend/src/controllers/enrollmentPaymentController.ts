import { randomBytes } from 'crypto';
import PDFDocument from 'pdfkit';
import { z } from 'zod';
import { prismaDatabaseClient } from '../database/prismaDatabaseClient';
import { buildStudentCourseProgress } from '../services/courseProgressService';
import { determineCourseAccessStatus, grantOrRenewEnrollment } from '../services/enrollmentAccessService';
import { fulfillPaymentByPaystackReference } from '../services/paymentFulfillmentService';
import { buildCoursePurchaseQuote } from '../services/coursePurchaseQuoteService';
import { resetStudentCourseProgressForRetake } from '../services/courseRetakeService';
import { calculateScholarshipPriceInKobo } from '../services/scholarshipPricingService';
import { notifyStudentOfSuccessfulPayment } from '../services/studentNotificationService';
import { initializePaystackTransaction, isPaystackWebhookSignatureValid } from '../services/paystackPaymentService';
import { ApplicationError } from '../utilities/ApplicationError';
import { asyncRequestHandler } from '../utilities/asyncRequestHandler';
import { drawPaymentReceipt } from '../services/paymentReceiptPdfRenderer';

const initiatePaymentRequestSchema = z.object({ isScholarshipPurchase: z.boolean().optional() }).default({});

function generatePaystackReference(): string {
  return `STA-${Date.now()}-${randomBytes(4).toString('hex')}`;
}

/**
 * A scholarship purchase needs: a published course that offers scholarships with at least one included module,
 * an APPROVED application by this student, and no full-course enrollment that would be downgraded.
 */
async function validateScholarshipPurchaseAndGetPrice(
  studentUserId: string,
  courseToPurchase: { id: string; priceInKobo: number; isScholarshipAvailable: boolean },
): Promise<number> {
  if (!courseToPurchase.isScholarshipAvailable) {
    throw new ApplicationError(400, 'This course is not part of the scholarship program.', 'SCHOLARSHIP_NOT_AVAILABLE');
  }

  const approvedApplication = await prismaDatabaseClient.scholarshipApplication.findUnique({
    where: { applicantUserId_courseId: { applicantUserId: studentUserId, courseId: courseToPurchase.id } },
  });
  if (approvedApplication?.applicationStatus !== 'APPROVED') {
    throw new ApplicationError(403, 'Your scholarship application for this course has not been approved yet.', 'SCHOLARSHIP_NOT_APPROVED');
  }

  const numberOfModulesIncludedInScholarship = await prismaDatabaseClient.courseModule.count({
    where: { courseId: courseToPurchase.id, isIncludedInScholarship: true },
  });
  if (numberOfModulesIncludedInScholarship === 0) {
    throw new ApplicationError(400, 'No sections of this course are currently available for scholarship.', 'SCHOLARSHIP_HAS_NO_MODULES');
  }

  const existingEnrollment = await prismaDatabaseClient.enrollment.findUnique({
    where: { studentUserId_courseId: { studentUserId, courseId: courseToPurchase.id } },
  });
  if (existingEnrollment?.enrollmentType === 'STANDARD') {
    throw new ApplicationError(409, 'You already have the full course, so a scholarship purchase is not needed.', 'ALREADY_FULL_ENROLLMENT');
  }

  return calculateScholarshipPriceInKobo(courseToPurchase.priceInKobo);
}

const purchaseQuoteQuerySchema = z.object({ isScholarshipPurchase: z.enum(['true', 'false']).optional() });

/** The price (and why) a signed-in student would pay right now: first purchase, renewal by progress, or retake. */
export const getCoursePurchaseQuote = asyncRequestHandler(async (request, response) => {
  const authenticatedUser = request.authenticatedUser!;
  const { isScholarshipPurchase } = purchaseQuoteQuerySchema.parse(request.query);
  const isScholarshipQuote = isScholarshipPurchase === 'true';

  const courseToQuote = await prismaDatabaseClient.course.findFirst({ where: { id: request.params.courseId, isPublished: true } });
  if (!courseToQuote) throw new ApplicationError(404, 'Course not found or not available for purchase.', 'COURSE_NOT_FOUND');

  const basePriceInKobo = isScholarshipQuote
    ? await validateScholarshipPurchaseAndGetPrice(authenticatedUser.userId, courseToQuote)
    : courseToQuote.priceInKobo;

  const purchaseQuote = await buildCoursePurchaseQuote({
    studentUserId: authenticatedUser.userId,
    courseId: courseToQuote.id,
    basePriceInKobo,
    isScholarshipPurchase: isScholarshipQuote,
  });

  response.json({ ...purchaseQuote, fullCoursePriceInKobo: courseToQuote.priceInKobo });
});

/** Step 3 of the user journey: "Enroll & Pay (Paystack)". */
export const initiateCoursePayment = asyncRequestHandler(async (request, response) => {
  const authenticatedUser = request.authenticatedUser!;

  const courseToPurchase = await prismaDatabaseClient.course.findFirst({
    where: { id: request.params.courseId, isPublished: true },
  });
  if (!courseToPurchase) {
    throw new ApplicationError(404, 'Course not found or not available for purchase.', 'COURSE_NOT_FOUND');
  }

  const { isScholarshipPurchase = false } = initiatePaymentRequestSchema.parse(request.body ?? {});
  const paystackReference = generatePaystackReference();

  const basePriceInKobo = isScholarshipPurchase
    ? await validateScholarshipPurchaseAndGetPrice(authenticatedUser.userId, courseToPurchase)
    : courseToPurchase.priceInKobo;

  // First purchase = normal price. Renewal = half of what is left of the course. Retake (100% covered) = retake price.
  const purchaseQuote = await buildCoursePurchaseQuote({
    studentUserId: authenticatedUser.userId,
    courseId: courseToPurchase.id,
    basePriceInKobo,
    isScholarshipPurchase,
  });
  const amountToChargeInKobo = purchaseQuote.amountInKobo;

  // Free course: enroll immediately, no gateway involved.
  if (amountToChargeInKobo === 0) {
    const paymentCompletedAt = new Date();
    await prismaDatabaseClient.$transaction(async (databaseTransactionClient) => {
      await databaseTransactionClient.payment.create({
        data: {
          studentUserId: authenticatedUser.userId,
          courseId: courseToPurchase.id,
          paystackReference,
          amountInKobo: 0,
          isScholarshipPayment: isScholarshipPurchase,
          paymentKind: purchaseQuote.purchaseKind,
          paymentStatus: 'SUCCESSFUL',
          paidAt: paymentCompletedAt,
        },
      });
      await grantOrRenewEnrollment(databaseTransactionClient, {
        studentUserId: authenticatedUser.userId,
        courseId: courseToPurchase.id,
        paymentCompletedAt,
        purchasedEnrollmentType: isScholarshipPurchase ? 'SCHOLARSHIP' : 'STANDARD',
      });
      if (purchaseQuote.purchaseKind === 'RETAKE') {
        await resetStudentCourseProgressForRetake(databaseTransactionClient, authenticatedUser.userId, courseToPurchase.id);
      }
    });
    void notifyStudentOfSuccessfulPayment(paystackReference);
    return response.status(201).json({ isFreeCourseEnrollmentComplete: true, paystackReference });
  }

  const createdPendingPayment = await prismaDatabaseClient.payment.create({
    data: {
      studentUserId: authenticatedUser.userId,
      courseId: courseToPurchase.id,
      paystackReference,
      amountInKobo: amountToChargeInKobo,
      isScholarshipPayment: isScholarshipPurchase,
      paymentKind: purchaseQuote.purchaseKind,
      paymentStatus: 'PENDING',
    },
  });

  try {
    const initializedTransaction = await initializePaystackTransaction({
      customerEmailAddress: authenticatedUser.emailAddress,
      amountInKobo: amountToChargeInKobo,
      paystackReference,
      courseId: courseToPurchase.id,
      studentUserId: authenticatedUser.userId,
    });

    await prismaDatabaseClient.payment.update({
      where: { id: createdPendingPayment.id },
      data: { paystackAuthorizationUrl: initializedTransaction.authorization_url },
    });

    response.status(201).json({
      isFreeCourseEnrollmentComplete: false,
      paystackReference,
      paystackAuthorizationUrl: initializedTransaction.authorization_url,
    });
  } catch (paystackInitializationError) {
    await prismaDatabaseClient.payment.update({ where: { id: createdPendingPayment.id }, data: { paymentStatus: 'FAILED' } });
    throw paystackInitializationError;
  }
});

/** Called by the frontend after Paystack redirects the student back. */
export const verifyCoursePayment = asyncRequestHandler(async (request, response) => {
  const authenticatedUser = request.authenticatedUser!;

  const matchingPayment = await prismaDatabaseClient.payment.findUnique({
    where: { paystackReference: request.params.paystackReference },
  });

  if (!matchingPayment || (matchingPayment.studentUserId !== authenticatedUser.userId && authenticatedUser.userRole !== 'ADMIN')) {
    throw new ApplicationError(404, 'No payment was found for this reference.', 'PAYMENT_NOT_FOUND');
  }

  const fulfillmentResult = await fulfillPaymentByPaystackReference(request.params.paystackReference);
  response.json(fulfillmentResult);
});

/** Paystack -> our server. Public route; trust comes from the HMAC signature, not from a JWT. */
export const handlePaystackWebhook = asyncRequestHandler(async (request, response) => {
  const receivedSignature = request.headers['x-paystack-signature'];
  const signatureAsString = Array.isArray(receivedSignature) ? receivedSignature[0] : receivedSignature;

  if (!isPaystackWebhookSignatureValid(request.rawRequestBody, signatureAsString)) {
    throw new ApplicationError(401, 'Invalid webhook signature.', 'INVALID_WEBHOOK_SIGNATURE');
  }

  const webhookEvent = request.body as { event?: string; data?: { reference?: string } };

  if (webhookEvent.event === 'charge.success' && webhookEvent.data?.reference) {
    try {
      await fulfillPaymentByPaystackReference(webhookEvent.data.reference);
    } catch (fulfillmentError) {
      const isUnknownReference = fulfillmentError instanceof ApplicationError && fulfillmentError.httpStatusCode === 404;
      if (!isUnknownReference) throw fulfillmentError; // non-2xx makes Paystack retry the webhook
    }
  }

  response.status(200).json({ received: true });
});

export const listMyEnrollments = asyncRequestHandler(async (request, response) => {
  const studentUserId = request.authenticatedUser!.userId;

  const studentEnrollments = await prismaDatabaseClient.enrollment.findMany({
    where: { studentUserId },
    orderBy: { enrolledAt: 'desc' },
    include: { course: { select: { id: true, title: true, description: true, thumbnailImageUrl: true } } },
  });

  const enrollmentsWithProgress = await Promise.all(
    studentEnrollments.map(async (enrollment) => {
      const courseProgress = await buildStudentCourseProgress(studentUserId, enrollment.courseId);
      const nextLessonToWatch = courseProgress.lessons.find((lesson) => !lesson.isCompleted && lesson.isUnlocked) ?? null;

      return {
        enrollmentId: enrollment.id,
        courseId: enrollment.course.id,
        courseTitle: enrollment.course.title,
        courseDescription: enrollment.course.description,
        thumbnailImageUrl: enrollment.course.thumbnailImageUrl,
        enrollmentType: enrollment.enrollmentType,
        accessStatus: determineCourseAccessStatus(enrollment),
        accessExpiresAt: enrollment.accessExpiresAt,
        gracePeriodEndsAt: enrollment.gracePeriodEndsAt,
        completionPercentage: courseProgress.completionPercentage,
        completedLessonCount: courseProgress.completedLessonCount,
        totalLessonCount: courseProgress.totalLessonCount,
        nextLessonIdToWatch: nextLessonToWatch?.lessonId ?? null,
      };
    }),
  );

  response.json({ enrollments: enrollmentsWithProgress });
});

export const listMyPayments = asyncRequestHandler(async (request, response) => {
  const studentPayments = await prismaDatabaseClient.payment.findMany({
    where: { studentUserId: request.authenticatedUser!.userId },
    orderBy: { createdAt: 'desc' },
    include: { course: { select: { title: true } } },
  });

  response.json({
    payments: studentPayments.map((payment) => ({
      paymentId: payment.id,
      courseTitle: payment.course.title,
      paystackReference: payment.paystackReference,
      amountInKobo: payment.amountInKobo,
      isScholarshipPayment: payment.isScholarshipPayment,
      paymentKind: payment.paymentKind,
      paymentStatus: payment.paymentStatus,
      paidAt: payment.paidAt,
      createdAt: payment.createdAt,
    })),
  });
});

/** The signed-in student's own receipt for a SUCCESSFUL payment, as a PDF. */
export const downloadPaymentReceipt = asyncRequestHandler(async (request, response) => {
  const authenticatedUserId = request.authenticatedUser!.userId;

  const paymentToReceipt = await prismaDatabaseClient.payment.findFirst({
    where: { paystackReference: request.params.paystackReference, studentUserId: authenticatedUserId },
    include: { course: { select: { title: true } }, studentUser: { select: { fullName: true, emailAddress: true } } },
  });
  if (!paymentToReceipt || paymentToReceipt.paymentStatus !== 'SUCCESSFUL' || !paymentToReceipt.paidAt) {
    throw new ApplicationError(404, 'No receipt is available for this payment. Receipts exist only for successful payments.', 'RECEIPT_NOT_AVAILABLE');
  }

  const receiptDocument = new PDFDocument({ size: 'A4', margin: 0 });
  response.setHeader('Content-Type', 'application/pdf');
  response.setHeader('Content-Disposition', `attachment; filename="receipt-${paymentToReceipt.paystackReference}.pdf"`);
  receiptDocument.pipe(response);

  drawPaymentReceipt(receiptDocument, {
    receiptNumber: paymentToReceipt.paystackReference,
    paidAt: paymentToReceipt.paidAt,
    studentFullName: paymentToReceipt.studentUser.fullName,
    studentEmailAddress: paymentToReceipt.studentUser.emailAddress,
    courseTitle: paymentToReceipt.course.title,
    paymentKind: paymentToReceipt.paymentKind,
    isScholarshipPayment: paymentToReceipt.isScholarshipPayment,
    amountInKobo: paymentToReceipt.amountInKobo,
  });

  receiptDocument.end();
});
