import type { RequestHandler } from 'express';

export const bodySizeGuard: RequestHandler = (req, res, next) => {
  const context = req.templateContext;
  if (!context || !context.policy) {
    next();
    return;
  }

  const rawBodySize = req.rawBody?.byteLength ?? 0;
  if (rawBodySize > context.policy.maxBodyBytes) {
    res.status(413).json({ error: 'attachments_too_large' });
    return;
  }

  next();
};
