import { NextRequest, NextResponse } from "next/server";
import { generateText } from "ai";
import { google } from "@ai-sdk/google";
import { jsonrepair } from "jsonrepair";
import { DesignBriefSchema, LayoutSpecSchema } from "@/app/lib/schemas";
import { repairComponents } from "@/app/lib/repair-components";

function extractJson(text: string): string {
  let str = text.trim();
  if (str.startsWith("```")) {
    str = str.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?\s*```$/, "");
  }
  return str;
}

/** Map canvas dimensions to Gemini aspect ratio string */
function getAspectRatio(w: number, h: number): string {
  const ratio = w / h;
  if (ratio > 1.5) return "16:9";
  if (ratio < 0.7) return "9:16";
  if (ratio < 0.85) return "3:4";
  return "16:9";
}

/** Stage 1: Generate UI mockup image via Gemini image generation */
async function generateUIImage(
  description: string,
  style: string,
  palette: { primary: string; secondary: string; accent: string; background: string; text: string },
  aspectRatio: string
): Promise<string> {
  const apiKey =
    process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) throw new Error("Missing GEMINI_API_KEY environment variable");

  const model = process.env.IMAGE_GEN_MODEL || "gemini-2.5-flash-image";

  const prompt = `Generate a flat UI design screenshot for: ${description}

Style: ${style}
Color palette: primary ${palette.primary}, secondary ${palette.secondary}, accent ${palette.accent}, background ${palette.background}, text ${palette.text}

Requirements:
- Flat screenshot of the UI only — NO device mockup, NO browser frame, NO monitor, NO background
- Just the web page itself filling the entire image edge to edge
- Realistic readable text content (not placeholder lorem ipsum)
- Modern clean styling with proper shadows, spacing, and visual hierarchy
- Use the specified color palette consistently`;

  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: {
          "x-goog-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseModalities: ["TEXT", "IMAGE"],
            imageConfig: { aspectRatio },
          },
        }),
      }
    );

    if (response.status === 503 && attempt < maxAttempts) {
      console.log(
        `[generate-layout-image] 503 on attempt ${attempt}, retrying in ${attempt * 10}s...`
      );
      await new Promise((r) => setTimeout(r, attempt * 10_000));
      continue;
    }

    if (!response.ok) {
      const err = await response.text();
      throw new Error(
        `Image generation failed (${response.status}): ${err.slice(0, 300)}`
      );
    }

    const data = await response.json();
    const parts = data.candidates?.[0]?.content?.parts;
    if (!parts) throw new Error("No parts in image generation response");

    // Handle both camelCase and snake_case response fields
    for (const part of parts) {
      const imgData = part.inline_data?.data || part.inlineData?.data;
      if (imgData) return imgData;
    }

    throw new Error("No image data in response — model returned text only");
  }

  throw new Error("Image generation failed after all retry attempts");
}

/** Build the extraction prompt, parameterized with canvas and palette */
function buildExtractionPrompt(
  canvasWidth: number,
  canvasHeight: number,
  palette: { primary: string; secondary: string; accent: string; background: string; text: string },
  style: string
): string {
  return `You are a UI reverse-engineer. Analyze this UI design screenshot and extract every visible element into a structured JSON layout.

Output ONLY valid JSON matching this schema:
{
  "id": "layout-extracted",
  "canvasWidth": ${canvasWidth},
  "canvasHeight": ${canvasHeight},
  "background": { "type": "solid"|"gradient", "value": "#hex", "gradient?": { "angle": number, "stops": [{ "color": "#hex", "position": 0-100 }] } },
  "components": [
    {
      "id": "string (kebab-case, e.g. hero-title)",
      "type": "text|shape|icon|image-placeholder|button|card|container|avatar|badge|divider|input-field",
      "position": { "x": number, "y": number },
      "size": { "width": number, "height": number },
      "rotation": 0,
      "zIndex": number (0+),
      "style": {
        "fill?": "#hex or rgba()",
        "stroke?": "#hex",
        "strokeWidth?": number,
        "borderRadius?": number,
        "opacity?": 0-1,
        "fontFamily?": "string",
        "fontSize?": 8-200,
        "fontWeight?": 100-900 (number, not string),
        "textAlign?": "left|center|right",
        "color?": "#hex (text color)",
        "letterSpacing?": number,
        "gradient?": { "angle": number, "stops": [{ "color": "#hex", "position": 0-100 }] },
        "shadows?": [{ "x": number, "y": number, "blur": number, "color": "rgba()" }],
        "textTransform?": "uppercase|lowercase|capitalize|none"
      },
      "children?": [ ...same ComponentSpec shape ],
      "content?": "string (actual text content, button label, placeholder description, icon hint)"
    }
  ],
  "layers": [{ "id": "main", "name": "Main", "visible": true, "locked": false, "componentIds": ["all-component-ids"] }]
}

Design context: ${style} style, palette: primary ${palette.primary}, secondary ${palette.secondary}, accent ${palette.accent}, bg ${palette.background}, text ${palette.text}

Extraction rules:
- Map the image to a ${canvasWidth}x${canvasHeight} coordinate space
- Extract EVERY visible text element with its exact content, approximate font size, weight, and color
- Extract cards/containers as "card" type with children for their inner elements
- Extract buttons with their label text as content, background fill, and border radius
- Extract images as "image-placeholder" with descriptive content field
- Extract navigation bars as "container" with text/button children
- Extract badges/tags as "badge" type with textTransform "uppercase" if applicable
- Use "shape" for decorative background elements or colored sections
- Estimate colors by eyedropping from the image (use hex values)
- Estimate font sizes: titles 36-56px, subtitles 24-32px, body 14-16px, labels 11-13px
- Use multi-layer shadows on cards: [{ "x": 0, "y": 1, "blur": 3, "color": "rgba(0,0,0,0.08)" }, { "x": 0, "y": 4, "blur": 16, "color": "rgba(0,0,0,0.06)" }]
- Ensure proper z-index ordering (background shapes 0-1, cards 2-5, overlaid elements 6+)
- Keep total component count under 50 — group related elements into cards/containers with children
- fontWeight must be a NUMBER (e.g. 400, 600, 700), never a string
- All position x/y must be >= 0 and within canvas bounds

IMPORTANT: Output ONLY valid JSON. No markdown fences. No comments. No trailing commas. No explanation.`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    console.log("[generate-layout-image] prompt:", body.description);
    const brief = DesignBriefSchema.parse(body);

    const { width, height } = brief.dimensions;
    const aspectRatio = getAspectRatio(width, height);

    // Stage 1: Generate UI mockup image
    console.log("[generate-layout-image] Stage 1: generating image...");
    const imageBase64 = await generateUIImage(
      brief.description,
      brief.style,
      brief.palette,
      aspectRatio
    );
    console.log(
      `[generate-layout-image] Stage 1 complete: ${Math.round((imageBase64.length * 0.75) / 1024)}KB image`
    );

    // Stage 2: Extract LayoutSpec from image
    console.log("[generate-layout-image] Stage 2: extracting layout...");
    const extractionPrompt = buildExtractionPrompt(
      width,
      height,
      brief.palette,
      brief.style
    );

    const { text } = await generateText({
      model: google("gemini-2.5-flash"),
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              image: `data:image/png;base64,${imageBase64}`,
            },
            { type: "text", text: extractionPrompt },
          ],
        },
      ],
    });

    const jsonStr = extractJson(text);
    const repaired = jsonrepair(jsonStr);
    const parsed = JSON.parse(repaired);

    // Repair common LLM issues before Zod validation
    repairComponents(parsed);

    const layout = LayoutSpecSchema.parse(parsed);
    console.log(
      `[generate-layout-image] Done: ${layout.components.length} components`
    );
    return NextResponse.json(layout);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Image-first generation failed";
    console.error("[generate-layout-image] error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
