"use client";

import type { LayoutSpec, DesignBrief } from "@/app/lib/types";

type StylePreset = DesignBrief["style"];
type DimensionPreset = { label: string; width: number; height: number };

interface ToolBarProps {
  style: StylePreset;
  onStyleChange: (s: StylePreset) => void;
  dimensions: DimensionPreset;
  dimensionPresets: DimensionPreset[];
  onDimensionsChange: (d: DimensionPreset) => void;
  layout: LayoutSpec | null;
  onExport?: () => void;
}

const STYLES: StylePreset[] = [
  "minimal",
  "corporate",
  "playful",
  "luxury",
  "tech",
];

export default function ToolBar({
  style,
  onStyleChange,
  dimensions,
  dimensionPresets,
  onDimensionsChange,
  layout,
  onExport,
}: ToolBarProps) {
  return (
    <div className="flex items-center gap-4 px-4 py-2 bg-zinc-800 border-b border-zinc-700 text-sm">
      <span className="font-semibold text-white">Design Studio</span>

      <div className="h-4 w-px bg-zinc-600" />

      {/* Style Preset */}
      <label className="flex items-center gap-1.5 text-zinc-400">
        Style:
        <select
          value={style}
          onChange={(e) => onStyleChange(e.target.value as StylePreset)}
          className="bg-zinc-700 text-white px-2 py-1 rounded text-xs border border-zinc-600"
        >
          {STYLES.map((s) => (
            <option key={s} value={s}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </option>
          ))}
        </select>
      </label>

      {/* Dimension Preset */}
      <label className="flex items-center gap-1.5 text-zinc-400">
        Size:
        <select
          value={dimensions.label}
          onChange={(e) => {
            const preset = dimensionPresets.find(
              (d) => d.label === e.target.value
            );
            if (preset) onDimensionsChange(preset);
          }}
          className="bg-zinc-700 text-white px-2 py-1 rounded text-xs border border-zinc-600"
        >
          {dimensionPresets.map((d) => (
            <option key={d.label} value={d.label}>
              {d.label} ({d.width}x{d.height})
            </option>
          ))}
        </select>
      </label>

      <div className="flex-1" />

      {/* Component count */}
      {layout && (
        <span className="text-xs text-zinc-500">
          {layout.components.length} components
        </span>
      )}

      {/* Export */}
      {layout && onExport && (
        <button
          onClick={onExport}
          className="px-3 py-1 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 text-xs rounded border border-zinc-600"
        >
          Export
        </button>
      )}
    </div>
  );
}
