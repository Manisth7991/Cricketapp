import pino from 'pino';
import { env, isProd, isTest } from './env';

export const logger = pino({
  level: isTest ? 'silent' : env.LOG_LEVEL,
  redact: ['req.headers.cookie', 'req.headers.authorization', 'password', 'passwordHash'],
  ...(isProd || isTest
    ? {}
    : {
        transport: {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
        },
      }),
});
