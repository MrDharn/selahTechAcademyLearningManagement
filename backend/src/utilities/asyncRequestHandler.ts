import type { NextFunction, Request, RequestHandler, Response } from 'express';

type AsynchronousRequestHandlerFunction = (
  request: Request,
  response: Response,
  nextMiddlewareFunction: NextFunction,
) => Promise<unknown>;

/** Forwards rejected promises to the Express error handler (Express 4 does not do this itself). */
export function asyncRequestHandler(handlerFunction: AsynchronousRequestHandlerFunction): RequestHandler {
  return (request, response, nextMiddlewareFunction) => {
    handlerFunction(request, response, nextMiddlewareFunction).catch(nextMiddlewareFunction);
  };
}
