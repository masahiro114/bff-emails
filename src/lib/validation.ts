import { z } from 'zod';
import type { TemplatePolicy } from '../types/policy';
import { calculateBase64Size } from './utils';

const emailArraySchema = z.array(z.string().email()).min(1);

const attachmentSchema = z.object({
  filename: z.string(),
  mimetype: z.string(),
  content: z.string().optional(),
  url: z.string().url().optional(),
});

const mailSendSchema = z.object({
  to: emailArraySchema,
  cc: z.array(z.string().email()).optional(),
  bcc: z.array(z.string().email()).optional(),
  subject: z.string().max(500),
  fields: z.record(z.string(), z.any()),
  attachments: z.array(attachmentSchema).default([]),
});

export type MailSendInput = z.infer<typeof mailSendSchema>;

export interface AttachmentValidationResult {
  filename: string;
  mimetype: string;
  size: number;
  base64?: string;
  url?: string;
}

export interface ValidatedMailRequest extends Omit<MailSendInput, 'attachments'> {
  attachments: AttachmentValidationResult[];
}

export function validateMailRequest(
  body: unknown,
  policy: TemplatePolicy
): ValidatedMailRequest {
  const parsed = mailSendSchema.parse(body);

  if (parsed.attachments.length > (policy.attachments.maxCount ?? Infinity)) {
    throw Object.assign(new Error('attachments_count_exceeded'), {
      code: 'attachments_count_exceeded',
    });
  }

  let totalSizeBytes = 0;
  const sanitizedAttachments: AttachmentValidationResult[] = parsed.attachments.map((attachment) => {
    const { filename, mimetype, content, url } = attachment;

    if (policy.attachments.allowedMimeTypes.length > 0 && !policy.attachments.allowedMimeTypes.includes(mimetype)) {
      throw Object.assign(new Error('attachment_type_not_allowed'), {
        code: 'attachment_type_not_allowed',
      });
    }

    if (policy.attachments.mode === 'base64') {
      if (!content) {
        throw Object.assign(new Error('attachment_content_missing'), {
          code: 'attachment_content_missing',
        });
      }
      const size = calculateBase64Size(content);
      totalSizeBytes += size;
      return { filename, mimetype, size, base64: content };
    }

    if (!url) {
      throw Object.assign(new Error('attachment_url_missing'), {
        code: 'attachment_url_missing',
      });
    }

    return { filename, mimetype, size: 0, url };
  });

  if (policy.attachments.mode === 'base64') {
    const totalMb = totalSizeBytes / (1024 * 1024);
    if (totalMb > policy.attachments.maxTotalMb) {
      throw Object.assign(new Error('attachments_too_large'), {
        code: 'attachments_too_large',
      });
    }
  }

  return {
    to: parsed.to,
    cc: parsed.cc,
    bcc: parsed.bcc,
    subject: parsed.subject,
    fields: parsed.fields,
    attachments: sanitizedAttachments,
  };
}
