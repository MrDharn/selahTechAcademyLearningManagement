import { z } from 'zod';
import { prismaDatabaseClient } from '../database/prismaDatabaseClient';
import { formatReviewerDisplayName, summarizeRatings } from '../rules/courseRatingRules';
import { ApplicationError } from '../utilities/ApplicationError';
import { asyncRequestHandler } from '../utilities/asyncRequestHandler';

const reviewRequestSchema = z.object({
  ratingOutOfFive: z.number().int().min(1).max(5),
  reviewText: z.string().trim().max(1000).optional(),
});

/** Public: the newest 50 reviews of a published course, plus the rating summary. The signed-in student's own review is flagged. */
export const listCourseReviews = asyncRequestHandler(async (request, response) => {
  const course = await prismaDatabaseClient.course.findFirst({ where: { id: request.params.courseId, isPublished: true }, select: { id: true } });
  if (!course) throw new ApplicationError(404, 'Course not found.', 'COURSE_NOT_FOUND');

  const allReviews = await prismaDatabaseClient.courseReview.findMany({
    where: { courseId: course.id },
    orderBy: { createdAt: 'desc' },
    include: { studentUser: { select: { fullName: true } } },
  });

  const signedInUserId = request.authenticatedUser?.userId;
  response.json({
    ...summarizeRatings(allReviews.map((review) => review.ratingOutOfFive)),
    reviews: allReviews.slice(0, 50).map((review) => ({
      reviewId: review.id,
      reviewerDisplayName: formatReviewerDisplayName(review.studentUser.fullName),
      ratingOutOfFive: review.ratingOutOfFive,
      reviewText: review.reviewText,
      createdAt: review.createdAt,
      isMyReview: review.studentUserId === signedInUserId,
    })),
  });
});

/** Creates or edits the signed-in student's review. Only students who are (or were) enrolled may review. */
export const saveMyCourseReview = asyncRequestHandler(async (request, response) => {
  const studentUserId = request.authenticatedUser!.userId;
  const { ratingOutOfFive, reviewText } = reviewRequestSchema.parse(request.body);

  const enrollment = await prismaDatabaseClient.enrollment.findUnique({
    where: { studentUserId_courseId: { studentUserId, courseId: request.params.courseId } },
  });
  if (!enrollment) {
    throw new ApplicationError(403, 'Only students enrolled in this course can review it.', 'REVIEW_REQUIRES_ENROLLMENT');
  }

  const savedReview = await prismaDatabaseClient.courseReview.upsert({
    where: { courseId_studentUserId: { courseId: request.params.courseId, studentUserId } },
    create: { courseId: request.params.courseId, studentUserId, ratingOutOfFive, reviewText: reviewText || null },
    update: { ratingOutOfFive, reviewText: reviewText || null },
  });

  response.status(201).json({ reviewId: savedReview.id });
});

export const deleteMyCourseReview = asyncRequestHandler(async (request, response) => {
  await prismaDatabaseClient.courseReview.deleteMany({
    where: { courseId: request.params.courseId, studentUserId: request.authenticatedUser!.userId },
  });
  response.status(204).send();
});
