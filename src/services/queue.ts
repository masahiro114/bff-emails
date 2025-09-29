import { Queue, JobsOptions } from 'bullmq';
import IORedis from 'ioredis';
import { config } from '../config/environment';
import { logger } from '../lib/logger';

export interface MailJobData {
  templateId: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  fields: Record<string, unknown>;
  attachments: Array<{
    filename: string;
    mimetype: string;
    size: number;
    base64?: string;
    url?: string;
  }>;
  metadata: {
    origin?: string;
    ipHash?: string;
    idemKey?: string;
    receivedAt: string;
    latencyMs: number;
    toHash: string;
  };
}

const connection = new IORedis(config.redisUrl, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

export const mailQueue = new Queue<MailJobData>(config.mailQueueName, {
  connection,
  prefix: `${config.redisNamespace}:bullmq`,
});

export async function enqueueMailJob(
  data: MailJobData,
  options: JobsOptions
): Promise<string> {
  const job = await mailQueue.add('mail-send', data, options);
  logger.info({ jobId: job.id, templateId: data.templateId }, 'enqueued mail job');
  return job.id as string;
}
