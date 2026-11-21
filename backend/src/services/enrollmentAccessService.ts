import type { Enrollment, EnrollmentType, Prisma, UserRole } from '@prisma/client';
import { environmentConfiguration } from '../configuration/environmentConfiguration';
import { prismaDatabaseClient } from '../database/prismaDatabaseClient';
import type { CourseAccessStatus } from '../types/courseAccessStatus';
import { ApplicationError } from '../utilities/ApplicationError';
import { addMonthsToDate } from '../utilities/calendarDateUtilities';

export function determineCourseAccessStatus(
  enrollmentAccessDates: Pick<Enrollment, 'accessExpiresAt' | 'gracePeriodEndsAt'>,
  currentDate: Date = new Date(),
): 'ACTIVE' | 'GRACE_PERIOD' | 'EXPIRED' {
  if (currentDate <= enrollmentAccessDates.accessExpiresAt) return 'ACTIVE';
  if (currentDate <= enrollmentAccessDates.gracePeriodEndsAt) return 'GRACE_PERIOD';
  return 'EXPIRED';
}

/**
 * Creates the enrollment on first payment. On a repeat payment it renews:
 * time is added on top of whatever paid time is still left, otherwise it starts from the payment date.
 */
export async function grantOrRenewEnrollment(
  databaseTransactionClient: Prisma.TransactionClient,
  enrollmentDetails: { studentUserId: string; courseId: string; paymentCompletedAt: Date; purchasedEnrollmentType: EnrollmentType },
): Promise<Enrollment> {
  const existingEnrollment = await databaseTransactionClient.enrollment.findUnique({
    where: {
      studentUserId_courseId: {
        studentUserId: enrollmentDetails.studentUserId,
        courseId: enrollmentDetails.courseId,
      },
    },
  });

  const renewalStartingPoint =
    existingEnrollment && existingEnrollment.accessExpiresAt > enrollmentDetails.paymentCompletedAt
      ? existingEnrollment.accessExpiresAt
      : enrollmentDetails.paymentCompletedAt;

  // A scholarship payment never downgrades a student who already owns the full course.
  const resultingEnrollmentType: EnrollmentType =
    existingEnrollment?.enrollmentType === 'STANDARD' ? 'STANDARD' : enrollmentDetails.purchasedEnrollmentType;

  const newAccessExpiresAt = addMonthsToDate(renewalStartingPoint, environmentConfiguration.courseAccessDurationInMonths);
  const newGracePeriodEndsAt = addMonthsToDate(newAccessExpiresAt, environmentConfiguration.courseAccessGracePeriodInMonths);

  return databaseTransactionClient.enrollment.upsert({
    where: {
      studentUserId_courseId: {
        studentUserId: enrollmentDetails.studentUserId,
        courseId: enrollmentDetails.courseId,
      },
    },
    create: {
      studentUserId: enrollmentDetails.studentUserId,
      courseId: enrollmentDetails.courseId,
      enrolledAt: enrollmentDetails.paymentCompletedAt,
      enrollmentType: resultingEnrollmentType,
      accessExpiresAt: newAccessExpiresAt,
      gracePeriodEndsAt: newGracePeriodEndsAt,
    },
    update: {
      enrollmentType: resultingEnrollmentType,
      accessExpiresAt: newAccessExpiresAt,
      gracePeriodEndsAt: newGracePeriodEndsAt,
      // A renewed enrollment gets fresh reminders for its new dates.
      expiryReminderSentAt: null,
      graceReminderSentAt: null,
    },
  });
}

export interface ResolvedCourseAccess {
  courseAccessStatus: CourseAccessStatus;
  isPrivilegedViewer: boolean;
  enrollment: Enrollment | null;
}

/** Decides what the signed-in user may do with a course: owner/admin, enrolled student, or outsider. */
export async function resolveCourseAccessForUser(
  authenticatedUser: { userId: string; userRole: UserRole },
  courseId: string,
): Promise<ResolvedCourseAccess> {
  const matchingCourse = await prismaDatabaseClient.course.findUnique({
    where: { id: courseId },
    select: { instructorUserId: true },
  });

  if (!matchingCourse) {
    throw new ApplicationError(404, 'Course not found.', 'COURSE_NOT_FOUND');
  }

  const isCourseOwnerInstructor = matchingCourse.instructorUserId === authenticatedUser.userId;
  const isAdministrator = authenticatedUser.userRole === 'ADMIN';

  if (isCourseOwnerInstructor || isAdministrator) {
    return { courseAccessStatus: 'PRIVILEGED_VIEWER', isPrivilegedViewer: true, enrollment: null };
  }

  const matchingEnrollment = await prismaDatabaseClient.enrollment.findUnique({
    where: { studentUserId_courseId: { studentUserId: authenticatedUser.userId, courseId } },
  });

  if (!matchingEnrollment) {
    return { courseAccessStatus: 'NOT_ENROLLED', isPrivilegedViewer: false, enrollment: null };
  }

  return {
    courseAccessStatus: determineCourseAccessStatus(matchingEnrollment),
    isPrivilegedViewer: false,
    enrollment: matchingEnrollment,
  };
}
