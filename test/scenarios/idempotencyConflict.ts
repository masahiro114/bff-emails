import { randomIdemKey, requestCsrfToken, sendMail } from '../utils/mailClient';
import type { Scenario } from '../types';

export const idempotencyConflict: Scenario = {
  name: 'Repeated idempotency key returns conflict',
  async run() {
    const key = randomIdemKey();

    const firstToken = await requestCsrfToken();
    const first = await sendMail({
      csrfToken: firstToken,
      headers: {
        'Idempotency-Key': key,
      },
    });

    if (first.status !== 202) {
      throw new Error(`First request expected 202 but received ${first.status}: ${JSON.stringify(first.body)}`);
    }

    const secondToken = await requestCsrfToken();
    const second = await sendMail({
      csrfToken: secondToken,
      headers: {
        'Idempotency-Key': key,
      },
    });

    if (second.status !== 409) {
      throw new Error(`Second request expected 409 but received ${second.status}: ${JSON.stringify(second.body)}`);
    }
  },
};
