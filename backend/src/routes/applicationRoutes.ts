import { Router } from 'express';
import { adminRoutes } from './adminRoutes';
import { authenticationRoutes } from './authenticationRoutes';
import { courseCatalogRoutes } from './courseCatalogRoutes';
import { enrollmentPaymentRoutes } from './enrollmentPaymentRoutes';
import { instructorRoutes } from './instructorRoutes';
import { learningRoutes } from './learningRoutes';
import { scholarshipRoutes } from './scholarshipRoutes';

export const applicationRoutes = Router();

applicationRoutes.get('/health', (_request, response) => {
  response.json({ status: 'ok', serviceName: 'selahtech-academy-lms-backend' });
});

applicationRoutes.use('/authentication', authenticationRoutes);
applicationRoutes.use('/courses', courseCatalogRoutes);
applicationRoutes.use('/payments', enrollmentPaymentRoutes);
applicationRoutes.use('/learning', learningRoutes);
applicationRoutes.use('/scholarship', scholarshipRoutes);
applicationRoutes.use('/instructor', instructorRoutes);
applicationRoutes.use('/admin', adminRoutes);
