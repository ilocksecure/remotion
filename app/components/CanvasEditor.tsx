"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { LayoutSpec } from "@/app/lib/types";
import { componentToSVG } from "@/app/lib/svg-mapper";

interface CanvasEditorProps {
  layout: LayoutSpec | null;
  onLayoutChange?: (layout: LayoutSpec) => void;
  onCanvasReady?: (canvas: import("fabric").Canvas) => void;
}

export default function CanvasEditor({
  layout,
  onLayoutChange,
  onCanvasReady,
}: CanvasEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<import("fabric").Canvas | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(100);
  const [isPanning, setIsPanning] = useState(false);
  const lastPanPoint = useRef<{ x: number; y: number } | null>(null);

  // Initialize Fabric canvas
  useEffect(() => {
    let mounted = true;

    async function init() {
      const fabric = await import("fabric");
      if (!mounted || !canvasRef.current) return;

      const canvas = new fabric.Canvas(canvasRef.current, {
        width: layout?.canvasWidth || 1440,
        height: layout?.canvasHeight || 900,
        backgroundColor: "#ffffff",
        selection: true,
      });

      fabricRef.current = canvas;
      onCanvasReady?.(canvas);

      // Sync canvas edits back to layout
      canvas.on("object:modified", (e) => {
        if (!onLayoutChange || !layout) return;
        const obj = e.target;
        if (!obj) return;
        const componentId = (obj as { data?: { componentId?: string } }).data
          ?.componentId;
        if (!componentId) return;

        const updated = {
          ...layout,
          components: layout.components.map((c) =>
            c.id === componentId
              ? {
                  ...c,
                  position: { x: obj.left ?? c.position.x, y: obj.top ?? c.position.y },
                  size: {
                    width: (obj.width ?? c.size.width) * (obj.scaleX ?? 1),
                    height: (obj.height ?? c.size.height) * (obj.scaleY ?? 1),
                  },
                  rotation: obj.angle ?? c.rotation,
                }
              : c
          ),
        };
        onLayoutChange(updated);
      });
    }

    init();

    return () => {
      mounted = false;
      fabricRef.current?.dispose();
      fabricRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Load layout into canvas
  const loadLayout = useCallback(async (spec: LayoutSpec) => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const fabric = await import("fabric");

    canvas.clear();
    canvas.setDimensions({
      width: spec.canvasWidth,
      height: spec.canvasHeight,
    });
    canvas.backgroundColor = spec.background?.value || "#ffffff";

    for (const comp of spec.components) {
      const svgString = componentToSVG(comp);
      try {
        const result = await fabric.loadSVGFromString(svgString);
        const group = fabric.util.groupSVGElements(
          result.objects.filter(Boolean) as InstanceType<typeof fabric.FabricObject>[],
        );

        group.set({
          left: comp.position.x,
          top: comp.position.y,
          data: { componentId: comp.id, type: comp.type },
          hasControls: true,
          hasBorders: true,
        });

        canvas.add(group);
      } catch (err) {
        console.warn(`Failed to load SVG for component ${comp.id}:`, err);
      }
    }

    canvas.renderAll();
  }, []);

  // Reload canvas when layout changes
  useEffect(() => {
    if (layout) loadLayout(layout);
  }, [layout, loadLayout]);

  // Zoom with mouse wheel
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    function handleWheel(e: WheelEvent) {
      if (!e.ctrlKey) return;
      e.preventDefault();
      setZoom((prev) => {
        const next = prev + (e.deltaY > 0 ? -10 : 10);
        return Math.max(25, Math.min(200, next));
      });
    }

    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => container.removeEventListener("wheel", handleWheel);
  }, []);

  // Space + drag = pan
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable) return;
      if (e.code === "Space" && !e.repeat) {
        e.preventDefault();
        setIsPanning(true);
      }
    }
    function handleKeyUp(e: KeyboardEvent) {
      if (e.code === "Space") {
        setIsPanning(false);
        lastPanPoint.current = null;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  function handleMouseDown(e: React.MouseEvent) {
    if (isPanning) lastPanPoint.current = { x: e.clientX, y: e.clientY };
  }

  function handleMouseMove(e: React.MouseEvent) {
    if (!isPanning || !lastPanPoint.current || !containerRef.current) return;
    const dx = e.clientX - lastPanPoint.current.x;
    const dy = e.clientY - lastPanPoint.current.y;
    containerRef.current.scrollLeft -= dx;
    containerRef.current.scrollTop -= dy;
    lastPanPoint.current = { x: e.clientX, y: e.clientY };
  }

  function handleMouseUp() {
    lastPanPoint.current = null;
  }

  function fitToScreen() {
    if (!containerRef.current || !layout) return;
    const containerW = containerRef.current.clientWidth;
    const containerH = containerRef.current.clientHeight;
    const scaleX = (containerW / layout.canvasWidth) * 100;
    const scaleY = (containerH / layout.canvasHeight) * 100;
    setZoom(Math.floor(Math.min(scaleX, scaleY, 100)));
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800 border-b border-zinc-700 text-xs text-zinc-400">
        <button
          onClick={() => setZoom((z) => Math.max(25, z - 10))}
          className="px-2 py-1 hover:bg-zinc-700 rounded"
        >
          -
        </button>
        <span className="w-12 text-center">{zoom}%</span>
        <button
          onClick={() => setZoom((z) => Math.min(200, z + 10))}
          className="px-2 py-1 hover:bg-zinc-700 rounded"
        >
          +
        </button>
        <button
          onClick={fitToScreen}
          className="px-2 py-1 hover:bg-zinc-700 rounded"
        >
          Fit
        </button>
      </div>
      <div
        ref={containerRef}
        className="flex-1 overflow-auto bg-zinc-900"
        style={{ cursor: isPanning ? "grab" : "default" }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      >
        <div
          className="inline-block m-8 shadow-2xl"
          style={{ transform: `scale(${zoom / 100})`, transformOrigin: "top left" }}
        >
          <canvas ref={canvasRef} />
        </div>
      </div>
    </div>
  );
}
