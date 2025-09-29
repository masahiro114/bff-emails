import type { RequestHandler } from 'express';
import { getIdempotencyPayloadHash, registerIdempotencyKey } from '../services/idempotency';
import { hashPayload } from '../lib/utils';

export const idempotencyGuard: RequestHandler = async (req, res, next) => {
  const context = req.templateContext;
  if (!context) {
    res.status(500).json({ error: 'template_context_missing' });
    return;
  }

  const policy = context.policy.idempotency;
  if (!policy) {
    next();
    return;
  }

  const key = req.get('idempotency-key');
  if (!key) {
    if (policy.required) {
      res.status(400).json({ error: 'idempotency_key_required' });
      return;
    }
    next();
    return;
  }

  const payloadHash = hashPayload({ body: req.body });
  const created = await registerIdempotencyKey(
    context.templateId,
    key,
    policy.ttlSeconds,
    payloadHash
  );

  if (!created) {
    const existingHash = await getIdempotencyPayloadHash(context.templateId, key);
    if (existingHash === payloadHash) {
      res.status(409).json({ error: 'idempotent_request_duplicate' });
    } else {
      res.status(409).json({ error: 'idempotency_key_conflict' });
    }
    return;
  }

  next();
};
