import type { NextFunction, Request, Response } from 'express';
import { prismaDatabaseClient } from '../database/prismaDatabaseClient';
import { ApplicationError } from '../utilities/ApplicationError';
import { verifyAuthenticationToken } from '../utilities/jsonWebTokenUtilities';

/** "Auth Middleware (Verify JWT)" from the architecture diagram. */
export async function requireAuthentication(request: Request, _response: Response, nextMiddlewareFunction: NextFunction) {
  try {
    const authorizationHeaderValue = request.headers.authorization;

    if (!authorizationHeaderValue || !authorizationHeaderValue.startsWith('Bearer ')) {
      throw new ApplicationError(401, 'Authentication is required. Send a Bearer token.', 'MISSING_TOKEN');
    }

    const authenticationToken = authorizationHeaderValue.slice('Bearer '.length).trim();
    const verifiedTokenPayload = verifyAuthenticationToken(authenticationToken);

    const matchingUser = await prismaDatabaseClient.user.findUnique({
      where: { id: verifiedTokenPayload.userId },
      select: { id: true, userRole: true, emailAddress: true, isAccountActive: true },
    });

    if (!matchingUser || !matchingUser.isAccountActive) {
      throw new ApplicationError(401, 'This account no longer exists or has been deactivated.', 'ACCOUNT_UNAVAILABLE');
    }

    request.authenticatedUser = {
      userId: matchingUser.id,
      userRole: matchingUser.userRole,
      emailAddress: matchingUser.emailAddress,
    };

    nextMiddlewareFunction();
  } catch (authenticationError) {
    nextMiddlewareFunction(authenticationError);
  }
}

/** Like requireAuthentication, but anonymous visitors are allowed through (request.authenticatedUser stays undefined). */
export async function attachAuthenticatedUserIfPresent(request: Request, response: Response, nextMiddlewareFunction: NextFunction) {
  if (!request.headers.authorization) {
    nextMiddlewareFunction();
    return;
  }
  await requireAuthentication(request, response, (possibleError?: unknown) => {
    // An expired or invalid token on a public page is treated as "not signed in".
    void possibleError;
    nextMiddlewareFunction();
  });
}
