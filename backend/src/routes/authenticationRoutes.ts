import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { getCurrentlySignedInUser, loginUser, registerStudentAccount } from '../controllers/authenticationController';
import { requireAuthentication } from '../middleware/authenticationMiddleware';

export const authenticationRoutes = Router();

// Slows down password-guessing: 20 attempts per 15 minutes per IP address.
const authenticationAttemptRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { errorMessage: 'Too many attempts. Please try again in a few minutes.', errorCode: 'TOO_MANY_ATTEMPTS' },
});

authenticationRoutes.post('/register', authenticationAttemptRateLimiter, registerStudentAccount);
authenticationRoutes.post('/login', authenticationAttemptRateLimiter, loginUser);
authenticationRoutes.get('/me', requireAuthentication, getCurrentlySignedInUser);
