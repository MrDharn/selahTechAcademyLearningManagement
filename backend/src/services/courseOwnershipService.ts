import type { UserRole } from '@prisma/client';
import { prismaDatabaseClient } from '../database/prismaDatabaseClient';
import { ApplicationError } from '../utilities/ApplicationError';

type UserMakingRequest = { userId: string; userRole: UserRole };

function assertUserOwnsCourseOrIsAdministrator(userMakingRequest: UserMakingRequest, courseOwnerUserId: string) {
  const isAdministrator = userMakingRequest.userRole === 'ADMIN';
  const isCourseOwner = userMakingRequest.userId === courseOwnerUserId;

  if (!isAdministrator && !isCourseOwner) {
    throw new ApplicationError(403, 'You can only manage your own courses.', 'NOT_COURSE_OWNER');
  }
}

export async function assertUserCanManageCourse(userMakingRequest: UserMakingRequest, courseId: string) {
  const matchingCourse = await prismaDatabaseClient.course.findUnique({ where: { id: courseId } });
  if (!matchingCourse) throw new ApplicationError(404, 'Course not found.', 'COURSE_NOT_FOUND');

  assertUserOwnsCourseOrIsAdministrator(userMakingRequest, matchingCourse.instructorUserId);
  return matchingCourse;
}

export async function assertUserCanManageModule(userMakingRequest: UserMakingRequest, courseModuleId: string) {
  const matchingModule = await prismaDatabaseClient.courseModule.findUnique({
    where: { id: courseModuleId },
    include: { course: true },
  });
  if (!matchingModule) throw new ApplicationError(404, 'Module not found.', 'MODULE_NOT_FOUND');

  assertUserOwnsCourseOrIsAdministrator(userMakingRequest, matchingModule.course.instructorUserId);
  return matchingModule;
}

export async function assertUserCanManageLesson(userMakingRequest: UserMakingRequest, lessonId: string) {
  const matchingLesson = await prismaDatabaseClient.lesson.findUnique({
    where: { id: lessonId },
    include: { courseModule: { include: { course: true } } },
  });
  if (!matchingLesson) throw new ApplicationError(404, 'Lesson not found.', 'LESSON_NOT_FOUND');

  assertUserOwnsCourseOrIsAdministrator(userMakingRequest, matchingLesson.courseModule.course.instructorUserId);
  return matchingLesson;
}
