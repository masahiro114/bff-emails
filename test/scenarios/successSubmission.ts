import { requestCsrfToken, sendMail } from '../utils/mailClient';
import type { Scenario } from '../types';

export const successSubmission: Scenario = {
  name: 'Successful base64 submission',
  async run() {
    const csrf = await requestCsrfToken();
    const result = await sendMail({ csrfToken: csrf });

    if (result.status !== 202) {
      throw new Error(`Expected 202 but received ${result.status}: ${JSON.stringify(result.body)}`);
    }
  },
};
