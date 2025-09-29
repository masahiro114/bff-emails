export type AuthType =
  | { type: 'none' }
  | {
      type: 'jwt';
      issuer?: string;
      audience?: string;
      sharedSecretEnv?: string;
      required?: boolean;
    };

export type CaptchaPolicy =
  | { enabled: false }
  | {
      enabled: true;
      provider: 'hcaptcha' | 'recaptcha';
      secretEnv: string;
    };

export type AttachmentMode =
  | {
      mode: 'base64';
      maxTotalMb: number;
      maxCount: number;
      allowedMimeTypes: string[];
    }
  | {
      mode: 'object-store';
      maxCount: number;
      allowedMimeTypes: string[];
    };

export interface RateLimitPolicy {
  windowSeconds: number;
  max: number;
  scope: 'ip' | 'origin' | 'template';
}

export interface IdempotencyPolicy {
  required: boolean;
  ttlSeconds: number;
}

export interface CsrfPolicy {
  ttlSeconds: number;
}

export interface TemplatePolicy {
  id: string;
  name: string;
  allowedOrigins: string[];
  allowCredentials?: boolean;
  maxBodyBytes: number;
  auth: AuthType;
  captcha: CaptchaPolicy;
  rateLimit?: RateLimitPolicy;
  idempotency?: IdempotencyPolicy;
  csrf: CsrfPolicy;
  attachments: AttachmentMode;
  queue?: {
    priority?: number;
  };
}

export interface TemplatePolicyMap {
  [templateId: string]: TemplatePolicy;
}

export interface TemplateContext {
  templateId: string;
  policy: TemplatePolicy;
}
