import pino from 'pino';
import { config } from '../config/environment';

const pretty = process.env.NODE_ENV !== 'production' && process.stdout.isTTY;

export const logger = pino({
  level: config.logLevel,
  transport: pretty
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
        },
      }
    : undefined,
});
