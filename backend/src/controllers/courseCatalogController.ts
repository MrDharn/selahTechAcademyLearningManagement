import { z } from 'zod';
import { prismaDatabaseClient } from '../database/prismaDatabaseClient';
import { ApplicationError } from '../utilities/ApplicationError';
import { asyncRequestHandler } from '../utilities/asyncRequestHandler';
import { compareCoursesForSort, summarizeRatings } from '../rules/courseRatingRules';

const catalogQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  category: z.string().trim().max(40).optional(),
  sort: z.enum(['newest', 'price_low_to_high', 'price_high_to_low', 'top_rated', 'most_popular']).optional(),
});

/** Public: "Explore Courses" step of the user journey, with search, category filter and sorting. */
export const listPublishedCourses = asyncRequestHandler(async (request, response) => {
  const { search, category, sort = 'newest' } = catalogQuerySchema.parse(request.query);

  const allPublishedCourses = await prismaDatabaseClient.course.findMany({
    where: { isPublished: true },
    include: {
      instructorUser: { select: { fullName: true } },
      courseModules: { select: { _count: { select: { lessons: true } } } },
      reviews: { select: { ratingOutOfFive: true } },
      _count: { select: { enrollments: true } },
    },
  });

  const availableCategories = [...new Set(allPublishedCourses.map((course) => course.category))].sort();

  const searchText = search?.toLowerCase();
  const matchingCourses = allPublishedCourses
    .filter((course) => !category || course.category === category)
    .filter(
      (course) =>
        !searchText ||
        course.title.toLowerCase().includes(searchText) ||
        course.description.toLowerCase().includes(searchText) ||
        course.category.toLowerCase().includes(searchText) ||
        course.instructorUser.fullName.toLowerCase().includes(searchText),
    )
    .map((course) => ({
      course,
      createdAt: course.createdAt,
      priceInKobo: course.priceInKobo,
      enrolledStudentCount: course._count.enrollments,
      ...summarizeRatings(course.reviews.map((review) => review.ratingOutOfFive)),
    }))
    .sort(compareCoursesForSort(sort));

  response.json({
    availableCategories,
    courses: matchingCourses.map(({ course, averageRating, reviewCount }) => ({
      courseId: course.id,
      title: course.title,
      description: course.description,
      category: course.category,
      priceInKobo: course.priceInKobo,
      thumbnailImageUrl: course.thumbnailImageUrl,
      instructorFullName: course.instructorUser.fullName,
      moduleCount: course.courseModules.length,
      lessonCount: course.courseModules.reduce((runningTotal, courseModule) => runningTotal + courseModule._count.lessons, 0),
      averageRating,
      reviewCount,
    })),
  });
});

/** Public course outline. Video identifiers are deliberately NOT included. */
export const getPublishedCourseDetails = asyncRequestHandler(async (request, response) => {
  const matchingCourse = await prismaDatabaseClient.course.findFirst({
    where: { id: request.params.courseId, isPublished: true },
    include: {
      instructorUser: { select: { fullName: true } },
      reviews: { select: { ratingOutOfFive: true } },
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

  const { averageRating, reviewCount } = summarizeRatings(matchingCourse.reviews.map((review) => review.ratingOutOfFive));
  const ratingSummary = { averageRating, reviewCount };

  response.json({
    course: {
      courseId: matchingCourse.id,
      title: matchingCourse.title,
      description: matchingCourse.description,
      priceInKobo: matchingCourse.priceInKobo,
      thumbnailImageUrl: matchingCourse.thumbnailImageUrl,
      category: matchingCourse.category,
      ...ratingSummary,
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
