import type { NextFunction, Request, Response } from 'express';
import { prismaDatabaseClient } from '../database/prismaDatabaseClient';
import { buildStudentCourseProgress } from '../services/courseProgressService';
import { resolveCourseAccessForUser } from '../services/enrollmentAccessService';
import { ApplicationError } from '../utilities/ApplicationError';

/**
 * "Access Expiry Guard (Check access_expires_at)" from the architecture diagram.
 * Runs on every lesson route. Students need an ACTIVE or GRACE_PERIOD enrollment;
 * the course's own instructor and administrators always pass.
 */
export async function requireActiveCourseAccessForLesson(request: Request, _response: Response, nextMiddlewareFunction: NextFunction) {
  try {
    const authenticatedUser = request.authenticatedUser!;
    const requestedLessonId = request.params.lessonId;

    const matchingLesson = await prismaDatabaseClient.lesson.findUnique({
      where: { id: requestedLessonId },
      select: { id: true, courseModule: { select: { courseId: true, isIncludedInScholarship: true } } },
    });

    if (!matchingLesson) {
      throw new ApplicationError(404, 'Lesson not found.', 'LESSON_NOT_FOUND');
    }

    const courseId = matchingLesson.courseModule.courseId;
    const resolvedCourseAccess = await resolveCourseAccessForUser(authenticatedUser, courseId);

    if (resolvedCourseAccess.courseAccessStatus === 'NOT_ENROLLED') {
      throw new ApplicationError(403, 'Enroll in this course to watch its lessons.', 'NOT_ENROLLED');
    }

    if (resolvedCourseAccess.courseAccessStatus === 'EXPIRED') {
      throw new ApplicationError(403, 'Your access to this course has expired. Renew it to continue.', 'ACCESS_EXPIRED');
    }

    const isScholarshipStudent = resolvedCourseAccess.enrollment?.enrollmentType === 'SCHOLARSHIP';
    if (isScholarshipStudent && !matchingLesson.courseModule.isIncludedInScholarship) {
      throw new ApplicationError(
        403,
        'This section is not part of the scholarship program. Upgrade to the full course to unlock it.',
        'NOT_INCLUDED_IN_SCHOLARSHIP',
      );
    }

    request.lessonAccessContext = {
      lessonId: matchingLesson.id,
      courseId,
      courseAccessStatus: resolvedCourseAccess.courseAccessStatus,
      isPrivilegedViewer: resolvedCourseAccess.isPrivilegedViewer,
    };

    nextMiddlewareFunction();
  } catch (accessGuardError) {
    nextMiddlewareFunction(accessGuardError);
  }
}

/** Sequential learning: a student can only open a lesson after completing the previous one. Runs after the expiry guard. */
export async function requireLessonToBeUnlocked(request: Request, _response: Response, nextMiddlewareFunction: NextFunction) {
  try {
    const lessonAccessContext = request.lessonAccessContext;
    if (!lessonAccessContext) {
      throw new ApplicationError(500, 'Lesson access context is missing. Use the expiry guard first.');
    }

    if (lessonAccessContext.isPrivilegedViewer) return nextMiddlewareFunction();

    const studentCourseProgress = await buildStudentCourseProgress(request.authenticatedUser!.userId, lessonAccessContext.courseId);
    const requestedLessonProgress = studentCourseProgress.lessons.find((lesson) => lesson.lessonId === lessonAccessContext.lessonId);

    if (!requestedLessonProgress?.isUnlocked) {
      throw new ApplicationError(403, 'Complete the previous lesson to unlock this one.', 'LESSON_LOCKED');
    }

    nextMiddlewareFunction();
  } catch (lessonLockError) {
    nextMiddlewareFunction(lessonLockError);
  }
}
