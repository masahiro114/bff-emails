import { sendMail } from '../utils/mailClient';
import type { Scenario } from '../types';

export const missingCsrf: Scenario = {
  name: 'Missing CSRF token is rejected',
  async run() {
    const result = await sendMail({ skipCsrf: true });

    if (result.status !== 403) {
      throw new Error(`Expected 403 but received ${result.status}: ${JSON.stringify(result.body)}`);
    }
  },
};
