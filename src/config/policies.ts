import fs from 'node:fs';
import { z } from 'zod';
import { config } from './environment';
import type { TemplatePolicy, TemplatePolicyMap } from '../types/policy';
import { logger } from '../lib/logger';

const AuthSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('none'),
  }),
  z.object({
    type: z.literal('jwt'),
    issuer: z.string().optional(),
    audience: z.string().optional(),
    sharedSecretEnv: z.string().optional(),
    required: z.boolean().optional().default(true),
  }),
]);

const CaptchaSchema = z.union([
  z.object({
    enabled: z.literal(false),
  }),
  z.object({
    enabled: z.literal(true),
    provider: z.union([z.literal('hcaptcha'), z.literal('recaptcha')]),
    secretEnv: z.string(),
  }),
]);

const AttachmentSchema = z.discriminatedUnion('mode', [
  z.object({
    mode: z.literal('base64'),
    maxTotalMb: z.number().positive(),
    maxCount: z.number().int().positive(),
    allowedMimeTypes: z.array(z.string()).default([]),
  }),
  z.object({
    mode: z.literal('object-store'),
    maxCount: z.number().int().positive(),
    allowedMimeTypes: z.array(z.string()).default([]),
  }),
]);

const RateLimitSchema = z
  .object({
    windowSeconds: z.number().int().positive(),
    max: z.number().int().positive(),
    scope: z.enum(['ip', 'origin', 'template']).default('ip'),
  })
  .optional();

const IdempotencySchema = z
  .object({
    required: z.boolean().default(false),
    ttlSeconds: z.number().int().positive().default(300),
  })
  .optional();

const CsrfSchema = z
  .object({
    ttlSeconds: z.number().int().positive().default(300),
  })
  .default({ ttlSeconds: 300 });

const TemplatePolicySchema = z.object({
  id: z.string(),
  name: z.string(),
  allowedOrigins: z.array(z.string()),
  allowCredentials: z.boolean().optional().default(false),
  maxBodyBytes: z.number().int().positive(),
  auth: AuthSchema,
  captcha: CaptchaSchema.default({ enabled: false }),
  rateLimit: RateLimitSchema,
  idempotency: IdempotencySchema,
  csrf: CsrfSchema,
  attachments: AttachmentSchema,
  queue: z
    .object({
      priority: z.number().int().min(1).max(10).optional(),
    })
    .optional(),
});

const TemplatePoliciesSchema = z.record(z.string(), TemplatePolicySchema);

let cachedPolicies: TemplatePolicyMap | null = null;

function parsePolicies(raw: unknown): TemplatePolicyMap {
  const parsed = TemplatePoliciesSchema.parse(raw);
  return Object.fromEntries(
    Object.entries(parsed).map(([key, value]) => [key, value as TemplatePolicy])
  );
}

export function loadTemplatePolicies(force = false): TemplatePolicyMap {
  if (cachedPolicies && !force) {
    return cachedPolicies;
  }

  const file = config.templateConfigPath;
  let contents: string;
  try {
    contents = fs.readFileSync(file, 'utf8');
  } catch (error) {
    logger.error({ file, err: error }, 'failed to read template configuration file');
    throw error;
  }

  let json: unknown;
  try {
    json = JSON.parse(contents);
  } catch (error) {
    logger.error({ file, err: error }, 'template configuration is not valid JSON');
    throw error;
  }

  cachedPolicies = parsePolicies(json);
  logger.info({ templateCount: Object.keys(cachedPolicies).length }, 'loaded template policies');
  return cachedPolicies;
}

export function getTemplatePolicy(templateId: string): TemplatePolicy | undefined {
  const policies = loadTemplatePolicies();
  return policies[templateId];
}
