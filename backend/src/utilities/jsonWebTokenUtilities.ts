import jwt from 'jsonwebtoken';
import type { UserRole } from '@prisma/client';
import { environmentConfiguration } from '../configuration/environmentConfiguration';
import { ApplicationError } from './ApplicationError';

export interface AuthenticationTokenPayload {
  userId: string;
  userRole: UserRole;
  emailAddress: string;
}

export function createAuthenticationToken(tokenPayload: AuthenticationTokenPayload): string {
  return jwt.sign(tokenPayload, environmentConfiguration.jsonWebTokenSecret, {
    expiresIn: environmentConfiguration.jsonWebTokenExpiresIn as jwt.SignOptions['expiresIn'],
  });
}

export function verifyAuthenticationToken(authenticationToken: string): AuthenticationTokenPayload {
  try {
    const decodedPayload = jwt.verify(authenticationToken, environmentConfiguration.jsonWebTokenSecret) as jwt.JwtPayload;
    return {
      userId: decodedPayload.userId as string,
      userRole: decodedPayload.userRole as UserRole,
      emailAddress: decodedPayload.emailAddress as string,
    };
  } catch {
    throw new ApplicationError(401, 'Your session is invalid or has expired. Please sign in again.', 'INVALID_TOKEN');
  }
}
