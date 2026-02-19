import { NextRequest, NextResponse } from "next/server";
import { generateText } from "ai";
import { google } from "@ai-sdk/google";
import { jsonrepair } from "jsonrepair";
import { DesignBriefSchema, LayoutSpecSchema } from "@/app/lib/schemas";
import { buildDesignPrompt } from "@/app/lib/prompt-builder";

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
    const brief = DesignBriefSchema.parse(body);
    const prompt = buildDesignPrompt(brief);

    const { text } = await generateText({
      model: google("gemini-2.5-flash"),
      prompt:
        prompt +
        "\n\nIMPORTANT: Respond with ONLY valid JSON. No markdown fences. No comments. No trailing commas. Ensure all string values are properly escaped. Output must be parseable by JSON.parse().",
    });

    const jsonStr = extractJson(text);
    const repaired = jsonrepair(jsonStr);
    const parsed = JSON.parse(repaired);

    const layout = LayoutSpecSchema.parse(parsed);
    return NextResponse.json(layout);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Layout generation failed";
    console.error("generate-layout error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
