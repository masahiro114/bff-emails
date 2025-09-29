import crypto from 'node:crypto';

export function calculateBase64Size(base64String: string): number {
  const padding = (base64String.match(/=+$/) ?? [''])[0].length;
  return Math.floor(base64String.length * 0.75) - padding;
}

export function hashPayload(payload: unknown): string {
  const serialized = JSON.stringify(payload);
  return crypto.createHash('sha256').update(serialized).digest('hex');
}
