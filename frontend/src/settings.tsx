import { useQueryClient } from '@tanstack/react-query';
import { Download, Upload } from 'lucide-react';
import { type ChangeEvent, useRef, useState } from 'react';

import { Button } from './components/ui/button';
import { ConfirmDialog } from './components/ui/confirm-dialog';
import { Input } from './components/ui/input';
import { Label } from './components/ui/label';
import { Notice } from './components/ui/notice';
import { type Health, healthText } from './health';
import { requestJson } from './lib/api';
import { useNotice } from './lib/use-notice';
import { PageHeader } from './page-header';
import { serviceToday } from './service-date';
import {
  downloadJson,
  exportFileName,
  type ExportSummary,
  recordsText,
  summarizeExport,
} from './settings-data';

type Picked = { name: string; data: unknown; summary: ExportSummary };

export function SettingsScreen({ health }: { health: Health }) {
  const queryClient = useQueryClient();
  const exportNotice = useNotice();
  const importNotice = useNotice();
  const [picked, setPicked] = useState<Picked | undefined>(undefined);
  const [exporting, setExporting] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  async function exportData() {
    exportNotice.clear();
    setExporting(true);
    try {
      const file = await requestJson<unknown>('/api/data/export');
      const name = exportFileName(serviceToday());
      downloadJson(JSON.stringify(file, null, 2), name);
      const total = summarizeExport(file)?.total ?? 0;
      exportNotice.status(`Saved ${recordsText(total)} to ${name}`);
    } catch (error) {
      exportNotice.error(error, 'Could not export the data');
    } finally {
      setExporting(false);
    }
  }

  async function pick(event: ChangeEvent<HTMLInputElement>) {
    importNotice.clear();
    setPicked(undefined);
    const file = event.target.files?.[0];
    if (!file) return;
    let data: unknown;
    try {
      data = JSON.parse(await file.text());
    } catch {
      importNotice.error('This file is not valid JSON, so nothing was changed');
      return;
    }
    const summary = summarizeExport(data);
    if (!summary) {
      importNotice.error('This file is not a Dev Career Portfolio export, so nothing was changed');
      return;
    }
    setPicked({ name: file.name, data, summary });
  }

  async function importData() {
    if (!picked) return;
    importNotice.clear();
    try {
      await requestJson('/api/data/import', {
        method: 'POST',
        body: picked.data,
        timeoutMs: 120_000,
      });
      // Every list and the dashboard now show other data.
      await queryClient.invalidateQueries();
      importNotice.status(`Imported ${recordsText(picked.summary.total)} from ${picked.name}`);
      setPicked(undefined);
      if (fileInput.current) fileInput.current.value = '';
    } catch (error) {
      importNotice.error(error, 'Could not import the file');
    }
  }

  return (
    <section aria-labelledby="page-title" className="flex flex-col gap-6">
      <PageHeader title="Settings" description="App settings and data management">
        <p
          role={health.state === 'error' ? 'alert' : 'status'}
          className={
            health.state === 'error'
              ? 'text-body-sm text-destructive'
              : 'text-caption text-muted-foreground'
          }
        >
          {healthText(health)}
        </p>
      </PageHeader>

      <section aria-labelledby="export-title" className="flex flex-col gap-3">
        <h2 id="export-title">Export all data</h2>
        <p className="text-body-sm break-keep text-muted-foreground">
          Download every record as one JSON file. Keep it somewhere safe: it is the way back if the
          database is ever lost.
        </p>
        <Button
          type="button"
          variant="outline"
          className="w-fit"
          aria-disabled={exporting || undefined}
          onClick={() => {
            if (!exporting) void exportData();
          }}
        >
          <Download aria-hidden />
          {exporting ? 'Exporting…' : 'Export data'}
        </Button>
        <Notice notice={exportNotice.notice} />
      </section>

      <section aria-labelledby="import-title" className="flex flex-col gap-3">
        <h2 id="import-title">Import from a file</h2>
        <p className="text-body-sm break-keep text-muted-foreground">
          Restore the app from an export file. Importing replaces everything now in the app; it does
          not merge. If the file has a problem, nothing is changed.
        </p>
        <div className="flex max-w-md flex-col gap-2">
          <Label htmlFor="import-file">Export file (.json)</Label>
          <Input
            id="import-file"
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            onChange={(event) => void pick(event)}
          />
        </div>
        {picked ? (
          <p className="text-body-sm break-keep">
            {picked.name}: {recordsText(picked.summary.total)}, exported{' '}
            {picked.summary.exportedAt.slice(0, 10)}
          </p>
        ) : null}
        <ConfirmDialog
          title="Replace all data with this file?"
          description={
            <span className="break-keep">
              Everything now in the app will be deleted and replaced by{' '}
              {picked ? `the ${recordsText(picked.summary.total)} in ${picked.name}` : 'the file'}.
              This cannot be undone, so export first if you are unsure.
            </span>
          }
          confirmLabel="Replace all data"
          onConfirm={importData}
          trigger={
            <Button
              type="button"
              variant="destructive"
              className="w-fit"
              aria-disabled={!picked || undefined}
              onClick={(event) => {
                // Without a valid file the button does nothing instead of opening the dialog.
                if (!picked) event.preventDefault();
              }}
            >
              <Upload aria-hidden />
              Import data…
            </Button>
          }
        />
        <Notice notice={importNotice.notice} />
      </section>
    </section>
  );
}
