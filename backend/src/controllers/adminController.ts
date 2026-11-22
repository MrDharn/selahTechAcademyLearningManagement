import { z } from 'zod';
import { prismaDatabaseClient } from '../database/prismaDatabaseClient';
import { ApplicationError } from '../utilities/ApplicationError';
import { asyncRequestHandler } from '../utilities/asyncRequestHandler';
import { hashPlainTextPassword } from '../utilities/passwordHashingUtilities';
import { toPublicUserRepresentation } from '../utilities/publicUserRepresentation';

const userRoleSchema = z.enum(['STUDENT', 'INSTRUCTOR', 'ADMIN']);

const createUserAccountRequestSchema = z.object({
  fullName: z.string().trim().min(2),
  emailAddress: z.string().trim().toLowerCase().email(),
  password: z.string().min(8),
  userRole: userRoleSchema,
});

const reviewScholarshipApplicationRequestSchema = z.object({
  applicationStatus: z.enum(['APPROVED', 'REJECTED']),
  reviewerNote: z.string().trim().max(1000).nullable().optional(),
});

const updateUserAccountRequestSchema = z.object({
  userRole: userRoleSchema.optional(),
  isAccountActive: z.boolean().optional(),
});

export const getPlatformStatistics = asyncRequestHandler(async (_request, response) => {
  const [studentCount, instructorCount, administratorCount, courseCount, publishedCourseCount, enrollmentCount, successfulPaymentTotals] =
    await Promise.all([
      prismaDatabaseClient.user.count({ where: { userRole: 'STUDENT' } }),
      prismaDatabaseClient.user.count({ where: { userRole: 'INSTRUCTOR' } }),
      prismaDatabaseClient.user.count({ where: { userRole: 'ADMIN' } }),
      prismaDatabaseClient.course.count(),
      prismaDatabaseClient.course.count({ where: { isPublished: true } }),
      prismaDatabaseClient.enrollment.count(),
      prismaDatabaseClient.payment.aggregate({ where: { paymentStatus: 'SUCCESSFUL' }, _sum: { amountInKobo: true } }),
    ]);

  response.json({
    studentCount,
    instructorCount,
    administratorCount,
    courseCount,
    publishedCourseCount,
    enrollmentCount,
    totalRevenueInKobo: successfulPaymentTotals._sum.amountInKobo ?? 0,
  });
});

export const listAllUsers = asyncRequestHandler(async (_request, response) => {
  const allUsers = await prismaDatabaseClient.user.findMany({ orderBy: { createdAt: 'desc' } });
  response.json({ users: allUsers.map((listedUser) => toPublicUserRepresentation(listedUser, false)) });
});

export const createUserAccountWithRole = asyncRequestHandler(async (request, response) => {
  const newUserDetails = createUserAccountRequestSchema.parse(request.body);

  const userWithSameEmailAddress = await prismaDatabaseClient.user.findUnique({ where: { emailAddress: newUserDetails.emailAddress } });
  if (userWithSameEmailAddress) {
    throw new ApplicationError(409, 'An account with this email address already exists.', 'EMAIL_ALREADY_REGISTERED');
  }

  const createdUser = await prismaDatabaseClient.user.create({
    data: {
      fullName: newUserDetails.fullName,
      emailAddress: newUserDetails.emailAddress,
      hashedPassword: await hashPlainTextPassword(newUserDetails.password),
      userRole: newUserDetails.userRole,
    },
  });

  response.status(201).json({ user: toPublicUserRepresentation(createdUser) });
});

export const updateUserAccount = asyncRequestHandler(async (request, response) => {
  const accountChanges = updateUserAccountRequestSchema.parse(request.body);

  if (request.params.userId === request.authenticatedUser!.userId) {
    throw new ApplicationError(400, 'You cannot change your own role or deactivate your own account.', 'CANNOT_MODIFY_SELF');
  }

  const updatedUser = await prismaDatabaseClient.user.update({ where: { id: request.params.userId }, data: accountChanges });
  response.json({ user: toPublicUserRepresentation(updatedUser) });
});

export const listScholarshipApplications = asyncRequestHandler(async (request, response) => {
  const requestedStatus = z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional().parse(request.query.applicationStatus);

  const scholarshipApplications = await prismaDatabaseClient.scholarshipApplication.findMany({
    where: requestedStatus ? { applicationStatus: requestedStatus } : {},
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: {
      applicantUser: { select: { fullName: true, emailAddress: true } },
      course: { select: { title: true } },
    },
  });

  response.json({
    applications: scholarshipApplications.map((application) => ({
      scholarshipApplicationId: application.id,
      applicantFullName: application.applicantUser.fullName,
      applicantEmailAddress: application.applicantUser.emailAddress,
      phoneNumber: application.phoneNumber,
      currentOccupation: application.currentOccupation,
      motivationStatement: application.motivationStatement,
      courseTitle: application.course.title,
      applicationStatus: application.applicationStatus,
      reviewerNote: application.reviewerNote,
      submittedAt: application.createdAt,
      reviewedAt: application.reviewedAt,
    })),
  });
});

export const reviewScholarshipApplication = asyncRequestHandler(async (request, response) => {
  const reviewDecision = reviewScholarshipApplicationRequestSchema.parse(request.body);

  const matchingApplication = await prismaDatabaseClient.scholarshipApplication.findUnique({ where: { id: request.params.scholarshipApplicationId } });
  if (!matchingApplication) {
    throw new ApplicationError(404, 'Scholarship application not found.', 'SCHOLARSHIP_APPLICATION_NOT_FOUND');
  }

  const reviewedApplication = await prismaDatabaseClient.scholarshipApplication.update({
    where: { id: matchingApplication.id },
    data: {
      applicationStatus: reviewDecision.applicationStatus,
      reviewerNote: reviewDecision.reviewerNote ?? null,
      reviewedByUserId: request.authenticatedUser!.userId,
      reviewedAt: new Date(),
    },
  });

  response.json({ scholarshipApplicationId: reviewedApplication.id, applicationStatus: reviewedApplication.applicationStatus });
});

export const listAllPayments = asyncRequestHandler(async (_request, response) => {
  const latestPayments = await prismaDatabaseClient.payment.findMany({
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: {
      studentUser: { select: { fullName: true, emailAddress: true } },
      course: { select: { title: true } },
    },
  });

  response.json({
    payments: latestPayments.map((payment) => ({
      paymentId: payment.id,
      studentFullName: payment.studentUser.fullName,
      studentEmailAddress: payment.studentUser.emailAddress,
      courseTitle: payment.course.title,
      paystackReference: payment.paystackReference,
      amountInKobo: payment.amountInKobo,
      isScholarshipPayment: payment.isScholarshipPayment,
      paymentStatus: payment.paymentStatus,
      paidAt: payment.paidAt,
      createdAt: payment.createdAt,
    })),
  });
});
