import { env } from './config/env';
import { logger } from './config/logger';
import { connectDb, disconnectDb } from './config/db';
import { createApp } from './app';
import { syncAdmins } from './services/adminAccounts';

async function main() {
  await connectDb();
  const admins = await syncAdmins();
  logger.info({ listed: env.ADMIN_PHONES.length, ...admins }, 'Admin accounts synced');
  const app = createApp();
  const server = app.listen(env.PORT, () => {
    logger.info(`🏏 PlayLocal API listening on http://localhost:${env.PORT}`);
  });

  const shutdown = (signal: string) => {
    logger.info({ signal }, 'Shutting down');
    server.close(async () => {
      await disconnectDb();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  logger.fatal({ err }, 'Failed to start server');
  process.exit(1);
});
