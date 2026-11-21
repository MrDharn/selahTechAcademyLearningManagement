import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { verifyCertificateByNumber } from '../controllers/certificateController';

export const certificateVerificationRoutes = Router();

// Public endpoint, so it is rate limited to stop people guessing certificate numbers.
const certificateVerificationRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { errorMessage: 'Too many checks. Please try again in a few minutes.', errorCode: 'TOO_MANY_ATTEMPTS' },
});

certificateVerificationRoutes.get('/:certificateNumber', certificateVerificationRateLimiter, verifyCertificateByNumber);
