/**
 * Dev helper: starts an in-memory MongoDB (no install / Atlas needed) and prints the URI.
 * Usage: npm run db:memory  → copy the printed URI into MONGO_URI.
 * Data is lost when this process stops.
 */
import { MongoMemoryServer } from 'mongodb-memory-server';

const port = Number(process.env.MEMORY_DB_PORT ?? 27027);
const mongod = await MongoMemoryServer.create({ instance: { port, dbName: 'playlocal' } });

console.log(
  `\nIn-memory MongoDB running.\nMONGO_URI=${mongod.getUri('playlocal')}\n(Ctrl+C to stop)\n`,
);

const stop = async () => {
  await mongod.stop();
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
