import React from "react";
import type { ComponentSpec, LayoutSpec, Background } from "./types";

// ─── CSS Helpers ────────────────────────────────────────────────

function resolveBackground(style: ComponentSpec["style"], fallback: string): string {
  if (style.gradient && style.gradient.stops.length >= 2) {
    const stops = style.gradient.stops
      .map((s) => `${s.color} ${s.position}%`)
      .join(", ");
    return `linear-gradient(${style.gradient.angle}deg, ${stops})`;
  }
  return style.fill || fallback;
}

function resolveBoxShadow(style: ComponentSpec["style"]): string | undefined {
  if (style.shadows && style.shadows.length > 0) {
    return style.shadows
      .map((s) => `${s.x}px ${s.y}px ${s.blur}px ${s.color}`)
      .join(", ");
  }
  if (style.shadow) {
    const s = style.shadow;
    return `${s.x}px ${s.y}px ${s.blur}px ${s.color}`;
  }
  return undefined;
}

function resolveCanvasBackground(bg: Background): string {
  if (bg.type === "gradient" && bg.gradient && bg.gradient.stops.length >= 2) {
    const stops = bg.gradient.stops
      .map((s) => `${s.color} ${s.position}%`)
      .join(", ");
    return `linear-gradient(${bg.gradient.angle ?? 180}deg, ${stops})`;
  }
  return bg.value || "#ffffff";
}

function applyTextTransform(
  text: string,
  transform: string | undefined
): string {
  if (!transform || transform === "none") return text;
  switch (transform) {
    case "uppercase":
      return text.toUpperCase();
    case "lowercase":
      return text.toLowerCase();
    case "capitalize":
      return text.replace(/\b\w/g, (c) => c.toUpperCase());
    default:
      return text;
  }
}

// ─── Child Positioning ──────────────────────────────────────────

function resolveChildPosition(
  child: ComponentSpec,
  parent: ComponentSpec
): { left: number; top: number } {
  // Try absolute→relative conversion: child has canvas-absolute coords
  const relX = child.position.x - parent.position.x;
  const relY = child.position.y - parent.position.y;

  // If result is within parent bounds, the child had absolute coords
  if (relX >= 0 && relX < parent.size.width && relY >= 0 && relY < parent.size.height) {
    return { left: relX, top: relY };
  }

  // Otherwise, assume child positions are already relative to parent
  return { left: child.position.x, top: child.position.y };
}

// ─── Component Renderers ────────────────────────────────────────

function renderText(spec: ComponentSpec): React.ReactNode {
  const { style: s, size } = spec;
  const content = applyTextTransform(spec.content || "", s.textTransform);

  return (
    <div
      style={{
        width: size.width,
        height: size.height,
        display: "flex",
        alignItems: "center",
        justifyContent:
          s.textAlign === "right"
            ? "flex-end"
            : s.textAlign === "left"
              ? "flex-start"
              : "center",
        fontFamily: s.fontFamily || "Inter, system-ui, sans-serif",
        fontSize: s.fontSize || 16,
        fontWeight: s.fontWeight || 400,
        color: s.color || "#000",
        letterSpacing: s.letterSpacing ? `${s.letterSpacing}px` : undefined,
        lineHeight: s.lineHeight ? `${s.lineHeight}` : undefined,
        opacity: s.opacity,
        textShadow: resolveBoxShadow(s)
          ? s.shadows?.map((sh) => `${sh.x}px ${sh.y}px ${sh.blur}px ${sh.color}`).join(", ") ||
            (s.shadow ? `${s.shadow.x}px ${s.shadow.y}px ${s.shadow.blur}px ${s.shadow.color}` : undefined)
          : undefined,
        overflow: "hidden",
        textOverflow: "ellipsis",
      }}
    >
      {content}
    </div>
  );
}

function renderButton(spec: ComponentSpec): React.ReactNode {
  const { style: s, size } = spec;
  const content = applyTextTransform(spec.content || "", s.textTransform);
  const bg = resolveBackground(s, "#3B82F6");

  return (
    <div
      style={{
        width: size.width,
        height: size.height,
        background: bg,
        borderRadius: s.borderRadius ?? 6,
        border: s.stroke ? `${s.strokeWidth || 1}px solid ${s.stroke}` : "none",
        boxShadow: resolveBoxShadow(s),
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: s.fontFamily || "Inter, system-ui, sans-serif",
        fontSize: s.fontSize || 14,
        fontWeight: s.fontWeight || 600,
        color: s.color || "#fff",
        cursor: "pointer",
        overflow: "hidden",
        // Subtle inner highlight via inset shadow
        backgroundImage: `linear-gradient(to bottom, rgba(255,255,255,0.15) 0%, rgba(0,0,0,0) 100%)`,
        backgroundBlendMode: "overlay" as const,
      }}
    >
      {content}
    </div>
  );
}

function renderShape(spec: ComponentSpec): React.ReactNode {
  const { style: s, size } = spec;
  const bg = resolveBackground(s, "#ccc");

  return (
    <div
      style={{
        width: size.width,
        height: size.height,
        background: bg,
        borderRadius: s.borderRadius || 0,
        border: s.stroke ? `${s.strokeWidth || 1}px solid ${s.stroke}` : "none",
        opacity: s.opacity ?? 1,
        boxShadow: resolveBoxShadow(s),
      }}
    />
  );
}

function renderCard(spec: ComponentSpec): React.ReactNode {
  const { style: s, size } = spec;
  const bg = resolveBackground(s, "#fff");
  const shadow =
    resolveBoxShadow(s) ||
    "0 1px 3px rgba(0,0,0,0.08), 0 4px 16px rgba(0,0,0,0.06)";

  return (
    <div
      style={{
        width: size.width,
        height: size.height,
        background: bg,
        borderRadius: s.borderRadius ?? 8,
        border: `${s.strokeWidth ?? 1}px solid ${s.stroke || "rgba(0,0,0,0.06)"}`,
        boxShadow: shadow,
        overflow: "hidden",
        position: "relative",
      }}
    >
      {(spec.children || []).map((child) => {
        const pos = resolveChildPosition(child, spec);
        return (
          <div
            key={child.id}
            style={{
              position: "absolute",
              left: pos.left,
              top: pos.top,
              transform: child.rotation ? `rotate(${child.rotation}deg)` : undefined,
            }}
          >
            {componentToReact(child)}
          </div>
        );
      })}
    </div>
  );
}

function renderContainer(spec: ComponentSpec): React.ReactNode {
  const { style: s, size } = spec;
  const hasBg = s.fill || s.gradient;

  return (
    <div
      style={{
        width: size.width,
        height: size.height,
        background: hasBg ? resolveBackground(s, "transparent") : "transparent",
        borderRadius: s.borderRadius || 0,
        overflow: "hidden",
        position: "relative",
      }}
    >
      {(spec.children || []).map((child) => {
        const pos = resolveChildPosition(child, spec);
        return (
          <div
            key={child.id}
            style={{
              position: "absolute",
              left: pos.left,
              top: pos.top,
              transform: child.rotation ? `rotate(${child.rotation}deg)` : undefined,
            }}
          >
            {componentToReact(child)}
          </div>
        );
      })}
    </div>
  );
}

function renderImagePlaceholder(spec: ComponentSpec): React.ReactNode {
  const { style: s, size } = spec;
  const bg = resolveBackground(s, "#E5E7EB");
  const iconColor = s.stroke || "#9CA3AF";
  const content = spec.content || "";

  return (
    <div
      style={{
        width: size.width,
        height: size.height,
        background: bg,
        borderRadius: s.borderRadius ?? 8,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        overflow: "hidden",
      }}
    >
      {/* Mountain + Sun icon */}
      <svg
        width={Math.min(size.width, size.height) * 0.3}
        height={Math.min(size.width, size.height) * 0.3}
        viewBox="0 0 24 24"
        fill="none"
      >
        <path
          d="M4 20L9 12L13 16L17 10L20 20H4Z"
          fill={iconColor}
          opacity={0.6}
        />
        <circle cx={16} cy={7} r={2.5} fill={iconColor} opacity={0.5} />
      </svg>
      {content && (
        <span
          style={{
            fontFamily: "Inter, system-ui, sans-serif",
            fontSize: 11,
            color: iconColor,
            opacity: 0.8,
          }}
        >
          {content}
        </span>
      )}
    </div>
  );
}

function renderIcon(spec: ComponentSpec): React.ReactNode {
  const { style: s, size } = spec;
  const bg = resolveBackground(s, "#6B7280");
  const r = Math.min(size.width, size.height) / 2;
  const hint = (spec.content || "").toLowerCase();

  let iconPath: React.ReactNode;
  if (hint.includes("check") || hint.includes("success")) {
    iconPath = (
      <polyline
        points="6,12 10,16 18,8"
        fill="none"
        stroke="#fff"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    );
  } else if (hint.includes("arrow") || hint.includes("next")) {
    iconPath = (
      <polyline
        points="9,6 15,12 9,18"
        fill="none"
        stroke="#fff"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    );
  } else if (hint.includes("star") || hint.includes("rating")) {
    iconPath = (
      <polygon
        points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"
        fill="#fff"
      />
    );
  } else {
    iconPath = <circle cx="12" cy="12" r="4" fill="#fff" />;
  }

  return (
    <div
      style={{
        width: size.width,
        height: size.height,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          width: r * 2 - 2,
          height: r * 2 - 2,
          borderRadius: "50%",
          background: bg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg width="60%" height="60%" viewBox="0 0 24 24" fill="none">
          {iconPath}
        </svg>
      </div>
    </div>
  );
}

function renderAvatar(spec: ComponentSpec): React.ReactNode {
  const { style: s, size } = spec;
  const bg = resolveBackground(s, "#6366F1");
  const r = Math.min(size.width, size.height) / 2;
  const rawInitials = (spec.content || "?")
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase())
    .slice(0, 2)
    .join("");
  const initials = applyTextTransform(rawInitials, s.textTransform);
  const fontSize = s.fontSize || Math.round(r * 0.8);

  return (
    <div
      style={{
        width: size.width,
        height: size.height,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          width: r * 2 - 2,
          height: r * 2 - 2,
          borderRadius: "50%",
          background: bg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: s.fontFamily || "Inter, system-ui, sans-serif",
          fontSize,
          fontWeight: s.fontWeight || 600,
          color: s.color || "#fff",
        }}
      >
        {initials}
      </div>
    </div>
  );
}

function renderBadge(spec: ComponentSpec): React.ReactNode {
  const { style: s, size } = spec;
  const bg = resolveBackground(s, "#10B981");
  const rawContent = spec.content || "";
  // Default textTransform to uppercase for badges
  const content = s.textTransform
    ? applyTextTransform(rawContent, s.textTransform)
    : rawContent.toUpperCase();

  return (
    <div
      style={{
        width: size.width,
        height: size.height,
        background: bg,
        borderRadius: s.borderRadius ?? Math.min(size.height / 2, 12),
        boxShadow: resolveBoxShadow(s),
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: s.fontFamily || "Inter, system-ui, sans-serif",
        fontSize: s.fontSize || 11,
        fontWeight: s.fontWeight || 600,
        color: s.color || "#fff",
        letterSpacing: s.letterSpacing ?? 0.5,
        overflow: "hidden",
      }}
    >
      {content}
    </div>
  );
}

function renderDivider(spec: ComponentSpec): React.ReactNode {
  const { style: s, size } = spec;
  const color = s.stroke || s.fill || "#E5E7EB";
  const thickness = s.strokeWidth ?? 1;
  const isVertical = size.height > size.width * 2;

  return (
    <div
      style={{
        width: size.width,
        height: size.height,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={
          isVertical
            ? {
                width: thickness,
                height: "100%",
                background: color,
                opacity: s.opacity ?? 1,
              }
            : {
                width: "100%",
                height: thickness,
                background: color,
                opacity: s.opacity ?? 1,
              }
        }
      />
    </div>
  );
}

function renderInputField(spec: ComponentSpec): React.ReactNode {
  const { style: s, size } = spec;
  const content = spec.content || "Enter text...";

  return (
    <div
      style={{
        width: size.width,
        height: size.height,
        background: s.fill || "#F9FAFB",
        border: `${s.strokeWidth ?? 1}px solid ${s.stroke || "#D1D5DB"}`,
        borderRadius: s.borderRadius ?? 6,
        display: "flex",
        alignItems: "center",
        paddingLeft: 12,
        fontFamily: s.fontFamily || "Inter, system-ui, sans-serif",
        fontSize: s.fontSize || 14,
        color: s.color || "#9CA3AF",
        opacity: 0.7,
        overflow: "hidden",
      }}
    >
      {content}
    </div>
  );
}

// ─── Main Renderer ──────────────────────────────────────────────

export function componentToReact(spec: ComponentSpec): React.ReactNode {
  switch (spec.type) {
    case "text":
      return renderText(spec);
    case "button":
      return renderButton(spec);
    case "shape":
      return renderShape(spec);
    case "card":
      return renderCard(spec);
    case "container":
      return renderContainer(spec);
    case "image-placeholder":
      return renderImagePlaceholder(spec);
    case "icon":
      return renderIcon(spec);
    case "avatar":
      return renderAvatar(spec);
    case "badge":
      return renderBadge(spec);
    case "divider":
      return renderDivider(spec);
    case "input-field":
      return renderInputField(spec);
    default:
      return (
        <div
          style={{
            width: spec.size.width,
            height: spec.size.height,
            background: "#eee",
          }}
        />
      );
  }
}

// ─── Layout Renderer ────────────────────────────────────────────

export interface LayoutRendererProps {
  layout: LayoutSpec;
}

export function LayoutRenderer({ layout }: LayoutRendererProps) {
  const bg = resolveCanvasBackground(layout.background);
  const isGradient = bg.startsWith("linear-gradient");

  const sorted = [...layout.components].sort((a, b) => a.zIndex - b.zIndex);

  return (
    <div
      style={{
        position: "relative",
        width: layout.canvasWidth,
        height: layout.canvasHeight,
        background: isGradient ? bg : undefined,
        backgroundColor: isGradient ? undefined : bg,
        overflow: "hidden",
      }}
    >
      {sorted.map((comp) => (
        <div
          key={comp.id}
          style={{
            position: "absolute",
            left: comp.position.x,
            top: comp.position.y,
            zIndex: comp.zIndex,
            transform: comp.rotation ? `rotate(${comp.rotation}deg)` : undefined,
          }}
        >
          {componentToReact(comp)}
        </div>
      ))}
    </div>
  );
}
