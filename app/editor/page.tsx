"use client";

import { useState, useRef } from "react";
import type { Canvas } from "fabric";
import CanvasEditor from "@/app/components/CanvasEditor";
import ChatPanel from "@/app/components/ChatPanel";
import type { ClarifyQuestion } from "@/app/components/ChatPanel";
import LayerPanel from "@/app/components/LayerPanel";
import ToolBar from "@/app/components/ToolBar";
import ExportDialog from "@/app/components/ExportDialog";
import type { LayoutSpec, DesignBrief } from "@/app/lib/types";
import { processLayout } from "@/app/lib/layout-engine";

type StylePreset = DesignBrief["style"];
type DimensionPreset = { label: string; width: number; height: number };

const DIMENSION_PRESETS: DimensionPreset[] = [
  { label: "Web", width: 1440, height: 900 },
  { label: "Mobile", width: 375, height: 812 },
  { label: "Tablet", width: 768, height: 1024 },
  { label: "Presentation", width: 1920, height: 1080 },
  { label: "Video Frame", width: 1920, height: 1080 },
];

const DEFAULT_PALETTE = {
  primary: "#2563EB",
  secondary: "#7C3AED",
  accent: "#F59E0B",
  background: "#FFFFFF",
  text: "#1F2937",
};

export default function EditorPage() {
  const [layout, setLayout] = useState<LayoutSpec | null>(null);
  const [loading, setLoading] = useState(false);
  const [style, setStyle] = useState<StylePreset>("corporate");
  const [dimensions, setDimensions] = useState(DIMENSION_PRESETS[0]);
  const [palette, setPalette] = useState(DEFAULT_PALETTE);
  const [error, setError] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const fabricCanvasRef = useRef<Canvas | null>(null);

  async function handleGenerate(
    prompt: string,
    images: { url: string; base64: string }[]
  ) {
    setLoading(true);
    setError(null);

    try {
      const brief: DesignBrief = {
        description: prompt,
        palette,
        referenceImages: images,
        style,
        dimensions: { width: dimensions.width, height: dimensions.height },
        targetFormat: "web",
      };

      const res = await fetch("/api/generate-layout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(brief),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Generation failed");
      }

      const rawLayout: LayoutSpec = await res.json();
      const processed = processLayout(rawLayout);
      setLayout(processed);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  async function handleClarify(prompt: string): Promise<ClarifyQuestion[]> {
    try {
      const res = await fetch("/api/clarify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: prompt, style }),
      });

      if (!res.ok) return [];

      const data = await res.json();
      return Array.isArray(data.questions) ? data.questions : [];
    } catch {
      return [];
    }
  }

  return (
    <div className="h-screen flex flex-col bg-zinc-900 text-white">
      <ToolBar
        style={style}
        onStyleChange={setStyle}
        dimensions={dimensions}
        dimensionPresets={DIMENSION_PRESETS}
        onDimensionsChange={setDimensions}
        layout={layout}
        onExport={() => setExportOpen(true)}
      />

      <div className="flex flex-1 min-h-0">
        {/* Left — Chat Panel */}
        <div className="w-[340px] border-r border-zinc-700 flex-shrink-0">
          <ChatPanel
            onGenerate={handleGenerate}
            onClarify={handleClarify}
            loading={loading}
            error={error}
            palette={palette}
            onPaletteChange={setPalette}
          />
        </div>

        {/* Center — Canvas */}
        <div className="flex-1 min-w-0">
          <CanvasEditor
            layout={layout}
            onLayoutChange={setLayout}
            onCanvasReady={(c) => {
              fabricCanvasRef.current = c;
            }}
          />
        </div>

        {/* Right — Layer Panel */}
        <div className="w-[240px] border-l border-zinc-700 flex-shrink-0">
          <LayerPanel layout={layout} />
        </div>
      </div>

      <ExportDialog
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        canvas={fabricCanvasRef.current}
      />
    </div>
  );
}
