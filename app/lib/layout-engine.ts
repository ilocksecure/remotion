import type { ComponentSpec, LayoutSpec } from "./types";

const GRID = 4;

export function processLayout(raw: LayoutSpec): LayoutSpec {
  let layout = structuredClone(raw);

  // 1. Clamp: ensure no component exceeds canvas bounds
  layout.components = layout.components.map((comp) => ({
    ...comp,
    position: {
      x: Math.max(
        0,
        Math.min(comp.position.x, layout.canvasWidth - comp.size.width)
      ),
      y: Math.max(
        0,
        Math.min(comp.position.y, layout.canvasHeight - comp.size.height)
      ),
    },
  }));

  // 2. Grid snap — positions only (preserve LLM's precise sizing)
  layout.components = layout.components.map((comp) => ({
    ...comp,
    position: {
      x: Math.round(comp.position.x / GRID) * GRID,
      y: Math.round(comp.position.y / GRID) * GRID,
    },
  }));

  // 3. Collision resolution — only nudge when overlap exceeds 25% of smaller component
  layout.components = resolveCollisions(layout.components);

  // 4. Z-index sort — preserve intentional layering gaps (no normalization)
  layout.components = layout.components.sort((a, b) => a.zIndex - b.zIndex);

  return layout;
}

function overlapArea(a: ComponentSpec, b: ComponentSpec): number {
  const ox = Math.max(
    0,
    Math.min(a.position.x + a.size.width, b.position.x + b.size.width) -
      Math.max(a.position.x, b.position.x)
  );
  const oy = Math.max(
    0,
    Math.min(a.position.y + a.size.height, b.position.y + b.size.height) -
      Math.max(a.position.y, b.position.y)
  );
  return ox * oy;
}

function resolveCollisions(components: ComponentSpec[]): ComponentSpec[] {
  const result = [...components];
  for (let i = 0; i < result.length; i++) {
    for (let j = i + 1; j < result.length; j++) {
      const a = result[i];
      const b = result[j];
      if (a.zIndex !== b.zIndex) continue;

      if (intersects(a, b)) {
        const overlap = overlapArea(a, b);
        const smallerArea = Math.min(
          a.size.width * a.size.height,
          b.size.width * b.size.height
        );
        // Only nudge when overlap > 25% of the smaller component
        if (overlap / smallerArea <= 0.25) continue;

        const overlapY = a.position.y + a.size.height - b.position.y;
        if (overlapY > 0) {
          result[j] = {
            ...b,
            position: { ...b.position, y: b.position.y + overlapY + GRID },
          };
        }
      }
    }
  }
  return result;
}

export function intersects(a: ComponentSpec, b: ComponentSpec): boolean {
  return !(
    a.position.x + a.size.width <= b.position.x ||
    b.position.x + b.size.width <= a.position.x ||
    a.position.y + a.size.height <= b.position.y ||
    b.position.y + b.size.height <= a.position.y
  );
}
