# Option B: Image-First Pipeline — Implementation Task List

> Integrate the proven image-first pipeline POC into the editor UI as a second generation mode.
> Plan date: 2026-02-19 | Status: **Planned, not started**

---

## Context

The POC (`scripts/image-pipeline-poc.ts`) proved that text → Gemini image gen → LayoutSpec extraction works well. `gemini-2.5-flash-image` produces clean flat UI with readable text (~8s gen + ~49s extraction = ~57s total). Now we need to productionize this as "Option B" in the editor alongside the existing "Option A" (text → LayoutSpec direct).

**User decisions:**
- **Full auto pipeline**: user types text prompt → we generate image → extract LayoutSpec (no manual image upload)
- **ToolBar dropdown**: Mode selector next to Style ("Text-first" / "Image-first")
- **Options stay separate**: distinct API route, no merging with Option A

**Architecture:**
```
Option A (existing):  Prompt → buildDesignSpecPrompt → Gemini → designSpec → buildLayoutJsonPrompt → Gemini → LayoutSpec
Option B (new):       Prompt → Gemini Image Gen → UI mockup PNG → Gemini Vision → LayoutSpec
                      Both → processLayout() → componentToSVG() → Fabric.js Canvas
```

---

## Tasks

### Task 1: Create shared repair utility
**File:** `app/lib/repair-components.ts` (new)
**Blocked by:** nothing
**Status:** pending

Extract the component repair logic from `app/api/generate-layout/route.ts` (lines 66-116) into a shared utility:

```ts
export function repairComponents(parsed: { components?: any[] }): void
```

Handles:
- zIndex clamping (`< 0` → `0`)
- fontWeight string → number coercion
- Invalid shadow/shadows filtering (strings, malformed objects)
- Missing `style` objects → `{}`
- Recursive children repair (same fixes on `comp.children[]`)

Then update `generate-layout/route.ts` to import and call `repairComponents(parsed)` instead of inline code.

---

### Task 2: Add GenerationMode type
**File:** `app/lib/types.ts` (modify)
**Blocked by:** nothing
**Status:** pending

Add:
```ts
export type GenerationMode = "text-first" | "image-first";
```

UI-only state — not part of DesignBrief schema, not sent to LLM.

---

### Task 3: Create image-first API route
**File:** `app/api/generate-layout-image/route.ts` (new)
**Blocked by:** Task 1, Task 2
**Status:** pending

Dedicated POST route for Option B. Accepts same `DesignBrief` body, returns same `LayoutSpec`.

#### Stage 1 — Image Generation (raw fetch)
- Endpoint: `https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent`
- Model: `process.env.IMAGE_GEN_MODEL || "gemini-2.5-flash-image"`
- Body:
  ```json
  {
    "contents": [{ "parts": [{ "text": "<prompt incorporating description, style, palette>" }] }],
    "generationConfig": {
      "responseModalities": ["TEXT", "IMAGE"],
      "imageConfig": { "aspectRatio": "<mapped from dimensions>" }
    }
  }
  ```
- Handle both `inlineData` and `inline_data` response fields
- 503 retry: 3 attempts with 10s backoff
- API key: `GEMINI_API_KEY || GOOGLE_GENERATIVE_AI_API_KEY`

#### Stage 2 — LayoutSpec Extraction (Vercel AI SDK)
- `generateText()` with `google("gemini-2.5-flash")`
- Messages: image part (base64 PNG) + extraction prompt
- Extraction prompt adapted from `scripts/image-pipeline-poc.ts` `extractLayoutSpec()`, parameterized with:
  - `canvasWidth`, `canvasHeight` from brief dimensions
  - `palette` colors for the model to reference
  - `style` preset name
  - Full LayoutSpec schema (11 component types, shadows array, textTransform)

#### Post-processing
- `extractJson()` — strip markdown fences
- `jsonrepair()` — fix malformed JSON
- `repairComponents()` — shared utility from Task 1
- `LayoutSpecSchema.parse()` — Zod validation
- Return `NextResponse.json(layout)`

#### Aspect ratio mapping
| Dimensions | Ratio | Gemini Value |
|-----------|-------|-------------|
| Web (1440x900), Presentation (1920x1080) | ~16:9 | `"16:9"` |
| Mobile (375x812) | ~9:16 | `"9:16"` |
| Tablet (768x1024) | ~3:4 | `"3:4"` |

---

### Task 4: Add Mode dropdown to ToolBar
**File:** `app/components/ToolBar.tsx` (modify)
**Blocked by:** Task 2
**Status:** pending

New props:
```ts
generationMode: GenerationMode;
onGenerationModeChange: (m: GenerationMode) => void;
```

Add `<select>` dropdown between "Design Studio" and Style selector:
```
[Design Studio]  |  Mode: [Text-first ▾]  |  Style: [Corporate ▾]  |  Size: [Web ▾]
```

Options: "Text-first", "Image-first". Same styling as existing dropdowns (`bg-zinc-700 text-white px-2 py-1 rounded text-xs border border-zinc-600`).

---

### Task 5: Wire generation mode into EditorPage
**File:** `app/editor/page.tsx` (modify)
**Blocked by:** Task 3, Task 4
**Status:** pending

1. New state:
   ```ts
   const [generationMode, setGenerationMode] = useState<GenerationMode>("text-first");
   ```

2. Modify `handleGenerate()` — route to correct endpoint:
   ```ts
   const endpoint = generationMode === "image-first"
     ? "/api/generate-layout-image"
     : "/api/generate-layout";
   ```
   Rest of the function stays identical (same brief, same processLayout, same error handling).

3. Pass to ToolBar:
   ```ts
   <ToolBar generationMode={generationMode} onGenerationModeChange={setGenerationMode} ... />
   ```

4. Pass to ChatPanel:
   ```ts
   <ChatPanel generationMode={generationMode} ... />
   ```

---

### Task 6: Update ChatPanel for image-first mode
**File:** `app/components/ChatPanel.tsx` (modify)
**Blocked by:** Task 2
**Status:** pending

1. New prop:
   ```ts
   generationMode?: GenerationMode;
   ```

2. Update loading indicator (currently line 321-324):
   ```tsx
   {loading && (
     <div className="text-xs text-zinc-500 animate-pulse">
       {generationMode === "image-first"
         ? "Generating UI mockup & extracting layout..."
         : "Generating layout..."}
     </div>
   )}
   ```

3. Skip clarification for image-first mode — in `handleSubmit()`, when `generationMode === "image-first"`, bypass `onClarify()` and go straight to `triggerGenerate(prompt)`. Image pipeline doesn't benefit from clarifying questions.

---

### Task 7: Test and verify end-to-end
**Blocked by:** Task 5, Task 6
**Status:** pending

Verification checklist:
- [ ] `npx tsc --noEmit` — no type errors
- [ ] `npm run dev` → Image-first mode → "SaaS pricing page with 3 plan cards" (corporate) → layout appears on canvas (~57s)
- [ ] Loading message shows "Generating UI mockup & extracting layout..."
- [ ] Switch to Text-first → same prompt → Option A still works unchanged
- [ ] Image-first + luxury style → dark theme elements extracted
- [ ] Edit mode after image-first generation → "make heading larger" → edit pipeline works
- [ ] Error handling → network error → error displays properly
- [ ] Image-first skips clarifying questions flow

---

## Dependency Graph

```
Task 1 (repair utility)   ──┐
                             ├──→ Task 3 (API route) ──┐
Task 2 (GenerationMode)   ──┤                          ├──→ Task 5 (EditorPage) ──┐
                             ├──→ Task 4 (ToolBar)   ──┘                          ├──→ Task 7 (Test)
                             └──→ Task 6 (ChatPanel) ─────────────────────────────┘
```

**Parallel work possible:**
- Tasks 1 + 2 (no dependencies, do first)
- Tasks 3 + 4 + 6 (all depend only on 1/2, can be done in parallel)
- Task 5 (depends on 3 + 4, do after)
- Task 7 (final, depends on everything)

---

## Files Summary

| File | Action | Task |
|------|--------|------|
| `app/lib/repair-components.ts` | **Create** | 1 |
| `app/api/generate-layout/route.ts` | **Modify** — use shared repair | 1 |
| `app/lib/types.ts` | **Modify** — add GenerationMode | 2 |
| `app/api/generate-layout-image/route.ts` | **Create** | 3 |
| `app/components/ToolBar.tsx` | **Modify** — add Mode dropdown | 4 |
| `app/editor/page.tsx` | **Modify** — mode state + routing | 5 |
| `app/components/ChatPanel.tsx` | **Modify** — mode prop + loading text + skip clarify | 6 |

---

## Gemini API Notes (from POC learnings)

- Response field inconsistency: always check BOTH `p.inline_data?.data` and `p.inlineData?.data`
- `gemini-2.5-flash-image` supports `aspectRatio`, produces clean flat UI (~8s)
- `gemini-3-pro-image-preview` has reasoning (better quality expected) but returns 503 frequently — support via `IMAGE_GEN_MODEL` env var for easy switching
- Prompt MUST say "NO device mockup, NO browser frame, NO monitor, NO background" or models render UI inside device illustrations
- Image gen models return 503 during high demand — implement retry with backoff

## Related Documentation

- POC script: `scripts/image-pipeline-poc.ts`
- Research doc: [`docs/image-to-ui-react-approaches.md`](./image-to-ui-react-approaches.md)
- Design quality (Option A): [`docs/design-quality-improvements.md`](./design-quality-improvements.md)
- Pipeline architecture: [`docs/ai-design-to-animation-pipeline.md`](./ai-design-to-animation-pipeline.md)
