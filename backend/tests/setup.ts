import { inject, beforeAll, afterAll, beforeEach } from 'vitest';

// Env must be set before any app module (config/env.ts) is imported.
process.env.NODE_ENV = 'test';
process.env.MONGO_URI = `${inject('mongoUri')}playlocal-test-${process.pid}`;
process.env.JWT_SECRET = 'test-secret-test-secret-test-secret-1234567890';
process.env.BCRYPT_ROUNDS = '4';
process.env.STORAGE_DRIVER = 'local';
process.env.UPLOAD_DIR = `${(await import('node:os')).tmpdir()}/playlocal-test-uploads`;
process.env.GEOCODING_ENABLED = 'false';
process.env.CLIENT_ORIGINS = 'http://localhost:5173';

const { default: mongoose } = await import('mongoose');
const { connectDb } = await import('../src/config/db');
const models = await import('../src/models');

beforeAll(async () => {
  await connectDb(process.env.MONGO_URI);
  await Promise.all(Object.values(models).map((m) => m.init()));
});

beforeEach(async () => {
  const collections = await mongoose.connection.db!.collections();
  await Promise.all(collections.map((c) => c.deleteMany({})));
});

afterAll(async () => {
  await mongoose.connection.db?.dropDatabase();
  await mongoose.disconnect();
});
