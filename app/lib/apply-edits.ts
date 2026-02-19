import type { LayoutSpec, EditInstruction } from "./types";

/**
 * Applies diff-based edit operations to a layout immutably.
 * Returns a new LayoutSpec with the operations applied.
 */
export function applyEdits(
  layout: LayoutSpec,
  operations: EditInstruction["operations"]
): LayoutSpec {
  const result: LayoutSpec = structuredClone(layout);

  for (const op of operations) {
    switch (op.action) {
      case "modify": {
        const comp = result.components.find((c) => c.id === op.componentId);
        if (!comp) break;
        const { changes } = op;
        if (changes.position) comp.position = changes.position;
        if (changes.size) comp.size = changes.size;
        if (changes.rotation !== undefined) comp.rotation = changes.rotation;
        if (changes.zIndex !== undefined) comp.zIndex = changes.zIndex;
        if (changes.content !== undefined) comp.content = changes.content;
        if (changes.style) {
          // Shallow-merge style, but replace gradient/shadow wholesale
          comp.style = {
            ...comp.style,
            ...changes.style,
          };
        }
        break;
      }

      case "add": {
        result.components.push(structuredClone(op.component));
        // Add to first layer's componentIds
        if (result.layers.length > 0) {
          result.layers[0].componentIds.push(op.component.id);
        }
        break;
      }

      case "remove": {
        result.components = result.components.filter(
          (c) => c.id !== op.componentId
        );
        for (const layer of result.layers) {
          layer.componentIds = layer.componentIds.filter(
            (id) => id !== op.componentId
          );
        }
        break;
      }

      case "reorder": {
        const comp = result.components.find((c) => c.id === op.componentId);
        if (comp) {
          comp.zIndex = op.newZIndex;
        }
        break;
      }
    }
  }

  return result;
}
