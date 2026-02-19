import { NextRequest, NextResponse } from "next/server";
import { generateText } from "ai";
import { google } from "@ai-sdk/google";
import { DesignBriefSchema, LayoutSpecSchema } from "@/app/lib/schemas";
import { buildDesignPrompt } from "@/app/lib/prompt-builder";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const brief = DesignBriefSchema.parse(body);
    const prompt = buildDesignPrompt(brief);

    const { text } = await generateText({
      model: google("gemini-2.5-flash"),
      prompt: prompt + "\n\nRespond with ONLY valid JSON matching the LayoutSpec schema. No markdown, no code fences, no explanation.",
    });

    // Extract JSON from response (strip markdown fences if present)
    let jsonStr = text.trim();
    if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }

    const parsed = JSON.parse(jsonStr);
    const layout = LayoutSpecSchema.parse(parsed);

    return NextResponse.json(layout);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Layout generation failed";
    console.error("generate-layout error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
