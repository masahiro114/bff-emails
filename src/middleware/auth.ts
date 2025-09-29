import type { RequestHandler } from 'express';
import { verifyJwtToken } from '../services/auth';

export const authGuard: RequestHandler = (req, res, next) => {
  const context = req.templateContext;
  if (!context) {
    res.status(500).json({ error: 'template_context_missing' });
    return;
  }

  const { policy } = context;
  if (policy.auth.type === 'none') {
    next();
    return;
  }

  const authHeader = req.get('authorization');
  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.substring('Bearer '.length)
    : undefined;

  if (!token) {
    res.status(401).json({ error: 'unauthorized_client' });
    return;
  }

  const result = verifyJwtToken(token, policy.auth);
  if (!result.ok) {
    res.status(403).json({ error: 'unauthorized_client' });
    return;
  }

  next();
};
