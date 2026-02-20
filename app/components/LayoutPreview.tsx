"use client";

import { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from "react";
import type { LayoutSpec } from "@/app/lib/types";
import { LayoutRenderer } from "@/app/lib/react-renderer";

export interface LayoutPreviewHandle {
  getElement: () => HTMLDivElement | null;
}

interface LayoutPreviewProps {
  layout: LayoutSpec | null;
}

const LayoutPreview = forwardRef<LayoutPreviewHandle, LayoutPreviewProps>(
  function LayoutPreview({ layout }, ref) {
    const containerRef = useRef<HTMLDivElement>(null);
    const layoutRef = useRef<HTMLDivElement>(null);
    const [zoom, setZoom] = useState(100);
    const [isPanning, setIsPanning] = useState(false);
    const lastPanPoint = useRef<{ x: number; y: number } | null>(null);

    useImperativeHandle(ref, () => ({
      getElement: () => layoutRef.current,
    }));

    // Zoom with Ctrl+scroll
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
        if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable)
          return;
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

    const fitToScreen = useCallback(() => {
      if (!containerRef.current || !layout) return;
      const containerW = containerRef.current.clientWidth;
      const containerH = containerRef.current.clientHeight;
      const scaleX = (containerW / layout.canvasWidth) * 100;
      const scaleY = (containerH / layout.canvasHeight) * 100;
      // Leave some padding (90% of fit)
      setZoom(Math.floor(Math.min(scaleX, scaleY, 100) * 0.9));
    }, [layout]);

    return (
      <div className="flex flex-col h-full">
        {/* Zoom controls */}
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

        {/* Preview area */}
        <div
          ref={containerRef}
          className="flex-1 overflow-auto bg-zinc-900"
          style={{ cursor: isPanning ? "grab" : "default" }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
        >
          {layout ? (
            <div
              className="inline-block m-8 shadow-2xl"
              style={{
                transform: `scale(${zoom / 100})`,
                transformOrigin: "top left",
              }}
            >
              <div ref={layoutRef}>
                <LayoutRenderer layout={layout} />
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-zinc-600">
              <div className="text-center">
                <p className="text-lg font-medium mb-1">No design yet</p>
                <p className="text-sm">
                  Describe your design in the chat panel to get started.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }
);

export default LayoutPreview;
