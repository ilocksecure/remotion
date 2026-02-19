import { z } from "zod";

// ─── Color Palette ───────────────────────────────────────────────
export const PaletteSchema = z.object({
  primary: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  secondary: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  accent: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  background: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  text: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});

// ─── Design Brief (User Input) ──────────────────────────────────
export const DesignBriefSchema = z.object({
  description: z.string().min(10).max(2000),
  palette: PaletteSchema,
  referenceImages: z
    .array(
      z.object({
        url: z.string(),
        base64: z.string(),
      })
    )
    .max(5),
  style: z.enum(["minimal", "corporate", "playful", "luxury", "tech"]),
  dimensions: z.object({
    width: z.number().int().min(320).max(3840),
    height: z.number().int().min(320).max(2160),
  }),
  targetFormat: z.enum(["web", "mobile", "presentation", "video-frame"]),
  industry: z.string().optional(),
});

// ─── Component Style ─────────────────────────────────────────────
export const ComponentStyleSchema = z.object({
  fill: z.string().optional(),
  stroke: z.string().optional(),
  strokeWidth: z.number().optional(),
  borderRadius: z.number().min(0).optional(),
  opacity: z.number().min(0).max(1).optional(),
  fontFamily: z.string().optional(),
  fontSize: z.number().min(8).max(200).optional(),
  fontWeight: z.number().min(100).max(900).optional(),
  textAlign: z.enum(["left", "center", "right"]).optional(),
  color: z.string().optional(),
  letterSpacing: z.number().optional(),
  lineHeight: z.number().optional(),
  gradient: z
    .object({
      angle: z.number(),
      stops: z.array(
        z.object({
          color: z.string(),
          position: z.number().min(0).max(100),
        })
      ),
    })
    .optional(),
  shadow: z
    .object({
      x: z.number(),
      y: z.number(),
      blur: z.number().min(0),
      color: z.string(),
    })
    .optional(),
});

// ─── Component Spec (recursive for children) ─────────────────────
export interface ComponentSpecInput {
  id: string;
  type:
    | "text"
    | "shape"
    | "icon"
    | "image-placeholder"
    | "button"
    | "card"
    | "container"
    | "avatar"
    | "badge"
    | "divider"
    | "input-field";
  position: { x: number; y: number };
  size: { width: number; height: number };
  rotation?: number;
  zIndex: number;
  style: z.infer<typeof ComponentStyleSchema>;
  children?: ComponentSpecInput[];
  content?: string;
}

export const ComponentSpecSchema: z.ZodType<ComponentSpecInput> = z.lazy(
  () =>
    z.object({
      id: z.string(),
      type: z.enum([
        "text",
        "shape",
        "icon",
        "image-placeholder",
        "button",
        "card",
        "container",
        "avatar",
        "badge",
        "divider",
        "input-field",
      ]),
      position: z.object({ x: z.number(), y: z.number() }),
      size: z.object({
        width: z.number().min(1),
        height: z.number().min(1),
      }),
      rotation: z.number().default(0),
      zIndex: z.number().int().min(0).default(0),
      style: ComponentStyleSchema,
      children: z.lazy(() => z.array(ComponentSpecSchema)).optional(),
      content: z.string().optional(),
    })
);

// ─── Background ──────────────────────────────────────────────────
export const BackgroundSchema = z.object({
  type: z.enum(["solid", "gradient", "image"]),
  value: z.string(),
  gradient: z
    .object({
      angle: z.number().default(180),
      stops: z.array(
        z.object({
          color: z.string(),
          position: z.number().min(0).max(100),
        })
      ),
    })
    .optional(),
});

// ─── Layer Spec ──────────────────────────────────────────────────
export const LayerSpecSchema = z.object({
  id: z.string(),
  name: z.string(),
  visible: z.boolean().default(true),
  locked: z.boolean().default(false),
  componentIds: z.array(z.string()),
});

// ─── Layout Spec (top-level output from LLM) ────────────────────
export const LayoutSpecSchema = z.object({
  id: z.string(),
  canvasWidth: z.number(),
  canvasHeight: z.number(),
  background: BackgroundSchema,
  components: z.array(ComponentSpecSchema).max(50),
  layers: z.array(LayerSpecSchema),
});

// ─── Component Changes (partial, for edit diffs) ─────────────────
export const ComponentChangesSchema = z.object({
  position: z.object({ x: z.number(), y: z.number() }).optional(),
  size: z.object({ width: z.number().min(1), height: z.number().min(1) }).optional(),
  rotation: z.number().optional(),
  zIndex: z.number().int().min(0).optional(),
  style: ComponentStyleSchema.optional(),
  content: z.string().optional(),
});

// ─── Edit Instructions (diff-based editing) ──────────────────────
export const EditInstructionSchema = z.object({
  operations: z.array(
    z.discriminatedUnion("action", [
      z.object({
        action: z.literal("modify"),
        componentId: z.string(),
        changes: ComponentChangesSchema,
      }),
      z.object({
        action: z.literal("add"),
        component: ComponentSpecSchema,
      }),
      z.object({
        action: z.literal("remove"),
        componentId: z.string(),
      }),
      z.object({
        action: z.literal("reorder"),
        componentId: z.string(),
        newZIndex: z.number(),
      }),
    ])
  ),
});
