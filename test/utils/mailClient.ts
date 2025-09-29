import { randomUUID } from 'node:crypto';
import { TEST_BASE_URL, TEST_TEMPLATE_ID, TEST_RECIPIENT } from '../config';

export interface MailPayload {
  to?: string[];
  subject?: string;
  fields?: Record<string, unknown>;
  attachments?: Array<{
    filename: string;
    mimetype: string;
    content: string;
    url?: string;
  }>;
}

export async function requestCsrfToken(templateId: string = TEST_TEMPLATE_ID): Promise<string> {
  const response = await fetch(
    `${TEST_BASE_URL}/v1/csrf?templateId=${encodeURIComponent(templateId)}`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to obtain CSRF token (${response.status}): ${text}`);
  }

  const body = (await response.json()) as { token: string };
  return body.token;
}

export interface SendMailOptions {
  templateId?: string;
  csrfToken?: string;
  payload?: MailPayload;
  headers?: Record<string, string>;
  skipCsrf?: boolean;
}

export interface SendMailResult {
  status: number;
  body: unknown;
}

export async function sendMail(
  options: SendMailOptions = {}
): Promise<SendMailResult> {
  const templateId = options.templateId ?? TEST_TEMPLATE_ID;

  const headerBag: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Template-Id': templateId,
    ...options.headers,
  };

  if (!options.skipCsrf) {
    const csrfToken =
      options.csrfToken ?? (options.headers?.['X-CSRF-Token'] ?? (await requestCsrfToken(templateId)));
    headerBag['X-CSRF-Token'] = csrfToken;
  }

  const payload = options.payload ?? defaultPayload();

  const response = await fetch(`${TEST_BASE_URL}/v1/mail/send`, {
    method: 'POST',
    headers: headerBag,
    body: JSON.stringify(ensurePayloadDefaults(payload)),
  });

  let responseBody: unknown;
  const contentType = response.headers.get('content-type');
  if (contentType?.includes('application/json')) {
    responseBody = await response.json();
  } else {
    responseBody = await response.text();
  }

  return {
    status: response.status,
    body: responseBody,
  };
}

export function defaultPayload(): Required<MailPayload> {
  return {
    to: [TEST_RECIPIENT],
    subject: `Test submission ${new Date().toISOString()}`,
    fields: {
      name: 'Test User',
      message: 'Hello from automated scenario',
    },
    attachments: [],
  };
}

function ensurePayloadDefaults(payload: MailPayload): Required<MailPayload> {
  return {
    ...defaultPayload(),
    ...payload,
    attachments: payload.attachments ?? [],
    to: payload.to ?? defaultPayload().to,
    subject: payload.subject ?? defaultPayload().subject,
    fields: payload.fields ?? defaultPayload().fields,
  };
}

export function randomIdemKey(): string {
  return randomUUID();
}
