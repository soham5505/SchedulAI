import { app } from './app.js';
import { env } from './config/env.js';
import { connectDatabase, disconnectDatabase } from './config/database.js';
import { Logger } from './utils/logger.js';

const logger = new Logger('Server');

async function bootstrap() {
  await connectDatabase();

  const server = app.listen(env.port, '0.0.0.0', () => {
    logger.info(`🚀 SchedulAI API Server running in ${env.NODE_ENV} mode on http://0.0.0.0:${env.port}`);
    logger.info(`🔗 Health endpoint: http://0.0.0.0:${env.port}/health`);
    logger.info(`🔗 API Base: http://0.0.0.0:${env.port}/api/v1`);
  });

  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}. Shutting down gracefully...`);
    server.close(async () => {
      await disconnectDatabase();
      logger.info('HTTP server closed.');
      process.exit(0);
    });

    setTimeout(() => {
      logger.error('Forcing server shutdown after timeout.');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

bootstrap().catch((error) => {
  logger.error(`Failed to start server: ${(error as Error).message}`, error.stack);
  process.exit(1);
});
