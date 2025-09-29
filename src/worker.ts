import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import sgMail, { type MailDataRequired } from '@sendgrid/mail';
import { config } from './config/environment';
import { logger } from './lib/logger';
import type { MailJobData } from './services/queue';
import { logAudit } from './services/auditLogger';

if (config.sendgridApiKey) {
  sgMail.setApiKey(config.sendgridApiKey);
} else {
  logger.warn('sendgrid api key not configured; mail jobs will fail');
}

interface SendGridAttachment {
  content: string;
  filename: string;
  type: string;
  disposition?: string;
}

type Personalization = NonNullable<MailDataRequired['personalizations']>[number];

function sanitizeFieldValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'string') {
    return value;
  }
  return JSON.stringify(value);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderTextBody(job: MailJobData): string {
  const fieldLines = Object.entries(job.fields)
    .map(([key, value]) => `${key}: ${sanitizeFieldValue(value)}`)
    .join('\n');

  return [
    `Form submission received for template ${job.templateId}`,
    '',
    fieldLines,
    '',
    'Metadata:',
    `Origin: ${job.metadata.origin ?? 'unknown'}`,
    `IP Hash: ${job.metadata.ipHash ?? 'unknown'}`,
    `Idempotency-Key: ${job.metadata.idemKey ?? 'none'}`,
    `Queued At: ${job.metadata.receivedAt}`,
  ].join('\n');
}

function renderHtmlBody(job: MailJobData): string {
  const fieldRows = Object.entries(job.fields)
    .map(([key, value]) => {
      const safeKey = escapeHtml(key);
      const safeValue = escapeHtml(sanitizeFieldValue(value));
      return `<tr><th align="left" style="padding:4px 8px;">${safeKey}</th><td style="padding:4px 8px;">${safeValue}</td></tr>`;
    })
    .join('');

  const metadataItems = [
    ['Origin', job.metadata.origin ?? 'unknown'],
    ['IP Hash', job.metadata.ipHash ?? 'unknown'],
    ['Idempotency-Key', job.metadata.idemKey ?? 'none'],
    ['Queued At', job.metadata.receivedAt],
  ]
    .map(([label, value]) => `<li><strong>${escapeHtml(label)}:</strong> ${escapeHtml(String(value))}</li>`)
    .join('');

  return `
    <p>Form submission received for template <strong>${escapeHtml(job.templateId)}</strong>.</p>
    <table style="border-collapse:collapse;border:1px solid #ddd;">
      <tbody>
        ${fieldRows || '<tr><td>No fields submitted.</td></tr>'}
      </tbody>
    </table>
    <p><strong>Metadata</strong></p>
    <ul>
      ${metadataItems}
    </ul>
  `;
}

async function buildAttachments(job: MailJobData): Promise<{ attachments: SendGridAttachment[]; totalBytes: number }> {
  const resolved: SendGridAttachment[] = [];
  let totalBytes = 0;

  for (const attachment of job.attachments) {
    if (attachment.base64) {
      resolved.push({
        content: attachment.base64,
        filename: attachment.filename,
        type: attachment.mimetype,
      });
      totalBytes += attachment.size;
      continue;
    }

    if (attachment.url) {
      try {
        const response = await fetch(attachment.url);
        if (!response.ok) {
          throw new Error(`attachment_fetch_failed_${response.status}`);
        }

        const buffer = Buffer.from(await response.arrayBuffer());
        totalBytes += buffer.byteLength;
        resolved.push({
          content: buffer.toString('base64'),
          filename: attachment.filename,
          type: attachment.mimetype,
        });
      } catch (error) {
        logger.error({ err: error, attachment: attachment.filename }, 'failed to resolve attachment url');
        throw error;
      }
    }
  }

  return { attachments: resolved, totalBytes };
}

const connection = new IORedis(config.redisUrl, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

const worker = new Worker<MailJobData>(
  config.mailQueueName,
  async (job) => {
    const startedAt = Date.now();
    logger.info({ jobId: job.id, templateId: job.data.templateId }, 'processing mail job');

    if (!config.sendgridApiKey || !config.sendgridFromEmail) {
      logger.error('sendgrid not configured');
      throw new Error('sendgrid_not_configured');
    }

    const { attachments, totalBytes } = await buildAttachments(job.data);

    const from = config.sendgridFromName
      ? { email: config.sendgridFromEmail, name: config.sendgridFromName }
      : { email: config.sendgridFromEmail };

    const customArgs: Record<string, string> = {
      templateId: job.data.templateId,
    };

    if (job.id) {
      customArgs.jobId = job.id.toString();
    }

    const personalization: Personalization = {
      to: job.data.to.map((email) => ({ email })),
      customArgs,
    };

    if (job.data.cc?.length) {
      personalization.cc = job.data.cc.map((email) => ({ email }));
    }

    if (job.data.bcc?.length) {
      personalization.bcc = job.data.bcc.map((email) => ({ email }));
    }

    const mailOptions: MailDataRequired = {
      from,
      subject: job.data.subject,
      personalizations: [personalization],
      text: renderTextBody(job.data),
      html: renderHtmlBody(job.data),
      attachments,
    };

    let sendgridStatusCode = 0;
    let sendgridMessageId: string | undefined;
    try {
      const [response] = await sgMail.send(mailOptions);
      sendgridStatusCode = response.statusCode;
      sendgridMessageId = response.headers['x-message-id'] as string | undefined;
      logger.info(
        { jobId: job.id, templateId: job.data.templateId, statusCode: sendgridStatusCode },
        'mail sent via sendgrid'
      );
    } catch (error) {
      logger.error({ jobId: job.id, err: error }, 'sendgrid send failed');
      throw error;
    }

    const attachmentsTotalMb = totalBytes / (1024 * 1024);
    const auditMetadata: Record<string, unknown> = {
      ...job.data.metadata,
      sendgridStatusCode,
      sendgridMessageId,
    };

    await logAudit({
      ts: new Date(),
      templateId: job.data.templateId,
      category: 'mail.send',
      origin: job.data.metadata.origin,
      ipHash: job.data.metadata.ipHash,
      toHash: job.data.metadata.toHash,
      ok: true,
      errorCode: undefined,
      latencyMs: Date.now() - startedAt,
      idemKey: job.data.metadata.idemKey,
      attachmentsCount: job.data.attachments.length,
      attachmentsTotalMb,
      metadata: auditMetadata,
    });
  },
  {
    connection,
    prefix: `${config.redisNamespace}:bullmq`,
  }
);

worker.on('completed', (job) => {
  logger.info({ jobId: job.id }, 'mail job completed');
});

worker.on('failed', async (job, err) => {
  logger.error({ jobId: job?.id, err }, 'mail job failed');
  if (job) {
    await logAudit({
      ts: new Date(),
      templateId: job.data.templateId,
      category: 'mail.send',
      origin: job.data.metadata.origin,
      ipHash: job.data.metadata.ipHash,
      toHash: job.data.metadata.toHash,
      ok: false,
      errorCode: err.message,
      latencyMs: 0,
      idemKey: job.data.metadata.idemKey,
      attachmentsCount: job.data.attachments.length,
      attachmentsTotalMb:
        job.data.attachments.reduce((acc, attachment) => acc + attachment.size, 0) /
        (1024 * 1024),
      metadata: job.data.metadata,
    });
  }
});

process.on('SIGINT', async () => {
  logger.info('worker shutting down');
  await worker.close();
  await connection.quit();
  process.exit(0);
});
