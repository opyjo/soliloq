"use client";

import { useState } from "react";
import {
  AlertCircle,
  Check,
  Download,
  FileKey,
  FileJson,
  FileText,
  LockKeyhole,
  LoaderCircle,
  Upload,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Thought } from "@/lib/database.types";
import { decryptBackup, encryptBackup } from "@/lib/encrypted-backup";
import { useDialogAccessibility } from "@/lib/use-dialog-accessibility";

type ExportImportDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  thoughts: Thought[];
  onImportThoughts: (
    imported: unknown,
  ) => Promise<{ imported: number }>;
};

function parseCsvBackup(contents: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < contents.length; index += 1) {
    const character = contents[index];
    if (character === '"') {
      if (quoted && contents[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && contents[index + 1] === "\n") index += 1;
      row.push(cell);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += character;
    }
  }
  row.push(cell);
  if (row.some((value) => value.trim())) rows.push(row);
  if (rows.length === 0) return [];

  const headers = rows[0].map((header) => header.trim().toLowerCase());
  const titleIndex = headers.findIndex((header) =>
    ["title", "name", "subject"].includes(header),
  );
  const bodyIndex = headers.findIndex((header) =>
    ["body", "content", "text", "note"].includes(header),
  );
  const hasHeaders = titleIndex >= 0 || bodyIndex >= 0;

  return rows.slice(hasHeaders ? 1 : 0).map((values, index) => ({
    title:
      values[titleIndex >= 0 ? titleIndex : 0]?.trim() ||
      `Imported note ${index + 1}`,
    body:
      values[bodyIndex >= 0 ? bodyIndex : Math.min(1, values.length - 1)] ??
      "",
    status: "inbox",
  }));
}

export function ExportImportDialog({
  isOpen,
  onClose,
  thoughts,
  onImportThoughts,
}: ExportImportDialogProps) {
  const [importStatus, setImportStatus] = useState<{
    kind: "success" | "error";
    text: string;
  } | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [backupPassword, setBackupPassword] = useState("");
  const dialogRef = useDialogAccessibility<HTMLDivElement>(isOpen, onClose);

  if (!isOpen) return null;

  function exportAsJson() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(thoughts, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `still-thoughts-backup-${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  }

  function exportAsMarkdownFiles() {
    // Single formatted Markdown file with dividers for easy export without external zip dependency
    let mdContent = `# Still Thoughts Backup\nExported: ${new Date().toLocaleString()}\nTotal: ${thoughts.length}\n\n`;

    thoughts.forEach((t) => {
      mdContent += `--------------------------------------------------\n`;
      mdContent += `# ${t.title || "Untitled Thought"}\n`;
      mdContent += `*Status: ${t.status} | Pinned: ${t.is_pinned} | Created: ${t.created_at}*\n\n`;
      mdContent += `${t.body}\n\n`;
    });

    const dataStr = "data:text/markdown;charset=utf-8," + encodeURIComponent(mdContent);
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `still-thoughts-${new Date().toISOString().slice(0, 10)}.md`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  }

  async function exportEncryptedBackup() {
    setImportStatus(null);
    setIsImporting(true);
    try {
      const encrypted = await encryptBackup(thoughts, backupPassword);
      const href = URL.createObjectURL(
        new Blob([encrypted], { type: "application/json" }),
      );
      const downloadAnchor = document.createElement("a");
      downloadAnchor.href = href;
      downloadAnchor.download = `still-private-${new Date().toISOString().slice(0, 10)}.still`;
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      URL.revokeObjectURL(href);
      setImportStatus({
        kind: "success",
        text: "Encrypted backup created. Keep its password somewhere safe.",
      });
    } catch (error) {
      setImportStatus({
        kind: "error",
        text:
          error instanceof Error
            ? error.message
            : "The encrypted backup could not be created.",
      });
    } finally {
      setIsImporting(false);
    }
  }

  async function handleFileImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setImportStatus(null);

    try {
      if (file.size > 5_000_000) {
        throw new Error("Choose a backup smaller than 5 MB.");
      }

      const text = await file.text();
      const lowerName = file.name.toLowerCase();
      const imported = lowerName.endsWith(".still")
        ? await decryptBackup(text, backupPassword)
        : lowerName.endsWith(".json")
          ? JSON.parse(text)
          : lowerName.endsWith(".csv")
            ? parseCsvBackup(text)
            : lowerName.endsWith(".html") ||
                lowerName.endsWith(".htm")
              ? [
                  {
                    title: file.name.replace(/\.[^/.]+$/, ""),
                    body:
                      new DOMParser().parseFromString(text, "text/html").body
                        .textContent ?? "",
                    status: "inbox",
                  },
                ]
          : [
            {
              title: file.name.replace(/\.[^/.]+$/, ""),
              body: text,
              status: "inbox",
            },
          ];
      const result = await onImportThoughts(imported);
      setImportStatus({
        kind: "success",
        text: `Successfully imported ${result.imported} ${
          result.imported === 1 ? "thought" : "thoughts"
        }.`,
      });
    } catch (error) {
      setImportStatus({
        kind: "error",
        text:
          error instanceof Error
            ? error.message
            : "The selected file could not be imported.",
      });
    } finally {
      setIsImporting(false);
      e.target.value = "";
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isImporting) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-import-title"
        tabIndex={-1}
        className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--popover)] p-6 shadow-2xl outline-none"
      >
        <div className="flex items-center justify-between border-b border-[var(--border)] pb-4">
          <div
            id="export-import-title"
            className="flex items-center gap-2 font-semibold text-[var(--foreground)]"
          >
            <Download className="size-5 text-[var(--accent)]" />
            <span>Data Export & Import</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={onClose}
            disabled={isImporting}
            aria-label="Close export and import"
          >
            <X className="size-4" />
          </Button>
        </div>

        <div className="space-y-4 py-5">
          <div className="space-y-2">
            <div className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">
              Export ({thoughts.length} items)
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="secondary"
                onClick={exportAsJson}
                className="h-12 flex-col items-center justify-center gap-1 rounded-xl text-xs"
              >
                <FileJson className="size-4 text-[var(--accent)]" />
                <span>Backup JSON</span>
              </Button>
              <Button
                variant="secondary"
                onClick={exportAsMarkdownFiles}
                className="h-12 flex-col items-center justify-center gap-1 rounded-xl text-xs"
              >
                <FileText className="size-4 text-[var(--accent)]" />
                <span>Export Markdown</span>
              </Button>
            </div>
            <div className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
              <label className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
                <LockKeyhole className="size-4 text-[var(--accent)]" />
                <span className="font-medium">End-to-end encrypted backup</span>
              </label>
              <div className="mt-2 flex gap-2">
                <input
                  type="password"
                  value={backupPassword}
                  onChange={(event) => setBackupPassword(event.target.value)}
                  placeholder="Backup password"
                  autoComplete="new-password"
                  className="h-10 min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--input)] px-3 text-xs outline-none focus:border-[var(--border-strong)]"
                />
                <Button
                  variant="secondary"
                  onClick={() => void exportEncryptedBackup()}
                  disabled={isImporting}
                  className="h-10 shrink-0"
                >
                  <FileKey className="size-4" />
                  Encrypt
                </Button>
              </div>
              <p className="mt-2 text-[10px] leading-4 text-[var(--muted)]">
                Encryption happens only on this device. Still never receives the password.
              </p>
            </div>
          </div>

          <div className="space-y-2 pt-2">
            <div className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">
              Import
            </div>
            <label className="flex h-20 w-full cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface)] text-xs text-[var(--muted-foreground)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]">
              <Upload className="mb-1 size-5 text-[var(--accent)]" />
              <span>Choose Notion/CSV, JSON, Markdown, HTML, or .still</span>
              <input
                type="file"
                accept=".json,.md,.txt,.still,.csv,.html,.htm"
                onChange={handleFileImport}
                disabled={isImporting}
                className="sr-only"
              />
              {isImporting ? (
                <span className="mt-1 inline-flex items-center gap-1">
                  <LoaderCircle className="size-3 animate-spin" />
                  Saving imported thoughts…
                </span>
              ) : null}
            </label>
          </div>

          {importStatus ? (
            <div
              role="status"
              className={`flex items-center gap-2 rounded-xl p-3 text-xs ${
                importStatus.kind === "success"
                  ? "bg-[color-mix(in_srgb,var(--accent)_15%,transparent)] text-[var(--accent)]"
                  : "bg-[color-mix(in_srgb,var(--danger)_10%,transparent)] text-[var(--danger)]"
              }`}
            >
              {importStatus.kind === "success" ? (
                <Check className="size-4" />
              ) : (
                <AlertCircle className="size-4" />
              )}
              <span>{importStatus.text}</span>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
