import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
  changeMyPassword,
  getMyAccount,
  removeMyProfilePicture,
  setMyProfilePicture,
  updateMyProfile,
} from '../controllers/accountController';
import { requireAuthentication } from '../middleware/authenticationMiddleware';

export const accountRoutes = Router();

accountRoutes.use(requireAuthentication);

// Stops someone with a stolen session from guessing the current password.
const passwordChangeRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { errorMessage: 'Too many attempts. Please try again in a few minutes.', errorCode: 'TOO_MANY_ATTEMPTS' },
});

accountRoutes.get('/', getMyAccount);
accountRoutes.patch('/profile', updateMyProfile);
accountRoutes.put('/profile-picture', setMyProfilePicture);
accountRoutes.delete('/profile-picture', removeMyProfilePicture);
accountRoutes.put('/password', passwordChangeRateLimiter, changeMyPassword);
