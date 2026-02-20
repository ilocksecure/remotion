"use client";

import { useState } from "react";
import { exportDesign, downloadBlob } from "@/app/lib/export-utils";

interface ExportDialogProps {
  open: boolean;
  onClose: () => void;
  getElement: () => HTMLElement | null;
}

type ExportFormat = "png" | "jpg" | "pdf";
type ExportScale = 1 | 2 | 3;

export default function ExportDialog({
  open,
  onClose,
  getElement,
}: ExportDialogProps) {
  const [format, setFormat] = useState<ExportFormat>("png");
  const [scale, setScale] = useState<ExportScale>(2);
  const [exporting, setExporting] = useState(false);

  if (!open) return null;

  async function handleExport() {
    const element = getElement();
    if (!element) return;
    setExporting(true);
    try {
      const blob = await exportDesign(element, format, scale);
      const timestamp = Date.now();
      downloadBlob(blob, `design-${timestamp}.${format}`);
      onClose();
    } catch (err) {
      console.error("Export failed:", err);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-zinc-800 border border-zinc-700 rounded-lg p-6 w-80 shadow-xl">
        <h2 className="text-lg font-semibold text-white mb-4">
          Export Design
        </h2>

        {/* Format */}
        <label className="block text-sm text-zinc-400 mb-1">Format</label>
        <div className="flex gap-2 mb-4">
          {(["png", "jpg", "pdf"] as ExportFormat[]).map((f) => (
            <button
              key={f}
              onClick={() => setFormat(f)}
              className={`flex-1 py-1.5 text-sm rounded border ${
                format === f
                  ? "bg-blue-600 border-blue-500 text-white"
                  : "bg-zinc-700 border-zinc-600 text-zinc-300 hover:bg-zinc-600"
              }`}
            >
              {f.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Scale */}
        <label className="block text-sm text-zinc-400 mb-1">Scale</label>
        <div className="flex gap-2 mb-6">
          {([1, 2, 3] as ExportScale[]).map((s) => (
            <button
              key={s}
              onClick={() => setScale(s)}
              className={`flex-1 py-1.5 text-sm rounded border ${
                scale === s
                  ? "bg-blue-600 border-blue-500 text-white"
                  : "bg-zinc-700 border-zinc-600 text-zinc-300 hover:bg-zinc-600"
              }`}
            >
              {s}x
            </button>
          ))}
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2 text-sm bg-zinc-700 hover:bg-zinc-600 text-zinc-300 rounded"
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex-1 py-2 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded disabled:opacity-50"
          >
            {exporting ? "Exporting..." : "Download"}
          </button>
        </div>
      </div>
    </div>
  );
}
