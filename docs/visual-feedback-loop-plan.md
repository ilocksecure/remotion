# Visual Feedback Loop — Iterative Refinement via Canvas Screenshot Comparison

## Context

The design studio generates layouts via Gemini in two modes. **Option B (image-first)** generates a UI mockup image, then extracts LayoutSpec JSON from it. The problem: the SVG renderer can't perfectly reproduce every detail from the Gemini-generated image — there's a visual quality gap between intent and render. Currently there's no way to compare or iterate.

**Goal:** After generation, capture a canvas screenshot, optionally compare it against the original Gemini-generated reference image, and send both back to Gemini for an improved LayoutSpec. This creates an iterative refinement loop that progressively closes the quality gap.

---

## Architecture Overview

```
[Initial Generation]
  Option A: text prompt → /api/generate-layout → LayoutSpec → canvas render
  Option B: text prompt → /api/generate-layout-image → (referenceImage + LayoutSpec) → canvas render

[Visual Feedback Loop]
  1. Canvas screenshot (via Fabric.js toDataURL) → base64 PNG
  2. Optional: referenceImage from Option B (persisted in client state)
  3. Both images + currentLayout JSON + refinement context
     → /api/refine-layout (NEW)
     → Gemini 2.5 Flash (multimodal: 1-2 images + text)
     → improved LayoutSpec JSON
     → processLayout() → canvas re-render
  4. Repeat steps 1-3 as needed
```

---

## Step 1: Return Reference Image from Option B

**File:** `app/api/generate-layout-image/route.ts`

Currently the route discards the Stage 1 generated image after extraction. Change the response from bare `LayoutSpec` to `{ layout, referenceImage }` so the client can store and reuse it.

```ts
// Before: return NextResponse.json(layout);
// After:
return NextResponse.json({ layout, referenceImage: imageBase64 });
```

The `imageBase64` variable already exists in scope from Stage 1 — no new API call needed.

---

## Step 2: Add `captureCanvasScreenshot()` Utility

**File:** `app/lib/export-utils.ts`

Add alongside existing `exportDesign()`:

```ts
export function captureCanvasScreenshot(canvas: Canvas, scale: number = 1): string {
  const dataUrl = canvas.toDataURL({ format: "png", quality: 1, multiplier: scale });
  return dataUrl.split(",")[1]; // Strip data URI prefix, return raw base64
}
```

Scale 1x (not 2x) — sufficient for Gemini vision analysis, keeps payload smaller.

---

## Step 3: Add `buildRefinePrompt()` to Prompt Builder

**File:** `app/lib/prompt-builder.ts`

New function that constructs the refinement prompt. Two modes:

- **With reference image** (Option B): "Image 1 is the intended design. Image 2 is the current rendering. Compare and fix discrepancies."
- **Without reference image** (Option A): "Image 1 is the current rendering. Analyze and improve quality."

The prompt includes:
- Current LayoutSpec JSON (serialized) so Gemini can see both visual and structural representation
- Style/palette/dimensions context
- Specific checklist: spacing, shadows, typography hierarchy, alignment, colors, completeness, proportions
- Iteration number for context
- Full LayoutSpec JSON schema (reuse the schema snippet from `buildLayoutJsonPrompt()` — extract into shared helper `buildLayoutJsonSchemaSnippet()`)

Output: complete improved LayoutSpec JSON.

---

## Step 4: Create `/api/refine-layout/route.ts`

**New file:** `app/api/refine-layout/route.ts`

Request body:
```ts
{
  currentLayout: LayoutSpec,
  canvasScreenshot: string,       // base64 PNG of current render
  referenceImage?: string,        // base64 PNG from Option B (optional)
  style: string,
  palette: Palette,
  dimensions: { width, height },
  iterationNumber: number         // 1, 2, 3...
}
```

Pipeline (same pattern as all other routes):
1. Validate request with Zod
2. Build multimodal message: `[referenceImage?, canvasScreenshot, text prompt]`
3. Call `generateText()` with `google("gemini-2.5-flash")`
4. `extractJson()` → `jsonrepair()` → `repairComponents()` → `LayoutSpecSchema.parse()`
5. Return `NextResponse.json(layout)`

**Note:** Extract `extractJson()` into `app/lib/json-utils.ts` to avoid a 4th copy across routes. Update existing routes to import from there.

---

## Step 5: Update Editor Page

**File:** `app/editor/page.tsx`

### New state:
```ts
const [referenceImage, setReferenceImage] = useState<string | null>(null);
const [refineCount, setRefineCount] = useState(0);
```

### Update `handleGenerate()`:
- Image-first mode: parse `{ layout, referenceImage }` response, store both
- Text-first mode: set `referenceImage` to `null`
- Reset `refineCount` to 0 on new generation

### New `handleRefine()`:
1. Capture canvas screenshot via `captureCanvasScreenshot(fabricCanvasRef.current)`
2. POST to `/api/refine-layout` with screenshot + referenceImage + currentLayout + context
3. Apply `processLayout()` on result
4. Increment `refineCount`
5. Return reasoning string for chat display

### Pass new props:
- `ToolBar`: `onRefine`, `referenceImage`, `refineCount`, `loading`
- `ChatPanel`: `onRefine`

---

## Step 6: Add "Refine" Button to ToolBar

**File:** `app/components/ToolBar.tsx`

New props: `onRefine`, `referenceImage`, `refineCount`, `loading`

Add a "Refine" button (purple, with sparkle icon) visible when layout exists. Shows iteration badge (`#1`, `#2`...) after first refinement.

Optionally show a small reference image thumbnail when `referenceImage` is present — lets the user see what Gemini generated as the design target.

---

## Step 7: Add Refine Suggestion to ChatPanel

**File:** `app/components/ChatPanel.tsx`

New prop: `onRefine?: () => Promise<string>`

After generation completes (layout exists, not loading), show a subtle suggestion:
> "Layout generated. [Refine rendering quality]"

The "[Refine rendering quality]" is a clickable link that triggers `onRefine()`. Result message is added to chat history.

Update loading message for refine: "Refining layout quality..." when refinement is in progress.

---

## Files Summary

| File | Action |
|------|--------|
| `app/api/refine-layout/route.ts` | **Create** — visual refinement API route |
| `app/lib/json-utils.ts` | **Create** — extract shared `extractJson()` |
| `app/lib/prompt-builder.ts` | **Modify** — add `buildRefinePrompt()`, extract schema snippet helper |
| `app/lib/export-utils.ts` | **Modify** — add `captureCanvasScreenshot()` |
| `app/api/generate-layout-image/route.ts` | **Modify** — return `{ layout, referenceImage }` |
| `app/editor/page.tsx` | **Modify** — add referenceImage/refineCount state, `handleRefine()`, update `handleGenerate()` |
| `app/components/ToolBar.tsx` | **Modify** — add Refine button + reference thumbnail |
| `app/components/ChatPanel.tsx` | **Modify** — add refine suggestion + `onRefine` prop |
| `app/api/generate-layout/route.ts` | **Modify** — use shared `extractJson()` from json-utils |
| `app/api/edit-layout/route.ts` | **Modify** — use shared `extractJson()` from json-utils |

---

## Implementation Sequence

### Phase 1 — Backend foundation (no UI changes)
1. Create `app/lib/json-utils.ts` — extract shared `extractJson()`
2. Add `captureCanvasScreenshot()` to `export-utils.ts`
3. Add `buildRefinePrompt()` to `prompt-builder.ts`
4. Create `/api/refine-layout/route.ts`
5. Update existing routes to use shared `extractJson()`

### Phase 2 — Image pipeline change
6. Modify `generate-layout-image/route.ts` to return `{ layout, referenceImage }`
7. Update `handleGenerate()` in `editor/page.tsx` to handle new response format

### Phase 3 — UI integration
8. Add state (`referenceImage`, `refineCount`) to `editor/page.tsx`
9. Add `handleRefine()` to `editor/page.tsx`
10. Add Refine button to `ToolBar.tsx`
11. Add refine suggestion to `ChatPanel.tsx`

---

## Verification

1. `npx tsc --noEmit` — no type errors
2. **Image-first + refine:** Select Image-first mode → generate "SaaS pricing page" → observe layout → click "Refine" → layout should improve (better spacing, shadows, alignment)
3. **Text-first + refine:** Select Text-first mode → generate → click "Refine" → should work (no reference image, single-image analysis)
4. **Multiple iterations:** Click Refine 2-3 times → badge shows #1, #2, #3 → each iteration should incrementally improve
5. **Reference image visible:** After Image-first generation, reference thumbnail appears in toolbar
6. **ChatPanel suggestion:** After generation, "Refine rendering quality" link appears in chat
7. **Existing flows unchanged:** Edit mode still works, text-first generation unchanged, export still works

---

## Technical Notes

### Payload Size
A 1440x900 PNG at 1x scale is ~500KB-1MB base64. With two images, request body ~2MB. Gemini supports up to 20MB inline. May need Next.js body size config adjustment.

### Latency
Gemini 2.5 Flash with 2 images + long prompt: ~30-60s. UI already handles this with loading indicator.

### Diminishing Returns
After 2-3 iterations, improvements become marginal. Consider soft warning after 3 iterations suggesting text-based edits for specific adjustments.

### Gemini API Pattern (already working)
```ts
messages: [{
  role: "user",
  content: [
    ...images.map(img => ({ type: "image", image: img.base64 })),
    { type: "text", text: prompt },
  ],
}]
```
