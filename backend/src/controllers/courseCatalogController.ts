import { prismaDatabaseClient } from '../database/prismaDatabaseClient';
import { ApplicationError } from '../utilities/ApplicationError';
import { asyncRequestHandler } from '../utilities/asyncRequestHandler';

/** Public: "Explore Courses" step of the user journey. */
export const listPublishedCourses = asyncRequestHandler(async (_request, response) => {
  const publishedCourses = await prismaDatabaseClient.course.findMany({
    where: { isPublished: true },
    orderBy: { createdAt: 'desc' },
    include: {
      instructorUser: { select: { fullName: true } },
      courseModules: { select: { _count: { select: { lessons: true } } } },
    },
  });

  response.json({
    courses: publishedCourses.map((course) => ({
      courseId: course.id,
      title: course.title,
      description: course.description,
      priceInKobo: course.priceInKobo,
      thumbnailImageUrl: course.thumbnailImageUrl,
      instructorFullName: course.instructorUser.fullName,
      moduleCount: course.courseModules.length,
      lessonCount: course.courseModules.reduce((runningTotal, courseModule) => runningTotal + courseModule._count.lessons, 0),
    })),
  });
});

/** Public course outline. Video identifiers are deliberately NOT included. */
export const getPublishedCourseDetails = asyncRequestHandler(async (request, response) => {
  const matchingCourse = await prismaDatabaseClient.course.findFirst({
    where: { id: request.params.courseId, isPublished: true },
    include: {
      instructorUser: { select: { fullName: true } },
      courseModules: {
        orderBy: { sequenceOrderNumber: 'asc' },
        include: {
          lessons: {
            orderBy: { sequenceOrderNumber: 'asc' },
            select: { id: true, title: true, description: true, videoDurationInSeconds: true, sequenceOrderNumber: true },
          },
        },
      },
    },
  });

  if (!matchingCourse) {
    throw new ApplicationError(404, 'Course not found.', 'COURSE_NOT_FOUND');
  }

  response.json({
    course: {
      courseId: matchingCourse.id,
      title: matchingCourse.title,
      description: matchingCourse.description,
      priceInKobo: matchingCourse.priceInKobo,
      thumbnailImageUrl: matchingCourse.thumbnailImageUrl,
      instructorFullName: matchingCourse.instructorUser.fullName,
      modules: matchingCourse.courseModules.map((courseModule) => ({
        courseModuleId: courseModule.id,
        title: courseModule.title,
        lessons: courseModule.lessons.map((lesson) => ({
          lessonId: lesson.id,
          title: lesson.title,
          description: lesson.description,
          videoDurationInSeconds: lesson.videoDurationInSeconds,
        })),
      })),
    },
  });
});
