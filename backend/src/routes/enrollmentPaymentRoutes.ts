import { Router } from 'express';
import {
  getCoursePurchaseQuote,
  handlePaystackWebhook,
  initiateCoursePayment,
  listMyEnrollments,
  listMyPayments,
  verifyCoursePayment,
} from '../controllers/enrollmentPaymentController';
import { requireAuthentication } from '../middleware/authenticationMiddleware';

export const enrollmentPaymentRoutes = Router();

// Public: authenticated by Paystack's HMAC signature instead of a JWT.
enrollmentPaymentRoutes.post('/paystack-webhook', handlePaystackWebhook);

enrollmentPaymentRoutes.get('/courses/:courseId/quote', requireAuthentication, getCoursePurchaseQuote);
enrollmentPaymentRoutes.post('/courses/:courseId/initialize', requireAuthentication, initiateCoursePayment);
enrollmentPaymentRoutes.get('/verify/:paystackReference', requireAuthentication, verifyCoursePayment);
enrollmentPaymentRoutes.get('/me', requireAuthentication, listMyPayments);
enrollmentPaymentRoutes.get('/enrollments/me', requireAuthentication, listMyEnrollments);
