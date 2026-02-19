import type { ComponentSpec } from "./types";

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

let gradientCounter = 0;

function buildGradientDef(
  gradient: { angle: number; stops: { color: string; position: number }[] },
  id: string
): { def: string; url: string } {
  const rad = ((gradient.angle - 90) * Math.PI) / 180;
  const x1 = 50 + 50 * Math.cos(rad + Math.PI);
  const y1 = 50 + 50 * Math.sin(rad + Math.PI);
  const x2 = 50 + 50 * Math.cos(rad);
  const y2 = 50 + 50 * Math.sin(rad);
  const stops = gradient.stops
    .map(
      (s) =>
        `<stop offset="${s.position}%" stop-color="${s.color}" />`
    )
    .join("");
  const def = `<linearGradient id="${id}" x1="${x1.toFixed(1)}%" y1="${y1.toFixed(1)}%" x2="${x2.toFixed(1)}%" y2="${y2.toFixed(1)}%">${stops}</linearGradient>`;
  return { def, url: `url(#${id})` };
}

function resolveFill(
  s: ComponentSpec["style"],
  fallback: string,
  defs: string[]
): string {
  if (s.gradient && s.gradient.stops.length >= 2) {
    const id = `grad-${++gradientCounter}`;
    const g = buildGradientDef(s.gradient, id);
    defs.push(g.def);
    return g.url;
  }
  return s.fill || fallback;
}

function buildShadowFilter(
  shadow: { x: number; y: number; blur: number; color: string },
  id: string
): { def: string; attr: string } {
  const def = `<filter id="${id}" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="${shadow.x}" dy="${shadow.y}" stdDeviation="${shadow.blur / 2}" flood-color="${shadow.color}" flood-opacity="1" /></filter>`;
  return { def, attr: `filter="url(#${id})"` };
}

export function componentToSVG(spec: ComponentSpec): string {
  const { width: w, height: h } = spec.size;
  const s = spec.style;
  const content = spec.content ? escapeXml(spec.content) : "";

  switch (spec.type) {
    case "text": {
      const defs: string[] = [];
      const anchor =
        s.textAlign === "right"
          ? "end"
          : s.textAlign === "left"
            ? "start"
            : "middle";
      const tx =
        s.textAlign === "right" ? w : s.textAlign === "left" ? 0 : w / 2;
      const letterSpacingAttr = s.letterSpacing
        ? ` letter-spacing="${s.letterSpacing}"`
        : "";
      const opacityAttr =
        s.opacity !== undefined && s.opacity !== 1
          ? ` opacity="${s.opacity}"`
          : "";
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
        <text x="${tx}" y="${h / 2}"
          font-family="${s.fontFamily || "Inter, system-ui, sans-serif"}" font-size="${s.fontSize || 16}"
          font-weight="${s.fontWeight || 400}"
          fill="${s.color || "#000"}" text-anchor="${anchor}" dominant-baseline="middle"${letterSpacingAttr}${opacityAttr}
        >${content}</text>
      </svg>`;
    }

    case "button": {
      const defs: string[] = [];
      const fill = resolveFill(s, "#3B82F6", defs);
      const filterId = `btn-shadow-${++gradientCounter}`;
      let shadowAttr = "";
      if (s.shadow) {
        const sf = buildShadowFilter(s.shadow, filterId);
        defs.push(sf.def);
        shadowAttr = ` ${sf.attr}`;
      }
      // Subtle inner highlight
      const highlightId = `btn-hl-${gradientCounter}`;
      defs.push(
        `<linearGradient id="${highlightId}" x1="50%" y1="0%" x2="50%" y2="100%"><stop offset="0%" stop-color="rgba(255,255,255,0.15)" /><stop offset="100%" stop-color="rgba(0,0,0,0)" /></linearGradient>`
      );
      const radius = s.borderRadius ?? 6;
      const defsBlock =
        defs.length > 0 ? `<defs>${defs.join("")}</defs>` : "";
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
        ${defsBlock}
        <rect width="${w}" height="${h}" rx="${radius}" fill="${fill}"
          stroke="${s.stroke || "none"}" stroke-width="${s.strokeWidth || 0}"${shadowAttr} />
        <rect width="${w}" height="${h}" rx="${radius}" fill="url(#${highlightId})" />
        ${content ? `<text x="${w / 2}" y="${h / 2}"
          font-family="${s.fontFamily || "Inter, system-ui, sans-serif"}" font-size="${s.fontSize || 14}"
          font-weight="${s.fontWeight || 600}"
          fill="${s.color || "#fff"}" text-anchor="middle" dominant-baseline="middle"
        >${content}</text>` : ""}
      </svg>`;
    }

    case "shape": {
      const defs: string[] = [];
      const fill = resolveFill(s, "#ccc", defs);
      const defsBlock =
        defs.length > 0 ? `<defs>${defs.join("")}</defs>` : "";
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
        ${defsBlock}
        <rect width="${w}" height="${h}"
          rx="${s.borderRadius || 0}" fill="${fill}"
          stroke="${s.stroke || "none"}" stroke-width="${s.strokeWidth || 0}"
          opacity="${s.opacity ?? 1}" />
      </svg>`;
    }

    case "card": {
      const defs: string[] = [];
      const fill = resolveFill(s, "#fff", defs);
      const shadow = s.shadow || { x: 0, y: 4, blur: 12, color: "rgba(0,0,0,0.1)" };
      const filterId = `card-shadow-${++gradientCounter}`;
      const sf = buildShadowFilter(shadow, filterId);
      defs.push(sf.def);
      const radius = s.borderRadius ?? 8;
      const borderStroke = s.stroke || "rgba(0,0,0,0.06)";
      const defsBlock = `<defs>${defs.join("")}</defs>`;
      const childSVGs = (spec.children || [])
        .map((child) => {
          const cx = child.position.x - spec.position.x;
          const cy = child.position.y - spec.position.y;
          return `<g transform="translate(${cx},${cy})">${componentToSVG(child)}</g>`;
        })
        .join("\n");
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
        ${defsBlock}
        <rect width="${w}" height="${h}" rx="${radius}"
          fill="${fill}" ${sf.attr}
          stroke="${borderStroke}" stroke-width="${s.strokeWidth ?? 1}" />
        ${childSVGs}
      </svg>`;
    }

    case "container": {
      const defs: string[] = [];
      let bgRect = "";
      if (s.fill || s.gradient) {
        const fill = resolveFill(s, s.fill || "transparent", defs);
        bgRect = `<rect width="${w}" height="${h}" rx="${s.borderRadius || 0}" fill="${fill}" />`;
      }
      const defsBlock =
        defs.length > 0 ? `<defs>${defs.join("")}</defs>` : "";
      const innerSVGs = (spec.children || [])
        .map((child) => {
          const cx = child.position.x - spec.position.x;
          const cy = child.position.y - spec.position.y;
          return `<g transform="translate(${cx},${cy})">${componentToSVG(child)}</g>`;
        })
        .join("\n");
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
        ${defsBlock}
        ${bgRect}
        ${innerSVGs}
      </svg>`;
    }

    case "image-placeholder": {
      const defs: string[] = [];
      const bgFill = resolveFill(s, "#E5E7EB", defs);
      const defsBlock =
        defs.length > 0 ? `<defs>${defs.join("")}</defs>` : "";
      const radius = s.borderRadius ?? 8;
      const iconColor = s.stroke || "#9CA3AF";
      // Mountain + sun icon scaled to center
      const iconScale = Math.min(w, h) * 0.25;
      const ix = w / 2;
      const iy = h / 2 - 8;
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
        ${defsBlock}
        <rect width="${w}" height="${h}" rx="${radius}" fill="${bgFill}" />
        <g transform="translate(${ix - iconScale / 2},${iy - iconScale / 2})">
          <rect width="${iconScale}" height="${iconScale}" fill="none" />
          <path d="M${iconScale * 0.15},${iconScale * 0.8} L${iconScale * 0.4},${iconScale * 0.35} L${iconScale * 0.6},${iconScale * 0.55} L${iconScale * 0.75},${iconScale * 0.4} L${iconScale * 0.85},${iconScale * 0.8} Z"
            fill="${iconColor}" opacity="0.6" />
          <circle cx="${iconScale * 0.7}" cy="${iconScale * 0.25}" r="${iconScale * 0.1}"
            fill="${iconColor}" opacity="0.5" />
        </g>
        ${content ? `<text x="${ix}" y="${iy + iconScale / 2 + 16}" font-family="Inter, system-ui, sans-serif" font-size="11"
          fill="${iconColor}" text-anchor="middle" dominant-baseline="middle"
          opacity="0.8">${content}</text>` : ""}
      </svg>`;
    }

    case "icon": {
      const defs: string[] = [];
      const fill = resolveFill(s, "#6B7280", defs);
      const defsBlock =
        defs.length > 0 ? `<defs>${defs.join("")}</defs>` : "";
      const r = Math.min(w, h) / 2;
      const cx = w / 2;
      const cy = h / 2;
      // Choose icon path based on content hint
      const hint = (spec.content || "").toLowerCase();
      let iconPath: string;
      const s2 = r * 0.5; // icon inner size
      if (hint.includes("check") || hint.includes("success")) {
        iconPath = `<polyline points="${cx - s2 * 0.6},${cy} ${cx - s2 * 0.1},${cy + s2 * 0.5} ${cx + s2 * 0.7},${cy - s2 * 0.4}"
          fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />`;
      } else if (hint.includes("arrow") || hint.includes("next")) {
        iconPath = `<polyline points="${cx - s2 * 0.4},${cy - s2 * 0.5} ${cx + s2 * 0.4},${cy} ${cx - s2 * 0.4},${cy + s2 * 0.5}"
          fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />`;
      } else if (hint.includes("star") || hint.includes("rating")) {
        const points = [];
        for (let i = 0; i < 5; i++) {
          const angle = (i * 72 - 90) * (Math.PI / 180);
          const innerAngle = ((i * 72 + 36) - 90) * (Math.PI / 180);
          points.push(`${cx + s2 * 0.9 * Math.cos(angle)},${cy + s2 * 0.9 * Math.sin(angle)}`);
          points.push(`${cx + s2 * 0.4 * Math.cos(innerAngle)},${cy + s2 * 0.4 * Math.sin(innerAngle)}`);
        }
        iconPath = `<polygon points="${points.join(" ")}" fill="#fff" />`;
      } else {
        // Default: circle dot
        iconPath = `<circle cx="${cx}" cy="${cy}" r="${s2 * 0.35}" fill="#fff" />`;
      }
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
        ${defsBlock}
        <circle cx="${cx}" cy="${cy}" r="${r - 1}" fill="${fill}" />
        ${iconPath}
      </svg>`;
    }

    case "avatar": {
      const defs: string[] = [];
      const fill = resolveFill(s, "#6366F1", defs);
      const defsBlock =
        defs.length > 0 ? `<defs>${defs.join("")}</defs>` : "";
      const r = Math.min(w, h) / 2;
      const cx = w / 2;
      const cy = h / 2;
      // Extract initials from content (e.g. "John Doe" → "JD")
      const initials = (spec.content || "?")
        .split(/\s+/)
        .map((word) => word.charAt(0).toUpperCase())
        .slice(0, 2)
        .join("");
      const fontSize = s.fontSize || Math.round(r * 0.8);
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
        ${defsBlock}
        <circle cx="${cx}" cy="${cy}" r="${r - 1}" fill="${fill}" />
        <text x="${cx}" y="${cy}"
          font-family="${s.fontFamily || "Inter, system-ui, sans-serif"}" font-size="${fontSize}"
          font-weight="${s.fontWeight || 600}"
          fill="${s.color || "#fff"}" text-anchor="middle" dominant-baseline="central"
        >${escapeXml(initials)}</text>
      </svg>`;
    }

    case "badge": {
      const defs: string[] = [];
      const fill = resolveFill(s, "#10B981", defs);
      const defsBlock =
        defs.length > 0 ? `<defs>${defs.join("")}</defs>` : "";
      const radius = s.borderRadius ?? Math.min(h / 2, 12);
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
        ${defsBlock}
        <rect width="${w}" height="${h}" rx="${radius}" fill="${fill}" />
        ${content ? `<text x="${w / 2}" y="${h / 2}"
          font-family="${s.fontFamily || "Inter, system-ui, sans-serif"}" font-size="${s.fontSize || 11}"
          font-weight="${s.fontWeight || 600}"
          fill="${s.color || "#fff"}" text-anchor="middle" dominant-baseline="central"
          letter-spacing="${s.letterSpacing ?? 0.5}"
        >${content}</text>` : ""}
      </svg>`;
    }

    case "divider": {
      const color = s.stroke || s.fill || "#E5E7EB";
      const thickness = s.strokeWidth ?? 1;
      const isVertical = h > w * 2;
      if (isVertical) {
        const x = w / 2;
        return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
          <line x1="${x}" y1="0" x2="${x}" y2="${h}"
            stroke="${color}" stroke-width="${thickness}" opacity="${s.opacity ?? 1}" />
        </svg>`;
      }
      const y = h / 2;
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
        <line x1="0" y1="${y}" x2="${w}" y2="${y}"
          stroke="${color}" stroke-width="${thickness}" opacity="${s.opacity ?? 1}" />
      </svg>`;
    }

    case "input-field": {
      const radius = s.borderRadius ?? 6;
      const bgFill = s.fill || "#F9FAFB";
      const borderColor = s.stroke || "#D1D5DB";
      const placeholderText = content || "Enter text...";
      const fontSize = s.fontSize || 14;
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
        <rect width="${w}" height="${h}" rx="${radius}"
          fill="${bgFill}" stroke="${borderColor}" stroke-width="${s.strokeWidth ?? 1}" />
        <text x="12" y="${h / 2}"
          font-family="${s.fontFamily || "Inter, system-ui, sans-serif"}" font-size="${fontSize}"
          fill="${s.color || "#9CA3AF"}" dominant-baseline="central"
          opacity="0.7"
        >${escapeXml(placeholderText)}</text>
      </svg>`;
    }

    default:
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
        <rect width="${w}" height="${h}" fill="#eee" />
      </svg>`;
  }
}
