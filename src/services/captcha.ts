import { logger } from '../lib/logger';
import type { CaptchaPolicy } from '../types/policy';

export interface CaptchaCheckResult {
  ok: boolean;
  error?: string;
}

export async function verifyCaptchaToken(
  policy: CaptchaPolicy,
  token: string | undefined,
  remoteIp?: string
): Promise<CaptchaCheckResult> {
  if (!policy.enabled) {
    return { ok: true };
  }

  if (!token) {
    return { ok: false, error: 'captcha_token_missing' };
  }

  const secret = process.env[policy.secretEnv];
  if (!secret) {
    logger.error({ env: policy.secretEnv }, 'captcha secret env not configured');
    return { ok: false, error: 'captcha_secret_missing' };
  }

  try {
    const body = new URLSearchParams({
      secret,
      response: token,
    });
    if (remoteIp) {
      body.append('remoteip', remoteIp);
    }

    const endpoint =
      policy.provider === 'hcaptcha'
        ? 'https://hcaptcha.com/siteverify'
        : 'https://www.google.com/recaptcha/api/siteverify';

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });

    if (!response.ok) {
      logger.warn({ status: response.status }, 'captcha provider http error');
      return { ok: false, error: 'captcha_http_error' };
    }

    const payload = (await response.json()) as { success?: boolean; ['error-codes']?: string[] };

    if (!payload.success) {
      logger.warn({ errors: payload['error-codes'] }, 'captcha validation failed');
      return { ok: false, error: 'captcha_failed' };
    }

    return { ok: true };
  } catch (error) {
    logger.error({ err: error }, 'captcha request failed');
    return { ok: false, error: 'captcha_request_failed' };
  }
}
