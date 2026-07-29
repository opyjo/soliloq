"use client";

import { useState } from "react";
import { Download, Upload, FileText, FileJson, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Thought } from "@/lib/database.types";

type ExportImportDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  thoughts: Thought[];
  onImportThoughts: (imported: Partial<Thought>[]) => void;
};

export function ExportImportDialog({
  isOpen,
  onClose,
  thoughts,
  onImportThoughts,
}: ExportImportDialogProps) {
  const [importStatus, setImportStatus] = useState<string | null>(null);

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

  function handleFileImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        if (file.name.endsWith(".json")) {
          const parsed = JSON.parse(text);
          if (Array.isArray(parsed)) {
            onImportThoughts(parsed);
            setImportStatus(`Successfully imported ${parsed.length} thoughts.`);
          }
        } else if (file.name.endsWith(".md") || file.name.endsWith(".txt")) {
          onImportThoughts([
            {
              title: file.name.replace(/\.[^/.]+$/, ""),
              body: text,
              status: "inbox",
            },
          ]);
          setImportStatus("Imported markdown file as a new thought.");
        }
      } catch {
        setImportStatus("Error parsing file format.");
      }
    };
    reader.readAsText(file);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--popover)] p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-[var(--border)] pb-4">
          <div className="flex items-center gap-2 font-semibold text-[var(--foreground)]">
            <Download className="size-5 text-[var(--accent)]" />
            <span>Data Export & Import</span>
          </div>
          <Button variant="ghost" size="icon" className="size-8" onClick={onClose}>
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
          </div>

          <div className="space-y-2 pt-2">
            <div className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">
              Import
            </div>
            <label className="flex h-20 w-full cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface)] text-xs text-[var(--muted-foreground)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]">
              <Upload className="mb-1 size-5 text-[var(--accent)]" />
              <span>Click to select JSON or Markdown file</span>
              <input
                type="file"
                accept=".json,.md,.txt"
                onChange={handleFileImport}
                className="sr-only"
              />
            </label>
          </div>

          {importStatus ? (
            <div className="flex items-center gap-2 rounded-xl bg-[color-mix(in_srgb,var(--accent)_15%,transparent)] p-3 text-xs text-[var(--accent)]">
              <Check className="size-4" />
              <span>{importStatus}</span>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
