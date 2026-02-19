import type { Canvas } from "fabric";

export async function exportDesign(
  canvas: Canvas,
  format: "png" | "jpg" | "pdf",
  scale: number = 2
): Promise<Blob> {
  if (format === "png" || format === "jpg") {
    const dataUrl = canvas.toDataURL({
      format: format === "jpg" ? "jpeg" : "png",
      quality: format === "jpg" ? 0.92 : 1,
      multiplier: scale,
    });
    return dataURLToBlob(dataUrl);
  }

  // PDF: raster approach
  const { jsPDF } = await import("jspdf");
  const dataUrl = canvas.toDataURL({
    format: "png",
    multiplier: scale,
  });
  const w = (canvas.width ?? 1440) * scale;
  const h = (canvas.height ?? 900) * scale;
  const pdf = new jsPDF({
    orientation: w > h ? "landscape" : "portrait",
    unit: "px",
    format: [w, h],
  });
  pdf.addImage(dataUrl, "PNG", 0, 0, w, h);
  return pdf.output("blob");
}

function dataURLToBlob(dataUrl: string): Blob {
  const [header, data] = dataUrl.split(",");
  const mime = header.match(/:(.*?);/)?.[1] ?? "image/png";
  const binary = atob(data);
  const array = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) array[i] = binary.charCodeAt(i);
  return new Blob([array], { type: mime });
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
