import { toPng, toJpeg } from "html-to-image";

export async function exportDesign(
  element: HTMLElement,
  format: "png" | "jpg" | "pdf",
  scale: number = 2
): Promise<Blob> {
  const options = {
    pixelRatio: scale,
    cacheBust: true,
  };

  if (format === "png") {
    const dataUrl = await toPng(element, options);
    return dataURLToBlob(dataUrl);
  }

  if (format === "jpg") {
    const dataUrl = await toJpeg(element, { ...options, quality: 0.92 });
    return dataURLToBlob(dataUrl);
  }

  // PDF: raster approach — render to PNG then embed in PDF
  const { jsPDF } = await import("jspdf");
  const dataUrl = await toPng(element, options);
  const w = element.offsetWidth * scale;
  const h = element.offsetHeight * scale;
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
