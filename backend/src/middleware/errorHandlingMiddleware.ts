import { Prisma } from '@prisma/client';
import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { environmentConfiguration } from '../configuration/environmentConfiguration';
import { ApplicationError } from '../utilities/ApplicationError';

export function handleRouteNotFound(request: Request, _response: Response, nextMiddlewareFunction: NextFunction) {
  nextMiddlewareFunction(new ApplicationError(404, `Route not found: ${request.method} ${request.originalUrl}`, 'ROUTE_NOT_FOUND'));
}

export function handleApplicationErrors(
  caughtError: unknown,
  _request: Request,
  response: Response,
  _nextMiddlewareFunction: NextFunction,
) {
  if (caughtError instanceof ApplicationError) {
    return response.status(caughtError.httpStatusCode).json({
      errorMessage: caughtError.message,
      errorCode: caughtError.machineReadableErrorCode,
    });
  }

  if (caughtError instanceof ZodError) {
    return response.status(400).json({
      errorMessage: 'The submitted data is invalid.',
      errorCode: 'VALIDATION_FAILED',
      validationIssues: caughtError.issues.map((validationIssue) => ({
        fieldPath: validationIssue.path.join('.'),
        issueDescription: validationIssue.message,
      })),
    });
  }

  if (caughtError instanceof Prisma.PrismaClientKnownRequestError) {
    if (caughtError.code === 'P2002') {
      return response.status(409).json({ errorMessage: 'A record with these details already exists.', errorCode: 'DUPLICATE_RECORD' });
    }
    if (caughtError.code === 'P2025') {
      return response.status(404).json({ errorMessage: 'The requested record was not found.', errorCode: 'RECORD_NOT_FOUND' });
    }
  }

  console.error('Unexpected server error:', caughtError);

  return response.status(500).json({
    errorMessage: environmentConfiguration.isProductionEnvironment
      ? 'Something went wrong on our side. Please try again.'
      : String((caughtError as Error)?.message ?? caughtError),
    errorCode: 'INTERNAL_SERVER_ERROR',
  });
}
