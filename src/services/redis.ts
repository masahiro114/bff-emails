import IORedis, { type Redis } from 'ioredis';
import { config } from '../config/environment';

let client: Redis | null = null;

export function getRedisClient(): Redis {
  if (!client) {
    client = new IORedis(config.redisUrl, {
      keyPrefix: `${config.redisNamespace}:`,
      lazyConnect: true,
    });
  }
  return client;
}

export async function ensureRedisConnected(): Promise<void> {
  const redis = getRedisClient();
  if (redis.status === 'ready') {
    return;
  }
  await redis.connect();
}
