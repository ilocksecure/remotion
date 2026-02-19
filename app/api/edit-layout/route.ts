import { NextRequest, NextResponse } from "next/server";
import { generateText } from "ai";
import { google } from "@ai-sdk/google";
import { jsonrepair } from "jsonrepair";
import { LayoutSpecSchema, EditResponseSchema } from "@/app/lib/schemas";
import { buildEditPrompt } from "@/app/lib/prompt-builder";
import type { Palette } from "@/app/lib/types";
import { z } from "zod";

const RequestSchema = z.object({
  currentLayout: LayoutSpecSchema,
  editPrompt: z.string().min(1),
  style: z.enum(["minimal", "corporate", "playful", "luxury", "tech"]),
  palette: z.object({
    primary: z.string(),
    secondary: z.string(),
    accent: z.string(),
    background: z.string(),
    text: z.string(),
  }),
  dimensions: z.object({
    width: z.number(),
    height: z.number(),
  }),
});

function extractJson(text: string): string {
  let str = text.trim();
  if (str.startsWith("```")) {
    str = str.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?\s*```$/, "");
  }
  return str;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Repair common LLM issues in the regenerate layout response:
 * - Fill missing top-level fields (id, canvasWidth, canvasHeight, background, layers)
 * - Coerce fontWeight strings to numbers
 * - Coerce shadow strings to null (drop invalid)
 */
function repairResponse(
  parsed: any,
  dimensions: { width: number; height: number },
  bgColor: string
): any {
  if (parsed.mode !== "regenerate" || !parsed.layout) return parsed;

  const layout = parsed.layout;

  // Fill missing envelope fields
  if (!layout.id) layout.id = "layout-" + Date.now();
  if (!layout.canvasWidth) layout.canvasWidth = dimensions.width;
  if (!layout.canvasHeight) layout.canvasHeight = dimensions.height;
  if (!layout.background) {
    layout.background = { type: "solid", value: bgColor };
  }
  if (!layout.layers && Array.isArray(layout.components)) {
    layout.layers = [
      {
        id: "main",
        name: "Main",
        visible: true,
        locked: false,
        componentIds: layout.components.map((c: any) => c.id).filter(Boolean),
      },
    ];
  }

  // Fix component-level type issues
  if (Array.isArray(layout.components)) {
    for (const comp of layout.components) {
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
      // Drop invalid shadows (string instead of array)
      if (comp.style.shadows !== undefined) {
        if (typeof comp.style.shadows === "string") {
          delete comp.style.shadows;
        } else if (Array.isArray(comp.style.shadows)) {
          comp.style.shadows = comp.style.shadows.filter(
            (s: any) =>
              s &&
              typeof s === "object" &&
              typeof s.x === "number" &&
              typeof s.y === "number" &&
              typeof s.blur === "number" &&
              typeof s.color === "string"
          );
          if (comp.style.shadows.length === 0) {
            delete comp.style.shadows;
          }
        } else {
          delete comp.style.shadows;
        }
      }
      // Coerce textTransform to valid enum or drop
      if (
        comp.style.textTransform !== undefined &&
        !["uppercase", "lowercase", "capitalize", "none"].includes(
          comp.style.textTransform
        )
      ) {
        delete comp.style.textTransform;
      }
    }
  }

  return parsed;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { currentLayout, editPrompt, style, palette, dimensions } =
      RequestSchema.parse(body);

    console.log("[edit-layout] prompt:", editPrompt);

    const prompt = buildEditPrompt(currentLayout, editPrompt, {
      style,
      palette: palette as Palette,
      dimensions,
    });

    const { text } = await generateText({
      model: google("gemini-2.5-flash"),
      prompt:
        prompt +
        "\n\nIMPORTANT: Respond with ONLY valid JSON. No markdown fences. No comments. No trailing commas.",
    });

    const jsonStr = extractJson(text);
    const repaired = jsonrepair(jsonStr);
    const parsed = JSON.parse(repaired);
    const fixed = repairResponse(parsed, dimensions, palette.background);
    const editResponse = EditResponseSchema.parse(fixed);

    return NextResponse.json(editResponse);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Edit failed";
    console.error("edit-layout error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
