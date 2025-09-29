import { Router } from 'express';
import { createTemplateContextMiddleware } from '../middleware/templateContext';
import { createTemplateCorsMiddleware } from '../middleware/cors';
import { bodySizeGuard } from '../middleware/bodySizeGuard';
import { csrfGuard } from '../middleware/csrf';
import { authGuard } from '../middleware/auth';
import { captchaGuard } from '../middleware/captcha';
import { rateLimitGuard } from '../middleware/rateLimit';
import { idempotencyGuard } from '../middleware/idempotency';
import { validateMailRequest } from '../lib/validation';
import { enqueueMailJob } from '../services/queue';
import { logger } from '../lib/logger';
import { sha256 } from '../lib/hash';

const router = Router();

router.use('/send', createTemplateContextMiddleware('header', 'x-template-id'));
router.options('/send', createTemplateCorsMiddleware(), (_req, res) => {
  res.sendStatus(204);
});

router.post(
  '/send',
  createTemplateCorsMiddleware(),
  bodySizeGuard,
  csrfGuard,
  authGuard,
  captchaGuard,
  rateLimitGuard,
  idempotencyGuard,
  async (req, res) => {
    const context = req.templateContext!;
    const requestStart = Date.now();

    try {
      const validated = validateMailRequest(req.body, context.policy);

      const attachmentsCount = validated.attachments.length;
      const totalMb = validated.attachments.reduce((acc, attachment) => acc + attachment.size, 0) /
        (1024 * 1024);

      const ipHash = req.ip ? sha256(req.ip) : undefined;
      const toHash = sha256(validated.to.join(','));
      const origin = req.get('origin') ?? undefined;
      const idemKey = req.get('idempotency-key') ?? undefined;

      const latencyMs = Date.now() - requestStart;

      const jobId = await enqueueMailJob(
        {
          templateId: context.templateId,
          to: validated.to,
          cc: validated.cc,
          bcc: validated.bcc,
          subject: validated.subject,
          fields: validated.fields,
          attachments: validated.attachments,
          metadata: {
            origin,
            ipHash,
            idemKey,
            receivedAt: new Date().toISOString(),
            latencyMs,
            toHash,
          },
        },
        {
          removeOnComplete: true,
          removeOnFail: false,
          priority: context.policy.queue?.priority,
        }
      );

      res.status(202).json({ status: 'queued', jobId });
    } catch (error) {
      logger.error({ err: error }, 'failed to enqueue mail job');
      if (error && typeof error === 'object' && 'code' in error) {
        const code = (error as { code?: string }).code ?? 'validation_failed';
        if (code === 'attachments_too_large') {
          res.status(413).json({ error: 'attachments_too_large' });
          return;
        }
      }
      res.status(400).json({ error: 'validation_failed' });
    }
  }
);

export const mailRouter = router;
