import type { ComponentSpec } from "./types";

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function componentToSVG(spec: ComponentSpec): string {
  const { width: w, height: h } = spec.size;
  const s = spec.style;
  const content = spec.content ? escapeXml(spec.content) : "";

  switch (spec.type) {
    case "text":
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
        <text x="${w / 2}" y="${h / 2}"
          font-family="${s.fontFamily || "Inter"}" font-size="${s.fontSize || 16}"
          font-weight="${s.fontWeight || 400}"
          fill="${s.color || "#000"}" text-anchor="middle" dominant-baseline="middle"
        >${content}</text>
      </svg>`;

    case "button":
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
        <rect width="${w}" height="${h}"
          rx="${s.borderRadius || 0}" fill="${s.fill || "#ccc"}"
          stroke="${s.stroke || "none"}" stroke-width="${s.strokeWidth || 0}" />
        ${content ? `<text x="${w / 2}" y="${h / 2}"
          font-family="${s.fontFamily || "Inter"}" font-size="${s.fontSize || 14}"
          fill="${s.color || "#fff"}" text-anchor="middle" dominant-baseline="middle"
        >${content}</text>` : ""}
      </svg>`;

    case "shape":
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
        <rect width="${w}" height="${h}"
          rx="${s.borderRadius || 0}" fill="${s.fill || "#ccc"}"
          stroke="${s.stroke || "none"}" stroke-width="${s.strokeWidth || 0}"
          opacity="${s.opacity ?? 1}" />
      </svg>`;

    case "card": {
      const shadowFilter = s.shadow
        ? `filter="drop-shadow(${s.shadow.x}px ${s.shadow.y}px ${s.shadow.blur}px ${s.shadow.color})"`
        : "";
      const childSVGs = (spec.children || [])
        .map((child) => {
          const cx = child.position.x - spec.position.x;
          const cy = child.position.y - spec.position.y;
          return `<g transform="translate(${cx},${cy})">${componentToSVG(child)}</g>`;
        })
        .join("\n");
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
        <rect width="${w}" height="${h}" rx="${s.borderRadius || 8}"
          fill="${s.fill || "#fff"}" ${shadowFilter} />
        ${childSVGs}
      </svg>`;
    }

    case "container": {
      const innerSVGs = (spec.children || [])
        .map((child) => {
          const cx = child.position.x - spec.position.x;
          const cy = child.position.y - spec.position.y;
          return `<g transform="translate(${cx},${cy})">${componentToSVG(child)}</g>`;
        })
        .join("\n");
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
        ${s.fill ? `<rect width="${w}" height="${h}" rx="${s.borderRadius || 0}" fill="${s.fill}" />` : ""}
        ${innerSVGs}
      </svg>`;
    }

    case "image-placeholder":
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
        <rect width="${w}" height="${h}" rx="4"
          fill="#f0f0f0" stroke="#bbb" stroke-width="2" stroke-dasharray="8 4" />
        <text x="${w / 2}" y="${h / 2}" font-size="12" fill="#888"
          text-anchor="middle" dominant-baseline="middle">Image: ${content || "placeholder"}</text>
      </svg>`;

    case "icon":
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
        <circle cx="${w / 2}" cy="${h / 2}" r="${Math.min(w, h) / 2 - 2}"
          fill="${s.fill || "#ccc"}" stroke="${s.stroke || "none"}" />
      </svg>`;

    default:
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
        <rect width="${w}" height="${h}" fill="#eee" />
      </svg>`;
  }
}
