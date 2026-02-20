# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start dev server (uses --webpack flag)
npm run build        # Production build
npm run lint         # ESLint (flat config, Next.js core-web-vitals + TypeScript)
npx tsc --noEmit     # Type-check without emitting
```

No test framework is configured yet.

## Architecture

This is an AI-powered Design Studio that generates structured UI layouts from natural language prompts, renders them as interactive SVG on a Fabric.js canvas, and exports to PNG/JPG/PDF.

### Data Flow

```
User prompt → /api/clarify (Gemini 2.5 Flash — optional clarifying questions)
           → enriched prompt + reference images
           → /api/generate-layout (Gemini 2.5 Flash, multimodal when images attached)
           → LLM returns JSON matching LayoutSpec schema
           → processLayout() clamps, grid-snaps, resolves collisions
           → componentToSVG() renders each component as SVG
           → Fabric.js v6 canvas displays interactive objects
           → Export to PNG/JPG/PDF
```

### Key Files

**Schemas & Types (source of truth for all data shapes):**
- `app/lib/schemas.ts` — Zod schemas: `DesignBriefSchema`, `ComponentStyleSchema`, `ComponentSpecSchema` (recursive via `z.lazy`), `LayoutSpecSchema`, `EditInstructionSchema`
- `app/lib/types.ts` — `z.infer<>` type aliases re-exported from schemas

**Pipeline (Steps 2→3→4):**
- `app/lib/prompt-builder.ts` — `buildDesignPrompt()` constructs the LLM system prompt with style-specific instructions for 5 presets (minimal, corporate, playful, luxury, tech)
- `app/api/clarify/route.ts` — POST handler: generates 2-3 clarifying questions via Gemini before layout generation
- `app/api/generate-layout/route.ts` — POST handler: validates brief, calls Gemini (multimodal when images attached), repairs JSON via `jsonrepair`, validates with Zod
- `app/lib/layout-engine.ts` — `processLayout()`: boundary clamping, 4px grid snap (positions only), threshold-based collision resolution (25% overlap), z-index sort
- `app/lib/svg-mapper.ts` — `componentToSVG()`: renders 11 component types to SVG strings with gradient/shadow support
- `app/api/edit-layout/route.ts` — POST handler: diff-based layout editing via Gemini, repairs shadows/textTransform in response
- `app/lib/apply-edits.ts` — Utility for applying component-level edits from LLM edit responses

**Editor UI:**
- `app/editor/page.tsx` — Main editor page, manages all state (layout, palette, style, dimensions)
- `app/components/CanvasEditor.tsx` — Fabric.js v6 canvas wrapper with zoom/pan, lazy-loads fabric
- `app/components/ChatPanel.tsx` — Left sidebar: auto-growing textarea, image upload, clarifying questions flow, message history + ColorPalettePicker
- `app/components/LayerPanel.tsx` — Right sidebar: z-index ordered component list
- `app/components/ToolBar.tsx` — Top bar: style/dimension selectors, export trigger
- `app/components/ExportDialog.tsx` — Export modal (format + scale selection)

**Remotion (configured but not yet integrated into editor UI):**
- `remotion.config.ts` — Minimal config (overwrite output, jpeg format)
- Remotion dependencies installed: `remotion`, `@remotion/cli`, `@remotion/transitions`, `@remotion/google-fonts`
- No `src/` Remotion compositions exist yet

### Component Type System

The `ComponentSpecSchema` supports 11 types: `text`, `shape`, `icon`, `image-placeholder`, `button`, `card`, `container`, `avatar`, `badge`, `divider`, `input-field`. The schema is recursive — `card` and `container` can have `children` arrays of the same shape.

### Style Properties

`ComponentStyleSchema` supports: `fill`, `stroke`, `strokeWidth`, `borderRadius`, `opacity`, `fontFamily`, `fontSize`, `fontWeight`, `textAlign`, `color`, `letterSpacing`, `lineHeight`, `gradient` (angle + color stops), `shadow` (single x/y/blur/color), `shadows` (array of x/y/blur/color for layered depth), `textTransform` (uppercase/lowercase/capitalize/none). The SVG mapper converts `gradient` to `<linearGradient>` defs, `shadow`/`shadows` to `<filter>` elements with stacked `<feDropShadow>`, and applies `textTransform` to text content.

## Important Patterns

- **LLM returns structured JSON, not raw SVG.** The Zod schema constrains the LLM output. The SVG mapper deterministically converts JSON → SVG. Never have the LLM generate SVG directly.
- **All validation happens through Zod schemas.** `schemas.ts` is the single source of truth. Types in `types.ts` are derived via `z.infer<>`.
- **The API route uses `jsonrepair`** to fix malformed LLM JSON (trailing commas, unescaped characters, comments) before parsing. Markdown fences are stripped first via `extractJson()`.
- **Fabric.js v6** uses async patterns: `dispose()` returns a Promise, `loadSVGFromString()` returns a Promise. The canvas lazy-loads the fabric module.
- **`processLayout()`** always runs after LLM generation — it clamps to canvas bounds, snaps positions to 4px grid (preserving sizes), resolves collisions only when overlap exceeds 25% of the smaller component, and sorts by z-index.
- **Two-stage generation pipeline:** `/api/generate-layout` runs two LLM calls: (1) `buildDesignSpecPrompt()` generates a detailed design spec (text-only), (2) `buildLayoutJsonPrompt()` converts that spec to LayoutSpec JSON. This gives the LLM enough context to produce high-quality layouts.
- **Multimodal Gemini support:** When reference images are uploaded, `/api/generate-layout` switches from `prompt` to `messages` with `type: "image"` parts. Text-only is used when no images are present for efficiency.

## Tech Stack

- Next.js 16 (App Router) + React 19 + TypeScript 5
- Tailwind CSS 4 (via @tailwindcss/postcss)
- Fabric.js v6 (canvas editor)
- Zod 4 (schema validation)
- Vercel AI SDK (`ai` + `@ai-sdk/google`) with Gemini 2.5 Flash
- jsonrepair (robust LLM JSON parsing)
- jsPDF (PDF export)
- react-colorful (color picker)
- Remotion 4 (video pipeline, not yet wired to editor)

## Documentation

- `docs/ai-design-to-animation-pipeline.md` — Full 7-step pipeline architecture (design doc)
- `docs/design-quality-improvements.md` — SVG rendering + prompt quality overhaul
- `docs/remotion-learnings.md` — Remotion API patterns (spring, interpolate, TransitionSeries)
- `docs/gemini-api-reference.md` — Gemini API endpoints for image gen and TTS
- `docs/enhanced-chat-panel-implementation.md` — ChatPanel UX upgrade: textarea, image upload, AI clarifying questions
- `docs/image-to-ui-react-approaches.md` — Image-to-UI approaches research + image-first pipeline POC results
