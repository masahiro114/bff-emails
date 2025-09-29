import { requestCsrfToken, sendMail } from '../utils/mailClient';
import type { Scenario } from '../types';

export const invalidAttachmentType: Scenario = {
  name: 'Attachment with disallowed mimetype fails validation',
  async run() {
    const csrf = await requestCsrfToken();
    const payload = {
      attachments: [
        {
          filename: 'notes.txt',
          mimetype: 'text/plain',
          content: Buffer.from('plain text').toString('base64'),
        },
      ],
    };

    const result = await sendMail({ csrfToken: csrf, payload });

    if (result.status !== 400 && result.status !== 413) {
      throw new Error(`Expected 400/413 but received ${result.status}: ${JSON.stringify(result.body)}`);
    }
  },
};
