import { Router } from 'express';
import { getPublishedCourseDetails, listPublishedCourses } from '../controllers/courseCatalogController';
import { deleteMyCourseReview, listCourseReviews, saveMyCourseReview } from '../controllers/courseReviewController';
import { attachAuthenticatedUserIfPresent, requireAuthentication } from '../middleware/authenticationMiddleware';
import { requireUserRole } from '../middleware/roleBasedAccessControlMiddleware';

export const courseCatalogRoutes = Router();

courseCatalogRoutes.get('/', listPublishedCourses);
courseCatalogRoutes.get('/:courseId', getPublishedCourseDetails);

courseCatalogRoutes.get('/:courseId/reviews', attachAuthenticatedUserIfPresent, listCourseReviews);
courseCatalogRoutes.post('/:courseId/reviews', requireAuthentication, requireUserRole('STUDENT'), saveMyCourseReview);
courseCatalogRoutes.delete('/:courseId/reviews/mine', requireAuthentication, requireUserRole('STUDENT'), deleteMyCourseReview);
