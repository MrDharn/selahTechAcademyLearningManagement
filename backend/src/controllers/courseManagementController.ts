import { z } from 'zod';
import { prismaDatabaseClient } from '../database/prismaDatabaseClient';
import {
  assertUserCanManageCourse,
  assertUserCanManageLesson,
  assertUserCanManageModule,
} from '../services/courseOwnershipService';
import { ApplicationError } from '../utilities/ApplicationError';
import { asyncRequestHandler } from '../utilities/asyncRequestHandler';

const createCourseRequestSchema = z.object({
  title: z.string().trim().min(3),
  description: z.string().trim().min(10),
  priceInKobo: z.number().int().min(0),
});

const updateCourseRequestSchema = createCourseRequestSchema
  .partial()
  .extend({ isPublished: z.boolean().optional(), isScholarshipAvailable: z.boolean().optional() });

const createModuleRequestSchema = z.object({ title: z.string().trim().min(2), isIncludedInScholarship: z.boolean().optional() });
const updateModuleRequestSchema = z.object({
  title: z.string().trim().min(2).optional(),
  sequenceOrderNumber: z.number().int().min(1).optional(),
  isIncludedInScholarship: z.boolean().optional(),
});

const createLessonRequestSchema = z.object({
  title: z.string().trim().min(2),
  description: z.string().trim().nullable().optional(),
});
const updateLessonRequestSchema = z.object({
  title: z.string().trim().min(2).optional(),
  description: z.string().trim().nullable().optional(),
  sequenceOrderNumber: z.number().int().min(1).optional(),
});

export const listCoursesManagedByCurrentUser = asyncRequestHandler(async (request, response) => {
  const authenticatedUser = request.authenticatedUser!;

  const managedCourses = await prismaDatabaseClient.course.findMany({
    where: authenticatedUser.userRole === 'ADMIN' ? {} : { instructorUserId: authenticatedUser.userId },
    orderBy: { createdAt: 'desc' },
    include: {
      instructorUser: { select: { fullName: true } },
      _count: { select: { enrollments: true, courseModules: true } },
    },
  });

  response.json({
    courses: managedCourses.map((course) => ({
      courseId: course.id,
      title: course.title,
      priceInKobo: course.priceInKobo,
      isPublished: course.isPublished,
      thumbnailImageUrl: course.thumbnailImageUrl,
      instructorFullName: course.instructorUser.fullName,
      moduleCount: course._count.courseModules,
      enrolledStudentCount: course._count.enrollments,
    })),
  });
});

export const createCourse = asyncRequestHandler(async (request, response) => {
  const newCourseDetails = createCourseRequestSchema.parse(request.body);

  const createdCourse = await prismaDatabaseClient.course.create({
    data: { ...newCourseDetails, instructorUserId: request.authenticatedUser!.userId },
  });

  response.status(201).json({ course: createdCourse });
});

export const getCourseForEditing = asyncRequestHandler(async (request, response) => {
  await assertUserCanManageCourse(request.authenticatedUser!, request.params.courseId);

  const courseWithFullStructure = await prismaDatabaseClient.course.findUniqueOrThrow({
    where: { id: request.params.courseId },
    include: {
      courseModules: {
        orderBy: { sequenceOrderNumber: 'asc' },
        include: {
          lessons: {
            orderBy: { sequenceOrderNumber: 'asc' },
            include: { assessment: { select: { id: true, title: true, passMarkPercentage: true } } },
          },
        },
      },
    },
  });

  response.json({ course: courseWithFullStructure });
});

export const updateCourse = asyncRequestHandler(async (request, response) => {
  await assertUserCanManageCourse(request.authenticatedUser!, request.params.courseId);
  const courseChanges = updateCourseRequestSchema.parse(request.body);

  if (courseChanges.isPublished === true) {
    const numberOfLessonsInCourse = await prismaDatabaseClient.lesson.count({
      where: { courseModule: { courseId: request.params.courseId } },
    });
    if (numberOfLessonsInCourse === 0) {
      throw new ApplicationError(409, 'Add at least one lesson before publishing this course.', 'COURSE_HAS_NO_LESSONS');
    }
  }

  const updatedCourse = await prismaDatabaseClient.course.update({
    where: { id: request.params.courseId },
    data: courseChanges,
  });

  response.json({ course: updatedCourse });
});

/**
 * Deletes a draft course together with its modules, lessons, assessments and scholarship applications.
 * Allowed for the course's instructor and for administrators. A published course, or a course that already has
 * students or payments, is never deleted (unpublish first; student history is kept).
 */
export const deleteDraftCourse = asyncRequestHandler(async (request, response) => {
  const courseToDelete = await assertUserCanManageCourse(request.authenticatedUser!, request.params.courseId);

  if (courseToDelete.isPublished) {
    throw new ApplicationError(409, 'Only a draft course can be deleted. Unpublish this course first.', 'COURSE_IS_PUBLISHED');
  }

  const [numberOfEnrollments, numberOfPayments] = await Promise.all([
    prismaDatabaseClient.enrollment.count({ where: { courseId: courseToDelete.id } }),
    prismaDatabaseClient.payment.count({ where: { courseId: courseToDelete.id } }),
  ]);
  if (numberOfEnrollments > 0 || numberOfPayments > 0) {
    throw new ApplicationError(
      409,
      'This course has students or payment records, so it cannot be deleted. Keep it unpublished instead.',
      'COURSE_HAS_STUDENT_HISTORY',
    );
  }

  await prismaDatabaseClient.course.delete({ where: { id: courseToDelete.id } });
  response.status(204).send();
});

export const createCourseModule = asyncRequestHandler(async (request, response) => {
  await assertUserCanManageCourse(request.authenticatedUser!, request.params.courseId);
  const newModuleDetails = createModuleRequestSchema.parse(request.body);

  const highestExistingSequence = await prismaDatabaseClient.courseModule.aggregate({
    where: { courseId: request.params.courseId },
    _max: { sequenceOrderNumber: true },
  });

  const createdModule = await prismaDatabaseClient.courseModule.create({
    data: {
      courseId: request.params.courseId,
      title: newModuleDetails.title,
      isIncludedInScholarship: newModuleDetails.isIncludedInScholarship ?? true,
      sequenceOrderNumber: (highestExistingSequence._max.sequenceOrderNumber ?? 0) + 1,
    },
  });

  response.status(201).json({ courseModule: createdModule });
});

export const updateCourseModule = asyncRequestHandler(async (request, response) => {
  await assertUserCanManageModule(request.authenticatedUser!, request.params.courseModuleId);
  const moduleChanges = updateModuleRequestSchema.parse(request.body);

  const updatedModule = await prismaDatabaseClient.courseModule.update({
    where: { id: request.params.courseModuleId },
    data: moduleChanges,
  });

  response.json({ courseModule: updatedModule });
});

export const deleteCourseModule = asyncRequestHandler(async (request, response) => {
  await assertUserCanManageModule(request.authenticatedUser!, request.params.courseModuleId);
  await prismaDatabaseClient.courseModule.delete({ where: { id: request.params.courseModuleId } });
  response.status(204).send();
});

export const createLesson = asyncRequestHandler(async (request, response) => {
  await assertUserCanManageModule(request.authenticatedUser!, request.params.courseModuleId);
  const newLessonDetails = createLessonRequestSchema.parse(request.body);

  const highestExistingSequence = await prismaDatabaseClient.lesson.aggregate({
    where: { courseModuleId: request.params.courseModuleId },
    _max: { sequenceOrderNumber: true },
  });

  const createdLesson = await prismaDatabaseClient.lesson.create({
    data: {
      courseModuleId: request.params.courseModuleId,
      title: newLessonDetails.title,
      description: newLessonDetails.description ?? null,
      sequenceOrderNumber: (highestExistingSequence._max.sequenceOrderNumber ?? 0) + 1,
    },
  });

  response.status(201).json({ lesson: createdLesson });
});

export const updateLesson = asyncRequestHandler(async (request, response) => {
  await assertUserCanManageLesson(request.authenticatedUser!, request.params.lessonId);
  const lessonChanges = updateLessonRequestSchema.parse(request.body);

  const updatedLesson = await prismaDatabaseClient.lesson.update({
    where: { id: request.params.lessonId },
    data: lessonChanges,
  });

  response.json({ lesson: updatedLesson });
});

export const deleteLesson = asyncRequestHandler(async (request, response) => {
  await assertUserCanManageLesson(request.authenticatedUser!, request.params.lessonId);
  await prismaDatabaseClient.lesson.delete({ where: { id: request.params.lessonId } });
  response.status(204).send();
});
