import path from 'node:path';
import process from 'node:process';

export interface AppConfig {
  nodeEnv: string;
  port: number;
  redisUrl: string;
  redisNamespace: string;
  mailQueueName: string;
  postgresUrl?: string;
  templateConfigPath: string;
  maxJsonBodyBytes: number;
  logLevel: string;
  sendgridApiKey?: string;
  sendgridFromEmail?: string;
  sendgridFromName?: string;
}

const root = process.cwd();

const DEFAULT_MAX_JSON_BODY_BYTES = 5 * 1024 * 1024; // 5MB safety default

export const config: AppConfig = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 3000),
  redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',
  redisNamespace: process.env.REDIS_NAMESPACE ?? 'bff-mail',
  mailQueueName: process.env.MAIL_QUEUE_NAME ?? 'mail:queue',
  postgresUrl: process.env.POSTGRES_URL,
  templateConfigPath:
    process.env.TEMPLATE_CONFIG_PATH ?? path.join(root, 'config/templates.json'),
  maxJsonBodyBytes: Number(process.env.MAX_JSON_BODY_BYTES ?? DEFAULT_MAX_JSON_BODY_BYTES),
  logLevel: process.env.LOG_LEVEL ?? 'info',
  sendgridApiKey: process.env.SENDGRID_API_KEY,
  sendgridFromEmail: process.env.SENDGRID_FROM_EMAIL,
  sendgridFromName: process.env.SENDGRID_FROM_NAME,
};
