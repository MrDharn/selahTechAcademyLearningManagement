import { Router } from 'express';
import {
  listMyScholarshipApplications,
  listScholarshipCourses,
  submitScholarshipApplication,
} from '../controllers/scholarshipController';
import { requireAuthentication } from '../middleware/authenticationMiddleware';
import { requireUserRole } from '../middleware/roleBasedAccessControlMiddleware';

export const scholarshipRoutes = Router();

// Public: anyone can see what the program offers before creating an account.
scholarshipRoutes.get('/courses', listScholarshipCourses);

scholarshipRoutes.post('/applications', requireAuthentication, requireUserRole('STUDENT'), submitScholarshipApplication);
scholarshipRoutes.get('/applications/me', requireAuthentication, requireUserRole('STUDENT'), listMyScholarshipApplications);
