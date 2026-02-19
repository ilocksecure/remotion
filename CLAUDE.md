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
User prompt → /api/generate-layout (Gemini 2.5 Flash via Vercel AI SDK)
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
- `app/api/generate-layout/route.ts` — POST handler: validates brief, calls Gemini, repairs JSON via `jsonrepair`, validates with Zod
- `app/lib/layout-engine.ts` — `processLayout()`: boundary clamping, 8px grid snap, collision resolution, z-index normalization
- `app/lib/svg-mapper.ts` — `componentToSVG()`: renders 11 component types to SVG strings with gradient/shadow support

**Editor UI:**
- `app/editor/page.tsx` — Main editor page, manages all state (layout, palette, style, dimensions)
- `app/components/CanvasEditor.tsx` — Fabric.js v6 canvas wrapper with zoom/pan, lazy-loads fabric
- `app/components/ChatPanel.tsx` — Left sidebar: prompt input + message history + ColorPalettePicker
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

`ComponentStyleSchema` supports: `fill`, `stroke`, `strokeWidth`, `borderRadius`, `opacity`, `fontFamily`, `fontSize`, `fontWeight`, `textAlign`, `color`, `letterSpacing`, `lineHeight`, `gradient` (angle + color stops), `shadow` (x/y/blur/color). The SVG mapper converts `gradient` to `<linearGradient>` defs and `shadow` to `<filter>` elements.

## Important Patterns

- **LLM returns structured JSON, not raw SVG.** The Zod schema constrains the LLM output. The SVG mapper deterministically converts JSON → SVG. Never have the LLM generate SVG directly.
- **All validation happens through Zod schemas.** `schemas.ts` is the single source of truth. Types in `types.ts` are derived via `z.infer<>`.
- **The API route uses `jsonrepair`** to fix malformed LLM JSON (trailing commas, unescaped characters, comments) before parsing. Markdown fences are stripped first via `extractJson()`.
- **Fabric.js v6** uses async patterns: `dispose()` returns a Promise, `loadSVGFromString()` returns a Promise. The canvas lazy-loads the fabric module.
- **`processLayout()`** always runs after LLM generation — it clamps to canvas bounds, snaps to 8px grid, resolves collisions, and normalizes z-indices.

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
