import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { environmentConfiguration } from './configuration/environmentConfiguration';
import { handleApplicationErrors, handleRouteNotFound } from './middleware/errorHandlingMiddleware';
import { applicationRoutes } from './routes/applicationRoutes';

export function createApplicationServer() {
  const applicationServer = express();

  applicationServer.disable('x-powered-by');
  applicationServer.use(helmet());
  applicationServer.use(cors({ origin: environmentConfiguration.allowedCorsOrigins, credentials: true }));
  applicationServer.use(morgan(environmentConfiguration.isProductionEnvironment ? 'combined' : 'dev'));

  // Keep the exact bytes of every JSON body: the Paystack webhook signature is computed over the raw payload.
  applicationServer.use(
    express.json({
      limit: '1mb',
      verify: (incomingRequest, _serverResponse, rawBodyBuffer) => {
        (incomingRequest as express.Request).rawRequestBody = rawBodyBuffer;
      },
    }),
  );

  applicationServer.use('/api', applicationRoutes);

  applicationServer.use(handleRouteNotFound);
  applicationServer.use(handleApplicationErrors);

  return applicationServer;
}
