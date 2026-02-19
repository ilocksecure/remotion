"use client";

import type { LayoutSpec } from "@/app/lib/types";

interface LayerPanelProps {
  layout: LayoutSpec | null;
}

export default function LayerPanel({ layout }: LayerPanelProps) {
  if (!layout) {
    return (
      <div className="p-4 text-zinc-500 text-sm">
        <p className="font-medium text-zinc-400 mb-2">Layers</p>
        <p>Generate a design to see layers.</p>
      </div>
    );
  }

  const sorted = [...layout.components].sort(
    (a, b) => b.zIndex - a.zIndex
  );

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-zinc-700">
        <p className="font-medium text-zinc-300 text-sm">Layers</p>
      </div>
      <div className="flex-1 overflow-y-auto">
        {sorted.map((comp) => (
          <div
            key={comp.id}
            className="flex items-center gap-2 px-3 py-1.5 hover:bg-zinc-800 cursor-pointer text-xs border-b border-zinc-800"
          >
            <span className="w-5 text-zinc-500 text-center">
              {typeIcon(comp.type)}
            </span>
            <span className="flex-1 truncate text-zinc-300">{comp.id}</span>
            <span className="text-zinc-600">{comp.type}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function typeIcon(type: string): string {
  switch (type) {
    case "text":
      return "T";
    case "shape":
      return "#";
    case "button":
      return "B";
    case "card":
      return "C";
    case "container":
      return "[]";
    case "image-placeholder":
      return "I";
    case "icon":
      return "*";
    default:
      return "?";
  }
}
