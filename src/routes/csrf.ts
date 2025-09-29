import { Router } from 'express';
import { createTemplateContextMiddleware } from '../middleware/templateContext';
import { createTemplateCorsMiddleware } from '../middleware/cors';
import { issueCsrfToken } from '../services/csrf';

const router = Router();

router.use(createTemplateContextMiddleware('query', 'templateId'));
router.options('/', createTemplateCorsMiddleware());
router.get('/', createTemplateCorsMiddleware(), async (req, res) => {
  const context = req.templateContext!;
  const ttl = context.policy.csrf.ttlSeconds;
  const token = await issueCsrfToken(context.templateId, ttl);
  res.json({ token, expiresIn: ttl });
});

export const csrfRouter = router;
