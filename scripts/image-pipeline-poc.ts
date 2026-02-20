/**
 * Proof-of-concept: Image-first UI generation pipeline
 *
 * Stage 1: Text prompt → Gemini image generation → UI mockup PNG
 * Stage 2: UI mockup PNG → Gemini 2.5 Flash vision → LayoutSpec JSON
 *
 * Usage: npx tsx scripts/image-pipeline-poc.ts
 */

import { writeFileSync, mkdirSync } from "fs";
import path from "path";

const API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
if (!API_KEY) {
  console.error("Missing GEMINI_API_KEY in environment. Run with: node --env-file=.env.local scripts/image-pipeline-poc.ts");
  process.exit(1);
}

const OUT_DIR = path.join(process.cwd(), "scripts", "poc-output");
mkdirSync(OUT_DIR, { recursive: true });

// ─── Stage 1: Generate UI mockup image ─────────────────────────────

async function generateUIImage(prompt: string): Promise<string> {
  console.log("\n━━━ Stage 1: Generating UI mockup image ━━━");
  console.log(`Prompt: "${prompt}"`);
  const model = process.env.IMAGE_MODEL || "gemini-2.5-flash-image";
  const supportsAspectRatio = !model.includes("2.0-flash-exp");
  console.log(`Model: ${model}`);
  console.log("Waiting...\n");

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: {
        "x-goog-api-key": API_KEY!,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: `Generate a flat UI design screenshot for: ${prompt}

Requirements:
- Flat screenshot of the UI only — NO device mockup, NO browser frame, NO monitor, NO background
- Just the web page itself filling the entire image edge to edge
- Realistic readable text content (not placeholder)
- Modern clean styling with proper shadows, spacing, and visual hierarchy`,
              },
            ],
          },
        ],
        generationConfig: {
          responseModalities: ["TEXT", "IMAGE"],
          ...(supportsAspectRatio ? { imageConfig: { aspectRatio: "16:9" } } : {}),
        },
      }),
    }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Image generation failed (${response.status}): ${err}`);
  }

  const data = await response.json();
  const parts = data.candidates?.[0]?.content?.parts;
  if (!parts) throw new Error("No parts in response");

  let imageBase64 = "";
  let textResponse = "";

  for (const part of parts) {
    if (part.inline_data) {
      imageBase64 = part.inline_data.data;
    }
    if (part.inlineData) {
      imageBase64 = part.inlineData.data;
    }
    if (part.text) {
      textResponse = part.text;
    }
  }

  if (!imageBase64) {
    console.log("Text response:", textResponse);
    // Dump full response for debugging
    const debugPath = path.join(OUT_DIR, "debug-response.json");
    writeFileSync(debugPath, JSON.stringify(data, null, 2));
    console.log(`Full response dumped to: ${debugPath}`);
    throw new Error("No image in response — model returned text only");
  }

  // Save the image
  const imgPath = path.join(OUT_DIR, "ui-mockup.png");
  writeFileSync(imgPath, Buffer.from(imageBase64, "base64"));
  console.log(`✓ UI mockup saved: ${imgPath}`);
  console.log(`  Image size: ${Math.round(imageBase64.length * 0.75 / 1024)}KB`);
  if (textResponse) console.log(`  Model note: ${textResponse.slice(0, 200)}`);

  return imageBase64;
}

// ─── Stage 2: Extract LayoutSpec from image ─────────────────────────

async function extractLayoutSpec(
  imageBase64: string,
  canvasWidth: number,
  canvasHeight: number
): Promise<unknown> {
  console.log("\n━━━ Stage 2: Extracting LayoutSpec from image ━━━");
  console.log(`Model: gemini-2.5-flash`);
  console.log(`Canvas: ${canvasWidth}x${canvasHeight}`);
  console.log("Waiting...\n");

  const extractionPrompt = `You are a UI reverse-engineer. Analyze this UI design screenshot and extract every visible element into a structured JSON layout.

Output ONLY valid JSON matching this schema:
{
  "id": "layout-extracted",
  "canvasWidth": ${canvasWidth},
  "canvasHeight": ${canvasHeight},
  "background": { "type": "solid"|"gradient", "value": "#hex", "gradient?": { "angle": number, "stops": [{ "color": "#hex", "position": 0-100 }] } },
  "components": [
    {
      "id": "string (kebab-case)",
      "type": "text|shape|icon|image-placeholder|button|card|container|avatar|badge|divider|input-field",
      "position": { "x": number, "y": number },
      "size": { "width": number, "height": number },
      "rotation": 0,
      "zIndex": number,
      "style": {
        "fill?": "#hex or rgba()",
        "stroke?": "#hex or rgba()",
        "strokeWidth?": number,
        "borderRadius?": number,
        "opacity?": 0-1,
        "fontFamily?": "string",
        "fontSize?": 8-200,
        "fontWeight?": 100-900,
        "textAlign?": "left|center|right",
        "color?": "#hex",
        "letterSpacing?": number,
        "gradient?": { "angle": number, "stops": [{ "color": "#hex", "position": 0-100 }] },
        "shadows?": [{ "x": number, "y": number, "blur": number, "color": "rgba()" }],
        "textTransform?": "uppercase|lowercase|capitalize|none"
      },
      "children?": [ ...same shape ],
      "content?": "string"
    }
  ],
  "layers": [{ "id": "main", "name": "Main", "visible": true, "locked": false, "componentIds": ["all-ids"] }]
}

Extraction rules:
- Map the image to a ${canvasWidth}x${canvasHeight} coordinate space
- Extract EVERY visible text element with its exact content, approximate font size, weight, and color
- Extract cards/containers as "card" type with children for their inner elements
- Extract buttons with their label text, background color, and border radius
- Extract images as "image-placeholder" with descriptive content
- Extract navigation bars as "container" with text children
- Extract badges/tags as "badge" type with textTransform "uppercase" if applicable
- Use "shape" for decorative background elements
- Estimate colors by eyedropping from the image (use hex values)
- Estimate font sizes based on visual proportion (titles 36-56px, body 14-16px, labels 11-13px)
- Use multi-layer shadows on cards: [{ x: 0, y: 1, blur: 3, color: "rgba(0,0,0,0.08)" }, { x: 0, y: 4, blur: 16, color: "rgba(0,0,0,0.06)" }]
- Ensure proper z-index ordering (background shapes < cards < text < buttons)
- Keep component count under 50 — group related elements

IMPORTANT: Output ONLY valid JSON. No markdown fences. No explanation.`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`,
    {
      method: "POST",
      headers: {
        "x-goog-api-key": API_KEY!,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                inline_data: {
                  mime_type: "image/png",
                  data: imageBase64,
                },
              },
              { text: extractionPrompt },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.1,
        },
      }),
    }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Extraction failed (${response.status}): ${err}`);
  }

  const data = await response.json();
  const responseParts = data.candidates?.[0]?.content?.parts || [];
  let text = responseParts.find((p: { text?: string }) => p.text)?.text;
  if (!text) throw new Error("No text in extraction response");

  // Strip markdown fences
  text = text.trim();
  if (text.startsWith("```")) {
    text = text.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?\s*```$/, "");
  }

  // Try to parse (with jsonrepair if available)
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    // Try basic repair
    console.log("  JSON parse failed, attempting basic repair...");
    // Remove trailing commas
    const repaired = text.replace(/,\s*([}\]])/g, "$1");
    parsed = JSON.parse(repaired);
  }

  // Save raw JSON
  const jsonPath = path.join(OUT_DIR, "layout-spec.json");
  writeFileSync(jsonPath, JSON.stringify(parsed, null, 2));
  console.log(`✓ LayoutSpec saved: ${jsonPath}`);

  const layout = parsed as { components?: unknown[] };
  console.log(`  Components extracted: ${layout.components?.length ?? 0}`);

  return parsed;
}

// ─── Stage 3: Analysis ──────────────────────────────────────────────

function analyzeLayout(layout: unknown) {
  console.log("\n━━━ Analysis ━━━");
  const l = layout as {
    background?: { type: string; value: string };
    components?: Array<{
      id: string;
      type: string;
      style?: {
        shadows?: unknown[];
        textTransform?: string;
        gradient?: unknown;
        fontSize?: number;
      };
      children?: unknown[];
      content?: string;
    }>;
  };

  if (l.background) {
    console.log(`Background: ${l.background.type} — ${l.background.value}`);
  }

  if (!l.components) {
    console.log("No components found!");
    return;
  }

  const types: Record<string, number> = {};
  let hasShadows = 0;
  let hasTextTransform = 0;
  let hasGradient = 0;
  let totalChildren = 0;

  for (const c of l.components) {
    types[c.type] = (types[c.type] || 0) + 1;
    if (c.style?.shadows?.length) hasShadows++;
    if (c.style?.textTransform) hasTextTransform++;
    if (c.style?.gradient) hasGradient++;
    if (c.children) totalChildren += c.children.length;
  }

  console.log(`\nComponent breakdown (${l.components.length} total):`);
  for (const [type, count] of Object.entries(types).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${type}: ${count}`);
  }
  console.log(`  (+ ${totalChildren} children inside cards/containers)`);

  console.log(`\nStyle features used:`);
  console.log(`  Multi-shadow (shadows[]): ${hasShadows} components`);
  console.log(`  textTransform: ${hasTextTransform} components`);
  console.log(`  Gradients: ${hasGradient} components`);

  // Show some text content
  const texts = l.components
    .filter((c) => c.content)
    .slice(0, 8);
  if (texts.length > 0) {
    console.log(`\nSample extracted text:`);
    for (const t of texts) {
      const fontSize = t.style?.fontSize ? ` (${t.style.fontSize}px)` : "";
      console.log(`  [${t.type}] "${t.content?.slice(0, 60)}"${fontSize}`);
    }
  }
}

// ─── Main ───────────────────────────────────────────────────────────

async function main() {
  const prompt = "SaaS pricing page with 3 plan cards — Starter, Professional (highlighted), Enterprise. Corporate blue theme, white background, modern clean design";
  const models = [
    "gemini-2.5-flash-image",
    "gemini-3-pro-image-preview",
  ];

  for (const model of models) {
    console.log("╔══════════════════════════════════════════════════╗");
    console.log(`║  POC: ${model.padEnd(42)}║`);
    console.log("╚══════════════════════════════════════════════════╝");

    // Override the model via env
    process.env.IMAGE_MODEL = model;

    const suffix = model.includes("3-pro") ? "3pro" : "25flash";

    try {
      const t0 = Date.now();

      // Stage 1: Generate image
      const imageBase64 = await generateUIImage(prompt);
      const t1 = Date.now();
      console.log(`  ⏱ Image generation: ${((t1 - t0) / 1000).toFixed(1)}s`);

      // Save with model-specific name
      const imgPath = path.join(OUT_DIR, `ui-mockup-${suffix}.png`);
      writeFileSync(imgPath, Buffer.from(imageBase64, "base64"));
      console.log(`  Saved: ${imgPath}`);

      // Stage 2: Extract LayoutSpec
      const layout = await extractLayoutSpec(imageBase64, 1440, 900);
      const t2 = Date.now();
      console.log(`  ⏱ Layout extraction: ${((t2 - t1) / 1000).toFixed(1)}s`);

      // Save with model-specific name
      const jsonPath = path.join(OUT_DIR, `layout-spec-${suffix}.json`);
      writeFileSync(jsonPath, JSON.stringify(layout, null, 2));

      // Stage 3: Analyze
      analyzeLayout(layout);

      console.log(`\n  ⏱ Total pipeline: ${((t2 - t0) / 1000).toFixed(1)}s`);
    } catch (err) {
      console.error(`\n✗ ${model} failed:`, err instanceof Error ? err.message : err);
    }

    console.log("\n");
  }

  console.log(`✓ All done! Check ${OUT_DIR} for outputs.`);
}

main();
