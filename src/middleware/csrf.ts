import type { RequestHandler } from 'express';
import { consumeCsrfToken } from '../services/csrf';

export const csrfGuard: RequestHandler = async (req, res, next) => {
  const context = req.templateContext;
  if (!context) {
    res.status(500).json({ error: 'template_context_missing' });
    return;
  }

  const token = req.get('x-csrf-token');
  if (!token) {
    res.status(403).json({ error: 'csrf_token_missing' });
    return;
  }

  const ok = await consumeCsrfToken(context.templateId, token);
  if (!ok) {
    res.status(403).json({ error: 'csrf_token_invalid' });
    return;
  }

  next();
};
