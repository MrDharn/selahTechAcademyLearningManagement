import type { UserRole } from '@prisma/client';
import type { CourseAccessStatus } from './courseAccessStatus';

declare global {
  namespace Express {
    interface Request {
      authenticatedUser?: {
        userId: string;
        userRole: UserRole;
        emailAddress: string;
      };
      /** Raw request bytes, kept so the Paystack webhook signature can be verified. */
      rawRequestBody?: Buffer;
      lessonAccessContext?: {
        lessonId: string;
        courseId: string;
        courseAccessStatus: CourseAccessStatus;
        isPrivilegedViewer: boolean;
      };
    }
  }
}

export {};
