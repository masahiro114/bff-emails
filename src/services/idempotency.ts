import { getRedisClient } from './redis';

function idempotencyKey(templateId: string, key: string): string {
  return `idem:${templateId}:${key}`;
}

export async function registerIdempotencyKey(
  templateId: string,
  key: string,
  ttlSeconds: number,
  payloadHash: string
): Promise<boolean> {
  const redis = getRedisClient();
  const set = await redis.set(idempotencyKey(templateId, key), payloadHash, 'EX', ttlSeconds, 'NX');
  return set === 'OK';
}

export async function getIdempotencyPayloadHash(
  templateId: string,
  key: string
): Promise<string | null> {
  const redis = getRedisClient();
  return redis.get(idempotencyKey(templateId, key));
}
