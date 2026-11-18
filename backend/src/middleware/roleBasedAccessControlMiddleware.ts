import type { UserRole } from '@prisma/client';
import type { NextFunction, Request, Response } from 'express';
import { ApplicationError } from '../utilities/ApplicationError';

/** "RBAC (Student / Instructor / Admin)" from the architecture diagram. Must run after requireAuthentication. */
export function requireUserRole(...allowedUserRoles: UserRole[]) {
  return (request: Request, _response: Response, nextMiddlewareFunction: NextFunction) => {
    const authenticatedUser = request.authenticatedUser;

    if (!authenticatedUser) {
      return nextMiddlewareFunction(new ApplicationError(401, 'Authentication is required.', 'MISSING_TOKEN'));
    }

    if (!allowedUserRoles.includes(authenticatedUser.userRole)) {
      return nextMiddlewareFunction(
        new ApplicationError(403, 'You do not have permission to perform this action.', 'INSUFFICIENT_ROLE'),
      );
    }

    nextMiddlewareFunction();
  };
}
