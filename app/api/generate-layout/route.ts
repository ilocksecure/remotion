import { NextRequest, NextResponse } from "next/server";
import { generateText } from "ai";
import { google } from "@ai-sdk/google";
import { jsonrepair } from "jsonrepair";
import { DesignBriefSchema, LayoutSpecSchema } from "@/app/lib/schemas";
import { buildDesignSpecPrompt, buildLayoutJsonPrompt } from "@/app/lib/prompt-builder";
import { repairComponents } from "@/app/lib/repair-components";

function extractJson(text: string): string {
  let str = text.trim();
  // Strip markdown code fences
  if (str.startsWith("```")) {
    str = str.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?\s*```$/, "");
  }
  return str;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    console.log("[generate-layout] prompt:", body.description);
    const brief = DesignBriefSchema.parse(body);

    // Stage 1: Generate detailed design spec (text-only, always)
    const designSpecPrompt = buildDesignSpecPrompt(brief);
    const { text: designSpec } = await generateText({
      model: google("gemini-2.5-flash"),
      prompt: designSpecPrompt,
    });
    console.log("[generate-layout] Stage 1 design spec:", designSpec.slice(0, 500));

    // Stage 2: Convert design spec → LayoutSpec JSON
    const jsonPrompt = buildLayoutJsonPrompt(brief, designSpec);
    const fullPrompt =
      jsonPrompt +
      "\n\nIMPORTANT: Respond with ONLY valid JSON. No markdown fences. No comments. No trailing commas. Ensure all string values are properly escaped. Output must be parseable by JSON.parse().";

    const hasImages =
      brief.referenceImages && brief.referenceImages.length > 0;

    const { text } = hasImages
      ? await generateText({
          model: google("gemini-2.5-flash"),
          messages: [
            {
              role: "user",
              content: [
                ...brief.referenceImages.map((img) => ({
                  type: "image" as const,
                  image: img.base64,
                })),
                { type: "text" as const, text: fullPrompt },
              ],
            },
          ],
        })
      : await generateText({
          model: google("gemini-2.5-flash"),
          prompt: fullPrompt,
        });

    const jsonStr = extractJson(text);
    const repaired = jsonrepair(jsonStr);
    const parsed = JSON.parse(repaired);

    // Repair common LLM issues before Zod validation
    repairComponents(parsed);

    const layout = LayoutSpecSchema.parse(parsed);
    return NextResponse.json(layout);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Layout generation failed";
    console.error("generate-layout error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
