import { NextRequest, NextResponse } from "next/server";
import { generateText } from "ai";
import { google } from "@ai-sdk/google";
import { jsonrepair } from "jsonrepair";

interface ClarifyQuestion {
  question: string;
  suggestions: string[];
}

interface ClarifyResponse {
  questions: ClarifyQuestion[];
}

export async function POST(req: NextRequest) {
  try {
    const { description, style, industry } = await req.json();

    if (!description || typeof description !== "string") {
      return NextResponse.json(
        { error: "description is required" },
        { status: 400 }
      );
    }

    const { text } = await generateText({
      model: google("gemini-2.5-flash"),
      prompt: `You are a UI design assistant. The user wants to create a design:
"${description}"
Style: ${style || "corporate"}
${industry ? `Industry: ${industry}` : ""}

Analyze this request and generate 2-3 brief clarifying questions to improve the design output.
Focus on: target audience, key sections/content needed, specific functionality, visual preferences.

If the description is already detailed enough (50+ words with specific sections mentioned), return an empty array.

Respond as JSON: { "questions": [{ "question": "...", "suggestions": ["option1", "option2", "option3"] }] }

IMPORTANT: Respond with ONLY valid JSON. No markdown fences. No comments.`,
    });

    let jsonStr = text.trim();
    if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr
        .replace(/^```(?:json)?\s*\n?/, "")
        .replace(/\n?\s*```$/, "");
    }

    const repaired = jsonrepair(jsonStr);
    const parsed: ClarifyResponse = JSON.parse(repaired);

    const questions = Array.isArray(parsed.questions)
      ? parsed.questions
          .filter(
            (q) =>
              q &&
              typeof q.question === "string" &&
              Array.isArray(q.suggestions)
          )
          .slice(0, 3)
      : [];

    return NextResponse.json({ questions });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Clarification failed";
    console.error("clarify error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
