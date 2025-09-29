import type { TemplateContext } from './policy';

declare global {
  namespace Express {
    interface Request {
      rawBody?: Buffer;
      templateContext?: TemplateContext;
    }
  }
}

export {};
