import { z } from 'zod';
import { prismaDatabaseClient } from '../database/prismaDatabaseClient';
import { createAuthorizedHlsStreamingUrl, getInstructorCloudinaryCredentials } from '../services/cloudinaryMultiAccountService';
import { issueCertificateIfStudentHasCompletedCourse } from '../services/certificateService';
import {
  buildStudentCourseProgress,
  markLessonAsCompletedForStudent,
  saveLastWatchedPosition,
} from '../services/courseProgressService';
import { resolveCourseAccessForUser } from '../services/enrollmentAccessService';
import { ApplicationError } from '../utilities/ApplicationError';
import { asyncRequestHandler } from '../utilities/asyncRequestHandler';

const watchPositionRequestSchema = z.object({ lastWatchedPositionInSeconds: z.number().int().min(0) });

/** Course outline + per-lesson locked/completed state for the lesson sidebar. */
export const getCourseProgress = asyncRequestHandler(async (request, response) => {
  const authenticatedUser = request.authenticatedUser!;
  const courseId = request.params.courseId;

  const resolvedCourseAccess = await resolveCourseAccessForUser(authenticatedUser, courseId);

  if (resolvedCourseAccess.courseAccessStatus === 'NOT_ENROLLED') {
    throw new ApplicationError(403, 'Enroll in this course to see your progress.', 'NOT_ENROLLED');
  }
  if (resolvedCourseAccess.courseAccessStatus === 'EXPIRED') {
    throw new ApplicationError(403, 'Your access to this course has expired. Renew it to continue.', 'ACCESS_EXPIRED');
  }

  const matchingCourse = await prismaDatabaseClient.course.findUniqueOrThrow({
    where: { id: courseId },
    select: { title: true },
  });

  const studentCourseProgress = await buildStudentCourseProgress(authenticatedUser.userId, courseId);

  // Instructors and admins preview everything, so nothing is shown as locked for them.
  const lessonsForDisplay = resolvedCourseAccess.isPrivilegedViewer
    ? studentCourseProgress.lessons.map((lesson) => ({ ...lesson, isUnlocked: true }))
    : studentCourseProgress.lessons;

  response.json({
    courseTitle: matchingCourse.title,
    courseAccessStatus: resolvedCourseAccess.courseAccessStatus,
    enrollmentType: resolvedCourseAccess.enrollment?.enrollmentType ?? null,
    accessExpiresAt: resolvedCourseAccess.enrollment?.accessExpiresAt ?? null,
    gracePeriodEndsAt: resolvedCourseAccess.enrollment?.gracePeriodEndsAt ?? null,
    progress: { ...studentCourseProgress, lessons: lessonsForDisplay },
  });
});

/** Step 4: "Get Authorized Video URL -> Stream via Cloudinary". Guards already ran before this handler. */
export const getAuthorizedLessonStream = asyncRequestHandler(async (request, response) => {
  const lessonAccessContext = request.lessonAccessContext!;

  const lessonToStream = await prismaDatabaseClient.lesson.findUniqueOrThrow({
    where: { id: lessonAccessContext.lessonId },
    include: { courseModule: { include: { course: { select: { instructorUserId: true } } } } },
  });

  if (!lessonToStream.cloudinaryVideoPublicId) {
    throw new ApplicationError(404, 'The instructor has not uploaded a video for this lesson yet.', 'VIDEO_NOT_UPLOADED');
  }

  const courseOwnerCredentials = await getInstructorCloudinaryCredentials(lessonToStream.courseModule.course.instructorUserId);
  const hlsStreamingUrl = createAuthorizedHlsStreamingUrl(courseOwnerCredentials, lessonToStream.cloudinaryVideoPublicId);

  const studentProgressRecord = await prismaDatabaseClient.lessonProgress.findUnique({
    where: { studentUserId_lessonId: { studentUserId: request.authenticatedUser!.userId, lessonId: lessonToStream.id } },
  });

  const enrollmentForDisplay = await prismaDatabaseClient.enrollment.findUnique({
    where: { studentUserId_courseId: { studentUserId: request.authenticatedUser!.userId, courseId: lessonAccessContext.courseId } },
  });

  response.json({
    lessonId: lessonToStream.id,
    lessonTitle: lessonToStream.title,
    lessonDescription: lessonToStream.description,
    hlsStreamingUrl,
    lastWatchedPositionInSeconds: studentProgressRecord?.lastWatchedPositionInSeconds ?? 0,
    isLessonCompleted: studentProgressRecord?.isCompleted ?? false,
    courseAccessStatus: lessonAccessContext.courseAccessStatus,
    accessExpiresAt: enrollmentForDisplay?.accessExpiresAt ?? null,
    gracePeriodEndsAt: enrollmentForDisplay?.gracePeriodEndsAt ?? null,
  });
});

export const saveLessonWatchPosition = asyncRequestHandler(async (request, response) => {
  const { lastWatchedPositionInSeconds } = watchPositionRequestSchema.parse(request.body);
  await saveLastWatchedPosition(request.authenticatedUser!.userId, request.lessonAccessContext!.lessonId, lastWatchedPositionInSeconds);
  response.status(204).send();
});

/** For lessons WITHOUT a quiz. Lessons with a quiz are completed by passing the assessment. */
export const markLessonAsCompleted = asyncRequestHandler(async (request, response) => {
  const lessonAccessContext = request.lessonAccessContext!;
  const studentUserId = request.authenticatedUser!.userId;

  const assessmentForLesson = await prismaDatabaseClient.assessment.findUnique({ where: { lessonId: lessonAccessContext.lessonId } });
  if (assessmentForLesson) {
    throw new ApplicationError(409, 'This lesson has an assessment. Pass it to complete the lesson.', 'ASSESSMENT_REQUIRED');
  }

  await markLessonAsCompletedForStudent(studentUserId, lessonAccessContext.lessonId);

  const issuedCertificate = await issueCertificateIfStudentHasCompletedCourse(studentUserId, lessonAccessContext.courseId);
  const updatedCourseProgress = await buildStudentCourseProgress(studentUserId, lessonAccessContext.courseId);

  response.json({
    completionPercentage: updatedCourseProgress.completionPercentage,
    isCourseFullyCompleted: updatedCourseProgress.isCourseFullyCompleted,
    isCertificateIssued: issuedCertificate !== null,
  });
});
