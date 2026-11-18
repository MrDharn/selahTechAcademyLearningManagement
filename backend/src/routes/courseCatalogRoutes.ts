import { Router } from 'express';
import { getPublishedCourseDetails, listPublishedCourses } from '../controllers/courseCatalogController';

export const courseCatalogRoutes = Router();

courseCatalogRoutes.get('/', listPublishedCourses);
courseCatalogRoutes.get('/:courseId', getPublishedCourseDetails);
