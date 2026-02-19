"use client";

import { useState } from "react";
import { HexColorPicker } from "react-colorful";
import type { Palette } from "@/app/lib/types";

interface ColorPalettePickerProps {
  palette: Palette;
  onChange: (p: Palette) => void;
}

const PALETTE_PRESETS: { label: string; palette: Palette }[] = [
  {
    label: "Corporate Blue",
    palette: {
      primary: "#2563EB",
      secondary: "#7C3AED",
      accent: "#F59E0B",
      background: "#FFFFFF",
      text: "#1F2937",
    },
  },
  {
    label: "Warm Sunset",
    palette: {
      primary: "#DC2626",
      secondary: "#EA580C",
      accent: "#FBBF24",
      background: "#FFFBEB",
      text: "#292524",
    },
  },
  {
    label: "Dark Mode",
    palette: {
      primary: "#6366F1",
      secondary: "#8B5CF6",
      accent: "#22D3EE",
      background: "#0F172A",
      text: "#F1F5F9",
    },
  },
  {
    label: "Pastel",
    palette: {
      primary: "#93C5FD",
      secondary: "#C4B5FD",
      accent: "#FDE68A",
      background: "#F8FAFC",
      text: "#334155",
    },
  },
];

const SWATCH_KEYS: (keyof Palette)[] = [
  "primary",
  "secondary",
  "accent",
  "background",
  "text",
];

export default function ColorPalettePicker({
  palette,
  onChange,
}: ColorPalettePickerProps) {
  const [activeKey, setActiveKey] = useState<keyof Palette | null>(null);

  return (
    <div className="space-y-2">
      <p className="text-xs text-zinc-400 font-medium">Palette</p>

      {/* Swatches */}
      <div className="flex gap-1.5">
        {SWATCH_KEYS.map((key) => (
          <button
            key={key}
            onClick={() => setActiveKey(activeKey === key ? null : key)}
            className={`w-8 h-8 rounded border-2 transition-all ${
              activeKey === key ? "border-white scale-110" : "border-zinc-600"
            }`}
            style={{ backgroundColor: palette[key] }}
            title={key}
          />
        ))}
      </div>

      {/* Color picker popover */}
      {activeKey && (
        <div className="mt-1">
          <p className="text-xs text-zinc-500 mb-1 capitalize">{activeKey}</p>
          <HexColorPicker
            color={palette[activeKey]}
            onChange={(color) =>
              onChange({ ...palette, [activeKey]: color })
            }
            style={{ width: "100%", height: 120 }}
          />
        </div>
      )}

      {/* Presets */}
      <div className="flex flex-wrap gap-1">
        {PALETTE_PRESETS.map((preset) => (
          <button
            key={preset.label}
            onClick={() => {
              onChange(preset.palette);
              setActiveKey(null);
            }}
            className="text-[10px] px-1.5 py-0.5 bg-zinc-700 hover:bg-zinc-600 rounded text-zinc-300"
          >
            {preset.label}
          </button>
        ))}
      </div>
    </div>
  );
}
