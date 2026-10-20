import mongoose from 'mongoose';
import { env } from './env';
import { logger } from './logger';

mongoose.set('strictQuery', true);
// Query-selector injection is prevented by validating every input with zod (plain
// strings/numbers only) before it reaches a filter — see utils/validate.ts.

export async function connectDb(uri: string = env.MONGO_URI): Promise<typeof mongoose> {
  const conn = await mongoose.connect(uri, {
    autoIndex: env.MONGO_AUTO_INDEX,
    maxPoolSize: 20,
    serverSelectionTimeoutMS: 10_000,
  });
  logger.info({ db: conn.connection.name }, 'MongoDB connected');
  return conn;
}

export async function disconnectDb(): Promise<void> {
  await mongoose.disconnect();
}
