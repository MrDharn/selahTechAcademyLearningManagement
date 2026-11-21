import { createApplicationServer } from './applicationServer';
import { environmentConfiguration } from './configuration/environmentConfiguration';
import { prismaDatabaseClient } from './database/prismaDatabaseClient';
import { startBackgroundWorker, stopBackgroundWorker } from './services/backgroundWorker';

async function startServer() {
  await prismaDatabaseClient.$connect();

  const applicationServer = createApplicationServer();

  const httpServer = applicationServer.listen(environmentConfiguration.serverPortNumber, () => {
    console.log(`SelahTech Academy LMS API listening on port ${environmentConfiguration.serverPortNumber}`);
  });

  startBackgroundWorker();

  const shutDownGracefully = async (receivedSignalName: string) => {
    console.log(`${receivedSignalName} received. Shutting down...`);
    stopBackgroundWorker();
    httpServer.close(async () => {
      await prismaDatabaseClient.$disconnect();
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutDownGracefully('SIGTERM'));
  process.on('SIGINT', () => shutDownGracefully('SIGINT'));
}

startServer().catch((startupError) => {
  console.error('Failed to start the server:', startupError);
  process.exit(1);
});
