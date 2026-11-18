import { Router } from 'express';
import {
  createUserAccountWithRole,
  getPlatformStatistics,
  listAllPayments,
  listAllUsers,
  listScholarshipApplications,
  reviewScholarshipApplication,
  updateUserAccount,
} from '../controllers/adminController';
import { requireAuthentication } from '../middleware/authenticationMiddleware';
import { requireUserRole } from '../middleware/roleBasedAccessControlMiddleware';

export const adminRoutes = Router();

adminRoutes.use(requireAuthentication, requireUserRole('ADMIN'));

adminRoutes.get('/statistics', getPlatformStatistics);
adminRoutes.get('/users', listAllUsers);
adminRoutes.post('/users', createUserAccountWithRole);
adminRoutes.patch('/users/:userId', updateUserAccount);
adminRoutes.get('/payments', listAllPayments);
adminRoutes.get('/scholarship-applications', listScholarshipApplications);
adminRoutes.patch('/scholarship-applications/:scholarshipApplicationId', reviewScholarshipApplication);
