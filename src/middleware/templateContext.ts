import type { RequestHandler } from 'express';
import { getTemplatePolicy } from '../config/policies';

function extractTemplateId(
  req: Parameters<RequestHandler>[0],
  source: 'query' | 'header',
  key: string
): string | undefined {
  if (source === 'query') {
    const raw = (req.query as Record<string, unknown>)[key];
    if (Array.isArray(raw)) {
      return typeof raw[0] === 'string' ? raw[0] : undefined;
    }
    return typeof raw === 'string' ? raw : undefined;
  }

  const headerKey = key.toLowerCase();
  const value = req.headers[headerKey];
  if (Array.isArray(value)) {
    return value[0];
  }
  return typeof value === 'string' ? value : undefined;
}

export function createTemplateContextMiddleware(
  source: 'query' | 'header',
  key: string
): RequestHandler {
  return (req, res, next) => {
    let templateId = extractTemplateId(req, source, key);

    if (!templateId && source === 'header') {
      const fallback = extractTemplateId(req, 'query', 'templateId');
      templateId = fallback;
    }

    if (!templateId) {
      res.status(400).json({ error: 'template_id_missing' });
      return;
    }

    const policy = getTemplatePolicy(templateId);
    if (!policy) {
      res.status(404).json({ error: 'template_policy_not_found' });
      return;
    }

    req.templateContext = { templateId, policy };
    next();
  };
}
