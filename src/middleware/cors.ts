import cors, { type CorsOptions } from 'cors';
import type { RequestHandler } from 'express';

const DEFAULT_ALLOWED_HEADERS = [
  'Content-Type',
  'X-CSRF-Token',
  'Authorization',
  'Idempotency-Key',
  'X-Captcha-Token',
  'X-Template-Id',
];

export function createTemplateCorsMiddleware(): RequestHandler {
  return (req, res, next) => {
    const context = req.templateContext;
    if (!context) {
      next();
      return;
    }

    const { policy } = context;

    const corsOptions: CorsOptions = {
      credentials: policy.allowCredentials ?? false,
      origin: (origin, callback) => {
        if (!origin) {
          callback(null, true);
          return;
        }

        if (policy.allowedOrigins.includes(origin)) {
          callback(null, true);
          return;
        }

        callback(new Error('origin_not_allowed'));
      },
      allowedHeaders: DEFAULT_ALLOWED_HEADERS,
      exposedHeaders: ['Idempotency-Key'],
      methods: ['GET', 'POST', 'OPTIONS'],
      maxAge: 600,
    };

    cors(corsOptions)(req, res, (err) => {
      if (err) {
        res.status(403).json({ error: 'cors_rejected' });
        return;
      }
      next();
    });
  };
}
