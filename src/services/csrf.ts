import crypto from 'node:crypto';
import { getRedisClient } from './redis';

function csrfKey(templateId: string, token: string): string {
  return `csrf:${templateId}:${token}`;
}

export async function issueCsrfToken(templateId: string, ttlSeconds: number): Promise<string> {
  const redis = getRedisClient();
  const token = crypto.randomBytes(32).toString('base64url');
  await redis.set(csrfKey(templateId, token), '1', 'EX', ttlSeconds);
  return token;
}

export async function consumeCsrfToken(templateId: string, token: string): Promise<boolean> {
  const redis = getRedisClient();
  const deleted = await redis.del(csrfKey(templateId, token));
  return deleted === 1;
}
