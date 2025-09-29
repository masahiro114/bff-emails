# bff-emails

Backend-for-Frontend service that exposes a secure, policy-driven API for form submissions and routes mail delivery through a queue/worker pipeline.

## Features
- **Per-template policies** controlling CORS, CSRF, auth, captcha, rate limits, idempotency, and attachment modes.
- **Endpoints**
  - `GET /v1/csrf?templateId=...` issues short-lived CSRF tokens.
  - `POST /v1/mail/send` accepts form submissions with Base64 attachments and enqueues delivery jobs.
- **Queue-based delivery** using BullMQ + Redis for reliable email processing.
- **Audit logging** into Postgres (metadata-only, attachment sizes/hashes) with automatic table bootstrap.
- **SendGrid integration** from the worker for outbound mail delivery.
- **Docker-ready** stack composed of gateway (Traefik), API, worker, Redis, and Postgres.

## Project Layout
```
src/
  config/        -> environment + policy loading
  middleware/    -> request pipeline guards (CORS, CSRF, auth, etc.)
  routes/        -> HTTP endpoints
  services/      -> integrations (Redis, queue, audit logging, captcha)
  lib/           -> helpers (logger, hashing, validation)
  worker.ts      -> BullMQ worker processing mail jobs
```

## Getting Started
1. Copy the sample environment and review the values:
   ```bash
   cp .env.example .env
   ```
2. Install dependencies and generate TypeScript build outputs:
   ```bash
   npm install
   npm run build
   ```
3. Run the API in development mode:
   ```bash
   npm run dev
   ```
   Start the worker in a separate terminal:
   ```bash
   npm run worker:dev
   ```

Redis is required for CSRF tokens, rate limiting, idempotency, and the BullMQ queue. Postgres is optional; if `POSTGRES_URL` is unset the service will skip audit inserts.

### Scenario Tests
With the stack running locally you can exercise the API using the bundled scenario runner:

```bash
npm run test:scenarios
```

Environment variables `TEST_BASE_URL`, `TEST_TEMPLATE_ID`, and `TEST_RECIPIENT` let you point the tests at alternate endpoints or recipients. The runner covers successful submission, missing CSRF, idempotency conflict, and invalid attachment type cases.

### Email Provider (SendGrid)
Configure the worker with a SendGrid API key and default sender identity:

```bash
export SENDGRID_API_KEY=...
export SENDGRID_FROM_EMAIL=no-reply@example.com
export SENDGRID_FROM_NAME="BFF Mailer"
```

The worker converts incoming form payloads into a simple text/HTML email, resolves Base64 or URL attachments, and calls `@sendgrid/mail`. Failures bubble back to BullMQ so jobs can be retried or sent to a DLQ in future enhancements.

## Docker Compose Stack
Bring up the full stack (Traefik gateway, API, worker, Redis, Postgres):
```bash
docker compose up --build
```
The API listens on `http://localhost:3000`, the gateway on `http://localhost:8080`.

## Policy Configuration
Policies are loaded from `config/templates.json` (override via `TEMPLATE_CONFIG_PATH`). Each template entry follows this shape:
```json
{
  "template-id": {
    "id": "template-id",
    "name": "Human readable name",
    "allowedOrigins": ["https://app.example.com"],
    "allowCredentials": true,
    "maxBodyBytes": 1048576,
    "auth": { "type": "none" },
    "captcha": { "enabled": false },
    "rateLimit": { "windowSeconds": 60, "max": 10, "scope": "ip" },
    "idempotency": { "required": false, "ttlSeconds": 300 },
    "csrf": { "ttlSeconds": 300 },
    "attachments": {
      "mode": "base64",
      "maxTotalMb": 2,
      "maxCount": 3,
      "allowedMimeTypes": ["application/pdf"]
    }
  }
}
```
Secrets referenced in policies (e.g., `sharedSecretEnv`, captcha secrets) must exist in the environment.

## Request Pipeline

`POST /v1/mail/send` executes the following guards in order:
1. Dynamic CORS check.
2. Body size guard vs. policy limit.
3. CSRF token verification (tokens issued via `/v1/csrf`).
4. Optional JWT authentication.
5. Optional CAPTCHA verification (hCaptcha / reCAPTCHA).
6. Redis-backed rate limiting.
7. Optional idempotency enforcement (uses `Idempotency-Key` header).
8. Schema + attachment validation.
9. Job enqueued to BullMQ for worker processing.

The endpoint expects an `X-Template-Id` header indicating which policy to apply. Include an `X-CSRF-Token` header with the value returned by `/v1/csrf`. Optional headers:
- `Authorization: Bearer <token>` when the template uses JWT auth.
- `X-Captcha-Token` when CAPTCHA is enabled.
- `Idempotency-Key` when idempotency is enforced.

## Worker Behaviour
The worker consumes `mail-queue` jobs and currently logs the payload + writes audit metadata to Postgres. Integrate the real mail provider inside `src/worker.ts` where noted. Audit records include timestamp, template id, hashed IP/to addresses, latency, idempotency key, and attachment statistics.

## Roadmap Notes
- Add object-storage attachment mode and signed upload support.
- Implement provider abstraction + retry/DLQ policies.
- Persist responses for idempotent requests to return the original response body.
- Extend CAPTCHA adapters and JWT JWKS validation.
