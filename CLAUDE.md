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

This is an AI-powered Design Studio that generates structured UI layouts from natural language prompts, renders them as React/CSS components in a browser-native preview, and exports to PNG/JPG/PDF. All editing is done via chat (v0-style approach).

### Data Flow

```
User prompt → /api/clarify (Gemini 2.5 Flash — optional clarifying questions)
           → enriched prompt + reference images
           → /api/generate-layout (Gemini 2.5 Flash, multimodal when images attached)
             OR /api/generate-layout-image (image-first pipeline)
           → LLM returns JSON matching LayoutSpec schema
           → processLayout() clamps, grid-snaps, resolves collisions
           → componentToReact() renders each component as React elements with native CSS
           → LayoutPreview displays in browser with zoom/pan controls
           → Chat edit → /api/edit-layout → diff operations → re-render
           → Export via html-to-image (PNG/JPG) or jsPDF (PDF)
```

### Key Files

**Schemas & Types (source of truth for all data shapes):**
- `app/lib/schemas.ts` — Zod schemas: `DesignBriefSchema`, `ComponentStyleSchema`, `ComponentSpecSchema` (recursive via `z.lazy`), `LayoutSpecSchema`, `EditInstructionSchema`
- `app/lib/types.ts` — `z.infer<>` type aliases re-exported from schemas

**Pipeline (Steps 2→3→4):**
- `app/lib/prompt-builder.ts` — `buildDesignPrompt()` constructs the LLM system prompt with style-specific instructions for 5 presets (minimal, corporate, playful, luxury, tech)
- `app/api/clarify/route.ts` — POST handler: generates 2-3 clarifying questions via Gemini before layout generation
- `app/api/generate-layout/route.ts` — POST handler: validates brief, calls Gemini (multimodal when images attached), repairs JSON via `jsonrepair`, validates with Zod
- `app/api/generate-layout-image/route.ts` — POST handler: image-first pipeline (generates mockup image via Gemini, then extracts LayoutSpec)
- `app/lib/layout-engine.ts` — `processLayout()`: boundary clamping, 4px grid snap (positions only), threshold-based collision resolution (25% overlap), z-index sort
- `app/lib/react-renderer.tsx` — `componentToReact()`: renders all 11 component types as React elements with native CSS (box-shadow, gradients, text-transform, etc.); `LayoutRenderer` component for full layout rendering
- `app/api/edit-layout/route.ts` — POST handler: diff-based layout editing via Gemini, repairs shadows/textTransform in response
- `app/lib/apply-edits.ts` — Utility for applying component-level edits from LLM edit responses

**Legacy (kept for reference, no longer used in editor):**
- `app/lib/svg-mapper.ts` — `componentToSVG()`: old SVG renderer, replaced by `componentToReact()`
- `app/components/CanvasEditor.tsx` — Old Fabric.js v6 canvas wrapper, replaced by `LayoutPreview`
- `app/components/LayerPanel.tsx` — Old z-index layer list, removed from editor (components visible in preview)

**Editor UI:**
- `app/editor/page.tsx` — Main editor page, manages all state (layout, palette, style, dimensions). Two-column layout: ChatPanel left, LayoutPreview right
- `app/components/LayoutPreview.tsx` — React-rendered preview with zoom/pan controls. Exposes ref for html-to-image export
- `app/components/ChatPanel.tsx` — Left sidebar: auto-growing textarea, image upload, clarifying questions flow, message history + ColorPalettePicker
- `app/components/ToolBar.tsx` — Top bar: mode/style/dimension selectors, export trigger
- `app/components/ExportDialog.tsx` — Export modal (format + scale), uses html-to-image for capture
- `app/lib/export-utils.ts` — `exportDesign()` using html-to-image (toPng/toJpeg) + jsPDF for PDF

**Remotion (configured, ready for Phase 3 integration):**
- `remotion.config.ts` — Minimal config (overwrite output, jpeg format)
- Remotion dependencies installed: `remotion`, `@remotion/cli`, `@remotion/transitions`, `@remotion/google-fonts`
- `LayoutRenderer` from `react-renderer.tsx` is directly usable as a Remotion composition — no translation layer needed

### Component Type System

The `ComponentSpecSchema` supports 11 types: `text`, `shape`, `icon`, `image-placeholder`, `button`, `card`, `container`, `avatar`, `badge`, `divider`, `input-field`. The schema is recursive — `card` and `container` can have `children` arrays of the same shape.

### Style Properties

`ComponentStyleSchema` supports: `fill`, `stroke`, `strokeWidth`, `borderRadius`, `opacity`, `fontFamily`, `fontSize`, `fontWeight`, `textAlign`, `color`, `letterSpacing`, `lineHeight`, `gradient` (angle + color stops), `shadow` (single x/y/blur/color), `shadows` (array of x/y/blur/color for layered depth), `textTransform` (uppercase/lowercase/capitalize/none). The React renderer maps these to native CSS properties: `gradient` → `linear-gradient()`, `shadows` → `box-shadow`, `textTransform` → CSS `text-transform` or string manipulation.

## Important Patterns

- **LLM returns structured JSON, not code.** The Zod schema constrains the LLM output. `componentToReact()` deterministically converts JSON → React elements. Never have the LLM generate JSX directly.
- **All validation happens through Zod schemas.** `schemas.ts` is the single source of truth. Types in `types.ts` are derived via `z.infer<>`.
- **The API route uses `jsonrepair`** to fix malformed LLM JSON (trailing commas, unescaped characters, comments) before parsing. Markdown fences are stripped first via `extractJson()`.
- **Chat-only editing:** All modifications via chat using `/api/edit-layout` diff-based system. No canvas drag-and-drop.
- **`processLayout()`** always runs after LLM generation — it clamps to canvas bounds, snaps positions to 4px grid (preserving sizes), resolves collisions only when overlap exceeds 25% of the smaller component, and sorts by z-index.
- **Two-stage generation pipeline:** `/api/generate-layout` runs two LLM calls: (1) `buildDesignSpecPrompt()` generates a detailed design spec (text-only), (2) `buildLayoutJsonPrompt()` converts that spec to LayoutSpec JSON. This gives the LLM enough context to produce high-quality layouts.
- **Multimodal Gemini support:** When reference images are uploaded, `/api/generate-layout` switches from `prompt` to `messages` with `type: "image"` parts. Text-only is used when no images are present for efficiency.
- **Export via html-to-image:** `LayoutPreview` exposes a ref to the rendered DOM element. `ExportDialog` captures it at configurable scale (1x/2x/3x) as PNG/JPG, or rasterizes to PNG then embeds in jsPDF for PDF export.

## Tech Stack

- Next.js 16 (App Router) + React 19 + TypeScript 5
- Tailwind CSS 4 (via @tailwindcss/postcss)
- html-to-image (DOM-to-image export)
- Zod 4 (schema validation)
- Vercel AI SDK (`ai` + `@ai-sdk/google`) with Gemini 2.5 Flash
- jsonrepair (robust LLM JSON parsing)
- jsPDF (PDF export)
- react-colorful (color picker)
- Remotion 4 (video pipeline, LayoutRenderer ready for integration)
- Fabric.js v6 (legacy, no longer used in editor)

## Documentation

- `docs/ai-design-to-animation-pipeline.md` — Full 7-step pipeline architecture (design doc)
- `docs/design-quality-improvements.md` — SVG rendering + prompt quality overhaul
- `docs/remotion-learnings.md` — Remotion API patterns (spring, interpolate, TransitionSeries)
- `docs/gemini-api-reference.md` — Gemini API endpoints for image gen and TTS
- `docs/enhanced-chat-panel-implementation.md` — ChatPanel UX upgrade: textarea, image upload, AI clarifying questions
- `docs/image-to-ui-react-approaches.md` — Image-to-UI approaches research + image-first pipeline POC results
- `docs/option-c-react-renderer-architecture.md` — Architecture decision: React/CSS renderer replacing SVG/Fabric.js, chat-only editing, Remotion integration path
- `docs/visual-feedback-loop-plan.md` — Visual refinement via canvas screenshot comparison with Gemini
