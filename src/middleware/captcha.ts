import type { RequestHandler } from 'express';
import { verifyCaptchaToken } from '../services/captcha';

export const captchaGuard: RequestHandler = async (req, res, next) => {
  const context = req.templateContext;
  if (!context) {
    res.status(500).json({ error: 'template_context_missing' });
    return;
  }

  const { policy } = context;
  if (!policy.captcha.enabled) {
    next();
    return;
  }

  const captchaToken = req.get('x-captcha-token');
  const result = await verifyCaptchaToken(policy.captcha, captchaToken, req.ip);
  if (!result.ok) {
    res.status(403).json({ error: result.error ?? 'captcha_failed' });
    return;
  }

  next();
};
