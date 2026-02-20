/**
 * Shared component repair logic — fixes common LLM output issues
 * before Zod validation. Used by both generate-layout (Option A)
 * and generate-layout-image (Option B) routes.
 */

const VALID_TYPES = new Set([
  "text", "shape", "icon", "image-placeholder", "button",
  "card", "container", "avatar", "badge", "divider", "input-field",
]);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function repairComponent(comp: any): void {
  // Coerce unknown type to nearest valid type
  if (comp.type && !VALID_TYPES.has(comp.type)) {
    const t = String(comp.type).toLowerCase();
    if (t.includes("heading") || t.includes("paragraph") || t.includes("label") || t.includes("title")) {
      comp.type = "text";
    } else if (t.includes("image") || t.includes("img") || t.includes("photo")) {
      comp.type = "image-placeholder";
    } else if (t.includes("line") || t.includes("separator") || t.includes("hr")) {
      comp.type = "divider";
    } else if (t.includes("list") || t.includes("section") || t.includes("group") || t.includes("nav") || t.includes("header") || t.includes("footer")) {
      comp.type = "container";
    } else {
      comp.type = "shape";
    }
  }

  // Clamp negative zIndex to 0
  if (typeof comp.zIndex === "number" && comp.zIndex < 0) {
    comp.zIndex = 0;
  }
  if (!comp.style) comp.style = {};

  // Coerce fontWeight string → number
  if (typeof comp.style.fontWeight === "string") {
    const n = parseInt(comp.style.fontWeight, 10);
    comp.style.fontWeight = isNaN(n) ? undefined : n;
  }

  // Drop invalid shadow (string instead of object)
  if (typeof comp.style.shadow === "string") {
    delete comp.style.shadow;
  }

  // Drop invalid shadows
  if (comp.style.shadows !== undefined) {
    if (typeof comp.style.shadows === "string") {
      delete comp.style.shadows;
    } else if (Array.isArray(comp.style.shadows)) {
      comp.style.shadows = comp.style.shadows.filter(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (s: any) =>
          s &&
          typeof s === "object" &&
          typeof s.x === "number" &&
          typeof s.y === "number" &&
          typeof s.blur === "number" &&
          typeof s.color === "string"
      );
      if (comp.style.shadows.length === 0) delete comp.style.shadows;
    } else {
      delete comp.style.shadows;
    }
  }

  // Recurse into children and filter out any that lack required fields
  if (Array.isArray(comp.children)) {
    comp.children = comp.children.filter(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (child: any) => child && typeof child === "object" && child.type
    );
    for (const child of comp.children) {
      repairComponent(child);
    }
    if (comp.children.length === 0) delete comp.children;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function repairComponents(parsed: any): void {
  if (Array.isArray(parsed.components)) {
    for (const comp of parsed.components) {
      repairComponent(comp);
    }
  }
}
