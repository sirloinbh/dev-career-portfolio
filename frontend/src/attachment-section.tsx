import { Download, Paperclip, Trash2, Upload } from 'lucide-react';
import { useRef, useState } from 'react';

import {
  type Attachment,
  attachmentAccept,
  attachmentApi,
  type AttachmentOwner,
  attachmentsPath,
  attachmentUrl,
  formatSize,
  maxAttachmentBytes,
  useAttachments,
} from './attachment-data';
import { Button } from './components/ui/button';
import { ConfirmDialog } from './components/ui/confirm-dialog';
import { SkeletonList } from './components/ui/skeleton';
import { toast } from './components/ui/sonner';
import { errorText } from './lib/use-notice';
import { useRefreshList } from './list-query';

// The files of one certification or project (#227), under its Edit form: upload, download and delete act at once.

function AttachmentRow({
  attachment,
  onDelete,
}: {
  attachment: Attachment;
  onDelete: (attachment: Attachment) => Promise<void>;
}) {
  return (
    <li className="flex flex-wrap items-center gap-2 p-3">
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="text-body-sm font-medium wrap-anywhere break-keep">
          {attachment.filename}
        </span>
        <span className="text-caption text-muted-foreground">
          {formatSize(attachment.sizeBytes)}
        </span>
      </div>
      <Button asChild variant="outline" size="sm">
        <a
          href={attachmentUrl(attachment.id)}
          download
          aria-label={`Download ${attachment.filename}`}
        >
          <Download aria-hidden />
          Download
        </a>
      </Button>
      <ConfirmDialog
        title="Delete this file?"
        description={
          <span className="break-keep">
            &apos;{attachment.filename}&apos; will be deleted. This cannot be undone.
          </span>
        }
        onConfirm={() => onDelete(attachment)}
        trigger={
          <Button variant="outline" size="sm" aria-label={`Delete ${attachment.filename}`}>
            <Trash2 aria-hidden />
            Delete
          </Button>
        }
      />
    </li>
  );
}

export function AttachmentSection({ owner, id }: { owner: AttachmentOwner; id: string }) {
  const attachments = useAttachments(owner, id);
  const refresh = useRefreshList(attachmentsPath(owner, id));
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [problem, setProblem] = useState('');
  const list = attachments.data?.attachments ?? [];

  const choose = async (file: File | undefined) => {
    if (!file) return;
    setProblem('');
    if (file.size > maxAttachmentBytes) {
      setProblem('File must be at most 5 MB');
    } else {
      setUploading(true);
      try {
        await attachmentApi.upload(owner, id, file);
        await refresh();
        toast.success(`Attached '${file.name}'`);
      } catch (error) {
        setProblem(errorText(error));
      } finally {
        setUploading(false);
      }
    }
    // The same file can be chosen again after a refusal.
    if (input.current) input.current.value = '';
  };

  const remove = async (attachment: Attachment) => {
    await attachmentApi.remove(attachment.id);
    await refresh();
  };

  return (
    <section aria-labelledby="attachments-title" className="flex max-w-2xl flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <h2 id="attachments-title" className="text-body font-semibold">
          Files
        </h2>
        <input
          ref={input}
          id="attachment-file"
          type="file"
          accept={attachmentAccept}
          hidden
          aria-label="Choose a file to attach"
          onChange={(e) => void choose(e.target.files?.[0])}
        />
        <Button
          size="sm"
          variant="outline"
          disabled={uploading}
          onClick={() => input.current?.click()}
        >
          <Upload aria-hidden />
          {uploading ? 'Uploading…' : 'Attach file'}
        </Button>
      </div>
      <p className="text-caption break-keep text-muted-foreground">
        PDF, PNG or JPEG, up to 5 MB each. Files are saved at once and are not part of the form
        above.
      </p>
      <p role="alert" className="text-body-sm text-destructive">
        {problem}
      </p>
      {attachments.isPending ? <SkeletonList rows={1} /> : null}
      {attachments.isError ? (
        <p role="alert" className="text-body-sm text-destructive">
          Could not load the files. {errorText(attachments.error)}
        </p>
      ) : null}
      {attachments.data && list.length === 0 ? (
        <p className="flex items-center gap-2 text-body-sm text-muted-foreground">
          <Paperclip aria-hidden className="size-4" />
          No files attached yet.
        </p>
      ) : null}
      {list.length > 0 ? (
        <ul
          aria-label="Attached files"
          className="flex flex-col divide-y rounded-xl border bg-card text-card-foreground shadow-sm"
        >
          {list.map((attachment) => (
            <AttachmentRow key={attachment.id} attachment={attachment} onDelete={remove} />
          ))}
        </ul>
      ) : null}
    </section>
  );
}
