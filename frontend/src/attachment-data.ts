import { requestForm, requestJson } from './lib/api';
import { apiKey, useApiQuery } from './lib/query';

// Files attached to a certification or a project (#227): API calls and display rules. The section is in
// attachment-section.tsx.

export type Attachment = {
  id: number;
  filename: string;
  contentType: string;
  sizeBytes: number;
  createdAt: string;
};

export type AttachmentOwner = 'certifications' | 'projects';

/** The server's limit, so the browser can refuse a big file before sending it. */
export const maxAttachmentBytes = 5 * 1024 * 1024;

/** What the file picker offers; the server still checks the file's real type. */
export const attachmentAccept =
  'application/pdf,image/png,image/jpeg,image/webp,.pdf,.png,.jpg,.jpeg,.webp';

export const attachmentsPath = (owner: AttachmentOwner, id: string) =>
  `/api/${owner}/${id}/attachments`;

export const attachmentUrl = (id: number) => `/api/attachments/${String(id)}`;

/** "2.4 MB", "310 KB" or "12 B". */
export function formatSize(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${String(Math.round(bytes / 1024))} KB`;
  return `${String(bytes)} B`;
}

export const attachmentApi = {
  upload: (owner: AttachmentOwner, id: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return requestForm<{ attachment: Attachment }>(attachmentsPath(owner, id), form);
  },
  remove: (id: number) => requestJson<undefined>(attachmentUrl(id), { method: 'DELETE' }),
};

export function useAttachments(owner: AttachmentOwner, id: string) {
  return useApiQuery<{ attachments: Attachment[] }>(
    apiKey(attachmentsPath(owner, id)),
    attachmentsPath(owner, id),
  );
}
