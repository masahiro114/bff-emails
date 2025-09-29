import express from 'express';
import helmet from 'helmet';
import { config } from './config/environment';
import { logger } from './lib/logger';
import { ensureRedisConnected } from './services/redis';
import { ensureAuditTable } from './services/auditLogger';
import { csrfRouter } from './routes/csrf';
import { mailRouter } from './routes/mail';

const app = express();

app.use(helmet({
  crossOriginResourcePolicy: false,
}));

app.use(
  express.json({
    limit: config.maxJsonBodyBytes,
    verify: (req, _res, buf) => {
      // @ts-expect-error express typing does not include rawBody
      req.rawBody = Buffer.from(buf);
    },
  })
);

app.get('/healthz', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/v1/csrf', csrfRouter);
app.use('/v1/mail', mailRouter);

async function start() {
  try {
    await ensureRedisConnected();
    await ensureAuditTable();
  } catch (error) {
    logger.error({ err: error }, 'startup dependency check failed');
  }

  app.listen(config.port, () => {
    logger.info({ port: config.port }, 'bff-mail listening');
  });
}

void start();
