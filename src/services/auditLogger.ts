import { Pool } from 'pg';
import { config } from '../config/environment';
import { logger } from '../lib/logger';

export interface AuditLogEntry {
  ts: Date;
  templateId: string;
  category: 'mail.send';
  origin?: string;
  ipHash?: string;
  toHash?: string;
  ok: boolean;
  errorCode?: string;
  latencyMs: number;
  idemKey?: string;
  attachmentsCount: number;
  attachmentsTotalMb: number;
  metadata: Record<string, unknown>;
}

let pool: Pool | null = null;

function getPool(): Pool | null {
  if (!config.postgresUrl) {
    return null;
  }
  if (!pool) {
    pool = new Pool({ connectionString: config.postgresUrl });
  }
  return pool;
}

export async function logAudit(entry: AuditLogEntry): Promise<void> {
  const db = getPool();
  if (!db) {
    logger.debug({ entry }, 'skipping audit log (no postgres configured)');
    return;
  }

  const query = `
    INSERT INTO mail_audit (
      ts,
      template_id,
      category,
      origin,
      ip_hash,
      to_hash,
      ok,
      error_code,
      latency_ms,
      idem_key,
      attachments_count,
      attachments_total_mb,
      metadata
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13
    );
  `;

  const values = [
    entry.ts,
    entry.templateId,
    entry.category,
    entry.origin ?? null,
    entry.ipHash ?? null,
    entry.toHash ?? null,
    entry.ok,
    entry.errorCode ?? null,
    entry.latencyMs,
    entry.idemKey ?? null,
    entry.attachmentsCount,
    entry.attachmentsTotalMb,
    JSON.stringify(entry.metadata ?? {}),
  ];

  try {
    await db.query(query, values);
  } catch (error) {
    logger.error({ err: error }, 'failed to write audit log');
  }
}

export async function ensureAuditTable(): Promise<void> {
  const db = getPool();
  if (!db) {
    return;
  }

  const ddl = `
    CREATE TABLE IF NOT EXISTS mail_audit (
      id BIGSERIAL PRIMARY KEY,
      ts TIMESTAMPTZ NOT NULL,
      template_id TEXT NOT NULL,
      category TEXT NOT NULL,
      origin TEXT,
      ip_hash TEXT,
      to_hash TEXT,
      ok BOOLEAN NOT NULL,
      error_code TEXT,
      latency_ms INTEGER NOT NULL,
      idem_key TEXT,
      attachments_count INTEGER NOT NULL,
      attachments_total_mb NUMERIC(10, 3) NOT NULL,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb
    );
  `;

  try {
    await db.query(ddl);
    logger.info('audit table ensured');
  } catch (error) {
    logger.error({ err: error }, 'failed to ensure audit table');
  }
}
