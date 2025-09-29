import jwt, { JwtPayload } from 'jsonwebtoken';
import { logger } from '../lib/logger';
import type { AuthType } from '../types/policy';

export interface AuthResult {
  ok: boolean;
  payload?: JwtPayload | string;
  error?: string;
}

export function verifyJwtToken(token: string, auth: Extract<AuthType, { type: 'jwt' }>): AuthResult {
  const secretEnv = auth.sharedSecretEnv;
  if (!secretEnv) {
    return { ok: false, error: 'jwt_shared_secret_not_configured' };
  }
  const secret = process.env[secretEnv];
  if (!secret) {
    logger.error({ secretEnv }, 'jwt secret not set in environment');
    return { ok: false, error: 'jwt_secret_missing' };
  }

  try {
    const payload = jwt.verify(token, secret, {
      audience: auth.audience,
      issuer: auth.issuer,
    });
    return { ok: true, payload };
  } catch (error) {
    logger.warn({ err: error }, 'jwt verification failed');
    return { ok: false, error: 'jwt_verification_failed' };
  }
}
