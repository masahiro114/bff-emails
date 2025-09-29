import type { RequestHandler } from 'express';
import { checkRateLimit } from '../services/rateLimiter';

export const rateLimitGuard: RequestHandler = async (req, res, next) => {
  const context = req.templateContext;
  if (!context) {
    res.status(500).json({ error: 'template_context_missing' });
    return;
  }

  const policy = context.policy.rateLimit;
  if (!policy) {
    next();
    return;
  }

  const scopeValue = (() => {
    switch (policy.scope) {
      case 'origin':
        return req.get('origin') ?? 'unknown-origin';
      case 'template':
        return context.templateId;
      case 'ip':
      default:
        return req.ip ?? 'unknown-ip';
    }
  })();

  const result = await checkRateLimit(context.templateId, policy, scopeValue);
  if (!result.allowed) {
    const retryAfter = Math.max(Math.ceil((result.resetAt - Date.now()) / 1000), 1);
    res.setHeader('Retry-After', String(retryAfter));
    res.status(429).json({ error: 'rate_limited' });
    return;
  }

  next();
};
