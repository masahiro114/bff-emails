import { RateLimitPolicy } from '../types/policy';
import { getRedisClient } from './redis';

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

function rateLimitKey(templateId: string, scope: string): string {
  return `ratelimit:${templateId}:${scope}`;
}

export async function checkRateLimit(
  templateId: string,
  policy: RateLimitPolicy,
  scopeValue: string
): Promise<RateLimitResult> {
  const redis = getRedisClient();
  const key = rateLimitKey(templateId, scopeValue);
  const ttlMs = policy.windowSeconds * 1000;
  const results = await redis
    .multi()
    .incr(key)
    .pexpire(key, ttlMs, 'NX')
    .pttl(key)
    .exec();

  if (!results) {
    throw new Error('rate_limit_exec_failed');
  }

  const incrResult = results[0];
  const ttlResult = results[2];

  if (incrResult[0]) {
    throw incrResult[0];
  }

  if (ttlResult[0]) {
    throw ttlResult[0];
  }

  const count = Number(incrResult[1]);
  const pttl = Number(ttlResult[1]);

  const allowed = count <= policy.max;
  const remaining = Math.max(policy.max - count, 0);
  const resetAt = Date.now() + (pttl > 0 ? pttl : ttlMs);

  return { allowed, remaining, resetAt };
}
