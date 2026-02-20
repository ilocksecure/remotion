import { writeFileSync } from "fs";
import path from "path";

async function main() {
  const API_KEY = process.env.GEMINI_API_KEY;
  const model = "gemini-3-pro-image-preview";
  const OUT = path.join(process.cwd(), "scripts", "poc-output");

  const prompt = `Generate a flat UI design screenshot for: SaaS pricing page with 3 plan cards — Starter, Professional (highlighted), Enterprise. Corporate blue theme, white background, modern clean design

Requirements:
- Flat screenshot of the UI only — NO device mockup, NO browser frame, NO monitor, NO background
- Just the web page itself filling the entire image edge to edge
- Realistic readable text content (not placeholder)
- Modern clean styling with proper shadows, spacing, and visual hierarchy`;

  for (let attempt = 1; attempt <= 5; attempt++) {
    console.log(`Attempt ${attempt}/5 — ${model}...`);

    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: { "x-goog-api-key": API_KEY!, "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseModalities: ["TEXT", "IMAGE"],
            imageConfig: { aspectRatio: "16:9" },
          },
        }),
      }
    );

    if (r.status === 503) {
      const wait = attempt * 15;
      console.log(`  503 — high demand. Waiting ${wait}s...`);
      await new Promise((resolve) => setTimeout(resolve, wait * 1000));
      continue;
    }

    if (!r.ok) {
      console.log("Error:", r.status, await r.text());
      process.exit(1);
    }

    const data = await r.json();
    const parts = data.candidates?.[0]?.content?.parts || [];
    for (const p of parts) {
      const img = p.inline_data?.data || p.inlineData?.data;
      if (img) {
        const out = path.join(OUT, "ui-mockup-3pro.png");
        writeFileSync(out, Buffer.from(img, "base64"));
        console.log("Saved:", out, Math.round((img.length * 0.75) / 1024) + "KB");
        return;
      }
      if (p.text) console.log("Note:", p.text.slice(0, 300));
    }
    console.log("No image in response, retrying...");
  }
  console.log("All attempts failed.");
}
main();
