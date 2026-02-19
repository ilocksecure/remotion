# Design-to-Animation: Implementation Task List

> **Purpose:** Step-by-step build plan for Claude to execute autonomously.
> **Architecture doc:** [ai-design-to-animation-pipeline.md](./ai-design-to-animation-pipeline.md)
> **Target folder:** `C:\GitHub\design-to-animation\` (does not exist yet)
> **Start date:** TBD

---

## Pre-Flight Checks

Before starting Phase 1, verify:
- [ ] Node.js 18+ installed
- [ ] `GEMINI_API_KEY` available in environment
- [ ] Can reference existing projects for patterns:
  - `C:\GitHub\ilocksecure-explainer\` — Remotion 4.0.261, React 19, TransitionSeries
  - `C:\GitHub\watch-recog\` — Gemini API (`@google/genai` 1.40), DragDropZone, Next.js 15
  - `C:\GitHub\remotion\docs\` — All architecture docs

---

## Phase 1: Project Scaffolding + Core Types

**Goal:** Empty Next.js project with all Zod schemas and TypeScript types — the foundation everything else imports.

### Task 1.1 — Scaffold Next.js project
```
npx create-next-app@latest design-to-animation \
  --typescript --tailwind --eslint --app --src-dir=false \
  --import-alias="@/*"
```
- Location: `C:\GitHub\design-to-animation\`
- Verify: `npm run dev` starts at localhost:3000

### Task 1.2 — Install core dependencies
```
npm install fabric@6 zod react-colorful jspdf ai @ai-sdk/google @ai-sdk/anthropic
npm install -D @types/fabric
```

### Task 1.3 — Install Remotion dependencies
```
npm install remotion@4.0.261 @remotion/cli@4.0.261 @remotion/transitions@4.0.261 @remotion/google-fonts@4.0.261
```

### Task 1.4 — Create Zod schemas (`app/lib/schemas.ts`)
Write ALL Zod schemas from the architecture doc:
- `PaletteSchema`
- `DesignBriefSchema`
- `ComponentStyleSchema`
- `ComponentSpecSchema` (recursive with `z.lazy` for children)
- `BackgroundSchema`
- `LayerSpecSchema`
- `LayoutSpecSchema`
- `EditInstructionSchema` (discriminated union for diff operations)

**Acceptance:** `npx tsc --noEmit` passes. All schemas export cleanly.

### Task 1.5 — Create TypeScript types (`app/lib/types.ts`)
Infer all types from schemas using `z.infer<>`:
```ts
export type DesignBrief = z.infer<typeof DesignBriefSchema>;
export type LayoutSpec = z.infer<typeof LayoutSpecSchema>;
export type ComponentSpec = z.infer<typeof ComponentSpecSchema>;
// ... etc
```

**Acceptance:** Import types in a test file, ensure IntelliSense works.

### Task 1.6 — Create `.env.local`
```
GEMINI_API_KEY=your_key_here
```
Add `.env.local` to `.gitignore` (should already be there from Next.js scaffold).

### Task 1.7 — Create `remotion.config.ts`
```ts
import { Config } from "@remotion/cli/config";
Config.setOverwriteOutput(true);
Config.setImageFormat("jpeg");
```

### Task 1.8 — Create project folder structure
Create all empty directories per the architecture doc:
```
app/api/generate-layout/
app/api/generate-image/
app/api/edit-design/
app/api/export/
app/components/
app/lib/
src/components/
src/lib/
public/images/
public/voiceover/
```

**Phase 1 verification:**
- `npm run dev` works
- `npm run build` passes
- `npx tsc --noEmit` passes
- All Zod schemas parse sample data correctly (write a quick test)

---

## Phase 2: Prompt Builder + LLM Layout Generation

**Goal:** Send a text prompt → get back a validated `LayoutSpec` JSON from Gemini. The most critical step — if this doesn't work, nothing else matters.

### Task 2.1 — Create prompt builder (`app/lib/prompt-builder.ts`)
Implement `buildDesignPrompt(brief: DesignBrief): string`
- Include the Zod-derived JSON schema as plain text in the prompt
- Include design rules (color palette usage, position constraints, font sizes)
- Include component type examples
- Include style-specific instructions (minimal vs corporate vs playful)

### Task 2.2 — Create `generate-layout` API route (`app/api/generate-layout/route.ts`)
- Accept POST with `DesignBrief` body
- Validate input with `DesignBriefSchema.parse(body)`
- Call Gemini via Vercel AI SDK `generateObject()` with `LayoutSpecSchema`
- If Vercel AI SDK `generateObject` doesn't work well with Gemini, fallback to raw `@google/genai` + manual `JSON.parse` + `LayoutSpecSchema.parse()`
- Return validated `LayoutSpec`
- Error handling: retry up to 2 times on validation failure, return 500 with error details

### Task 2.3 — Test the LLM pipeline manually
Create a temporary test page at `app/test/page.tsx`:
- Hardcode a `DesignBrief` (e.g., "a modern fintech landing page")
- Button to call `/api/generate-layout`
- Display raw JSON response
- Verify: all component types present, positions within canvas bounds, colors match palette

**Run at least 5 different prompts and check output quality:**
1. "Mobile login screen with social auth buttons"
2. "Dashboard with sidebar nav and 4 metric cards"
3. "E-commerce product page with image gallery and add to cart"
4. "Landing page hero section with headline, subtitle, and CTA button"
5. "Settings page with form fields and save button"

**Phase 2 verification:**
- API returns valid `LayoutSpec` for all 5 test prompts
- Every response passes Zod validation
- Component positions don't exceed canvas bounds
- Colors come from the provided palette
- Response time under 10 seconds

---

## Phase 3: Layout Engine + SVG Mapper

**Goal:** Take `LayoutSpec` → compute final positions → output SVG strings. Pure functions, no UI, fully testable.

### Task 3.1 — Create layout engine (`app/lib/layout-engine.ts`)
Implement `processLayout(raw: LayoutSpec): LayoutSpec` with:
- Bounds clamping (no component outside canvas)
- Grid snapping (8px grid)
- Collision resolution (`resolveCollisions()`)
- Z-index normalization
- Helper: `intersects(a: ComponentSpec, b: ComponentSpec): boolean`

### Task 3.2 — Create SVG mapper (`app/lib/svg-mapper.ts`)
Implement `componentToSVG(spec: ComponentSpec): string` with:
- `text` → SVG text element with font styling
- `shape` → SVG rect with fill, stroke, border-radius
- `button` → SVG rect + centered text overlay
- `card` → SVG rect with shadow filter + recursive children
- `container` → Optional background rect + recursive children
- `image-placeholder` → Dashed rect with label text
- `icon` → Placeholder SVG circle/square (can enhance later)

Every SVG must include `xmlns="http://www.w3.org/2000/svg"` and proper `width`/`height`.

### Task 3.3 — Create a visual test page
Extend or replace `app/test/page.tsx`:
- Call `/api/generate-layout` with a hardcoded brief
- Run `processLayout()` on the result
- Map each component through `componentToSVG()`
- Render SVG strings inline using `dangerouslySetInnerHTML` on a div
- Verify: visual output looks like a real UI layout, no overlapping text, colors correct

**Phase 3 verification:**
- `processLayout()` resolves collisions (test with two overlapping rects)
- Grid snapping works (positions are multiples of 8)
- SVG strings render correctly in browser
- All 7 component types produce valid SVG

---

## Phase 4: Fabric.js Canvas Editor

**Goal:** Interactive canvas where generated designs load as selectable, draggable, resizable objects.

### Task 4.1 — Create `CanvasEditor` component (`app/components/CanvasEditor.tsx`)
- Initialize Fabric.js v6 `Canvas` on a `<canvas>` ref
- Async `dispose()` in React cleanup (useEffect return)
- Accept `layout: LayoutSpec` as prop
- When layout changes, call `loadDesignToCanvas()` to clear and re-populate
- Canvas size matches `layout.canvasWidth` x `layout.canvasHeight`
- Wrap in a scrollable/zoomable container div

### Task 4.2 — Implement `loadDesignToCanvas()` in CanvasEditor
- Uses `componentToSVG()` from svg-mapper
- Uses Fabric.js v6 `util.loadSVGFromString()` (Promise-based)
- Stores `componentId` in each Fabric object's `.data` property
- Sets background from `layout.background`
- Objects are selectable, draggable, resizable by default

### Task 4.3 — Create the editor page (`app/editor/page.tsx`)
Layout:
```
┌──────────────────────────────────────────────────┐
│  Toolbar (top)                                    │
├────────────┬─────────────────────┬───────────────┤
│  Chat      │                    │  Layer         │
│  Panel     │   Canvas           │  Panel         │
│  (left)    │   (center)         │  (right)       │
│            │                    │                │
│  280px     │   flex-1           │  240px         │
└────────────┴─────────────────────┴───────────────┘
```
- Three-column layout with Tailwind
- For now: only the canvas center panel works
- Chat and Layer panels can be placeholder divs with "Coming soon" text
- Include a hardcoded "Generate" button that calls `/api/generate-layout` and loads result into canvas

### Task 4.4 — Add zoom and pan controls
- Mouse wheel = zoom (scale canvas container)
- Hold spacebar + drag = pan (scroll container)
- Zoom indicator showing current % in toolbar
- Fit-to-screen button

### Task 4.5 — Test canvas interactions
- Generate a layout, load it
- Select objects, drag them, resize them
- Verify: Fabric.js selection handles appear, objects move smoothly
- Verify: canvas doesn't break on re-generation (clear + reload)

**Phase 4 verification:**
- Canvas renders LLM-generated layouts correctly
- Objects are selectable, draggable, resizable
- Zoom and pan work
- Re-generating clears and reloads without errors
- No memory leaks (check with multiple generate cycles)

---

## Phase 5: User Input UI (Step 1 Complete)

**Goal:** Full input form — chat prompt, color picker, image uploader, style selector.

### Task 5.1 — Create `ChatPanel` component (`app/components/ChatPanel.tsx`)
- Text input area at bottom (like a chat)
- Messages list above (user messages + system responses)
- "Generate Design" button (or Enter to send)
- Shows loading spinner during LLM call
- Displays the generated LayoutSpec component count as confirmation

### Task 5.2 — Create `ColorPalettePicker` component (`app/components/ColorPalettePicker.tsx`)
- 5 color swatches: primary, secondary, accent, background, text
- Click a swatch → opens `react-colorful` HexColorPicker
- Preset palette buttons (e.g., "Corporate Blue", "Warm Sunset", "Dark Mode", "Pastel")
- Each preset fills all 5 swatches at once

### Task 5.3 — Create `ImageUploader` component (`app/components/ImageUploader.tsx`)
- Port pattern from `C:\GitHub\watch-recog\app\components\DragDropZone.tsx`
- Drag-and-drop zone with click fallback
- Max 5 images, client-side resize to 1500px max, JPEG 0.85 quality
- Preview thumbnails with remove button
- Convert uploaded images to base64 for LLM context

### Task 5.4 — Wire up the input UI to the generation pipeline
- ChatPanel sends `DesignBrief` to `/api/generate-layout`
- Brief is constructed from: chat message + ColorPalettePicker values + ImageUploader files
- Style preset dropdown in the toolbar
- Canvas dimensions preset dropdown (web 1440x900, mobile 375x812, presentation 1920x1080)
- On successful generation: layout loads into canvas, chat shows "Generated N components"

### Task 5.5 — Add style/dimension presets to toolbar (`app/components/ToolBar.tsx`)
- Style dropdown: minimal, corporate, playful, luxury, tech
- Dimension presets: Web (1440x900), Mobile (375x812), Tablet (768x1024), Presentation (1920x1080), Video Frame (1920x1080)
- Custom dimensions input

**Phase 5 verification:**
- User can type a prompt, pick colors, upload images
- Clicking Generate produces a design on canvas
- Color palette is respected in generated design
- Different style presets produce visibly different layouts
- Image uploads reach the LLM as context (visible in API logs)

---

## Phase 6: Bidirectional Sync + Undo/Redo

**Goal:** Canvas edits update LayoutSpec state, undo/redo works, layer panel shows real data.

### Task 6.1 — Create `DesignHistory` class (`app/lib/design-history.ts`)
- Implement from architecture doc: `push()`, `undo()`, `redo()`, `current`, `canUndo`, `canRedo`
- Max 50 history entries
- Uses `structuredClone()` for immutable snapshots

### Task 6.2 — Create canvas sync (`app/lib/canvas-sync.ts`)
- `setupCanvasSync()` function that listens to Fabric events:
  - `object:modified` → update position/size/rotation in LayoutSpec
  - `object:removed` → remove component from LayoutSpec
  - `object:added` → (for future: manually added objects)
- Each event pushes new state to DesignHistory

### Task 6.3 — Wire sync into `CanvasEditor`
- CanvasEditor uses DesignHistory via React Context or prop drilling
- Every canvas manipulation pushes to history
- Undo (Ctrl+Z) and Redo (Ctrl+Shift+Z) keyboard shortcuts
- On undo/redo: reload canvas from the restored LayoutSpec

### Task 6.4 — Create `LayerPanel` component (`app/components/LayerPanel.tsx`)
- Lists all components from current LayoutSpec
- Shows: component name (id), type icon, visibility toggle, lock toggle
- Click a layer → selects corresponding object on canvas
- Drag layers to reorder (updates zIndex)
- Delete button per layer

### Task 6.5 — Add undo/redo buttons to toolbar
- Undo and Redo buttons with icons
- Disabled state when `!canUndo` / `!canRedo`
- Tooltip showing "Undo (Ctrl+Z)" / "Redo (Ctrl+Shift+Z)"

**Phase 6 verification:**
- Drag an object → LayoutSpec state updates
- Undo → object returns to previous position
- Redo → object moves back to edited position
- Layer panel reflects current state in real time
- Click layer → canvas selects that object
- Delete from layer panel → object removed from canvas
- 10+ rapid edits → undo all → canvas matches initial state

---

## Phase 7: AI Image Enhancement (Step 5)

**Goal:** Replace `image-placeholder` components with AI-generated images.

### Task 7.1 — Create `generate-image` API route (`app/api/generate-image/route.ts`)
- Accept POST with: `prompt`, `aspectRatio`, `palette`
- Call Gemini image generation (Nano Banana — `gemini-2.5-flash-image`)
- Return base64 data URL
- Error handling: retry once, return placeholder on failure

### Task 7.2 — Create `enhanceWithImages()` function
- Scans LayoutSpec for `type === "image-placeholder"` components
- Batches generation requests (3 at a time for rate limits)
- Replaces Fabric.js placeholder objects with `fabric.Image` loaded from data URL
- Updates LayoutSpec: changes type to `"shape"`, stores data URL in content
- Shows progress indicator ("Generating image 2 of 4...")

### Task 7.3 — Add "Enhance with AI Images" button to toolbar
- Only enabled when layout contains image-placeholders
- Shows count: "Generate 3 images"
- Progress bar during generation
- Individual retry button per failed image

### Task 7.4 — Image source selector
- Dropdown in toolbar: Nano Banana (fast) / Nano Banana Pro (quality)
- Stores preference in React state (default: fast)

**Phase 7 verification:**
- Generate a layout with image placeholders
- Click enhance → placeholders replaced with real AI images
- Images match the design's color palette
- Aspect ratios are correct (landscape placeholders get landscape images)
- Failed generations show retry option, don't crash

---

## Phase 8: Chat-Based Editing (Step 6)

**Goal:** Type "make the header bigger" → LLM generates diff operations → canvas updates.

### Task 8.1 — Create `edit-design` API route (`app/api/edit-design/route.ts`)
- Accept POST with: `currentLayout` (compact summary), `editInstruction`
- Use `generateObject()` with `EditInstructionSchema` (diff-based)
- Return array of operations: modify/add/remove/reorder
- Fallback: if diff fails, try full-layout replacement

### Task 8.2 — Create `applyPromptEdit()` function (`app/lib/prompt-editor.ts`)
- Takes current LayoutSpec + edit operations
- Applies each operation: modify, add, remove, reorder
- Re-runs `processLayout()` for collision resolution
- Returns new LayoutSpec

### Task 8.3 — Wire chat editing into ChatPanel
- After initial generation, subsequent messages go to `/api/edit-design`
- Chat shows: user message → "Applying 3 changes..." → updated canvas
- Each edit pushes to DesignHistory (undoable)
- Chat maintains conversation context (previous messages visible)

### Task 8.4 — Smart edit detection
- If user message starts with "generate" or "create" → treat as new generation (Step 2)
- Otherwise → treat as edit to current design (Step 6)
- Show which mode is active in chat: "Generating new design..." vs "Editing current design..."

**Phase 8 verification:**
- "Make the title bigger" → title font size increases
- "Add a footer with copyright text" → new component appears at bottom
- "Remove the sidebar" → sidebar component removed
- "Change all buttons to red" → button fills update
- Each edit is undoable
- 5 sequential edits don't corrupt the layout

---

## Phase 9: Static Export (Step 7a)

**Goal:** Export current canvas as PNG, JPG, or PDF.

### Task 9.1 — Create `export-utils.ts` (`app/lib/export-utils.ts`)
- `exportDesign(canvas, format, scale)` → returns Blob
- PNG: `canvas.toDataURL("png")` with 2x multiplier
- JPG: `canvas.toDataURL("jpeg", 0.92)` with 2x multiplier
- PDF: raster approach — `canvas.toDataURL("png")` → `jsPDF.addImage()`
- `dataURLToBlob()` helper
- `downloadBlob(blob, filename)` — triggers browser download

### Task 9.2 — Create `ExportDialog` component (`app/components/ExportDialog.tsx`)
- Modal dialog triggered by export button in toolbar
- Format selector: PNG / JPG / PDF
- Scale selector: 1x / 2x / 3x
- Preview of estimated file size
- "Download" button → triggers `downloadBlob()`
- Filename auto-generated: `design-{timestamp}.{format}`

### Task 9.3 — Add export button to toolbar
- Export icon button → opens ExportDialog
- Keyboard shortcut: Ctrl+E

**Phase 9 verification:**
- PNG export produces correct image at 2x resolution
- JPG export produces compressed image
- PDF export opens in PDF viewer with correct dimensions
- Exported files match what's visible on canvas
- Large canvases (1920x1080) export without crashing

---

## Phase 10: Remotion Animation Pipeline (Step 7b)

**Goal:** Push finalized design into Remotion → render as animated MP4 video.

### Task 10.1 — Create animation presets (`src/lib/animation-presets.ts`)
- Define 4 presets: smooth, snappy, playful, corporate
- Each has: entrance spring config, stagger delay, exit delay

### Task 10.2 — Create `RemotionComponent` (`src/components/RemotionComponent.tsx`)
- Renders a single `ComponentSpec` with Remotion animations
- Text → typewriter effect using `interpolate` + string slicing
- Image → Ken Burns zoom using `interpolate` on scale
- Button/Shape/Card → static rendering with entrance/exit
- All driven by `useCurrentFrame()` — never CSS animations

### Task 10.3 — Create `DesignScene` (`src/components/DesignScene.tsx`)
- Renders a full `LayoutSpec` as one Remotion scene
- Staggered entrance: each component delayed by `i * staggerDelay` frames
- Exit animation triggered near end of scene duration
- Components sorted by zIndex for proper layering

### Task 10.4 — Create `DesignAnimation` composition (`src/DesignAnimation.tsx`)
- Accepts `layouts: LayoutSpec[]` (one or more slides)
- Uses `TransitionSeries` with fade/slide transitions
- Configurable: preset, transition style, frames per slide

### Task 10.5 — Create Remotion `Root.tsx` (`src/Root.tsx`)
- Register `DesignVideo` composition
- `calculateMetadata` computes duration from number of slides
- Default: 1920x1080, 30fps
- `index.ts` with `registerRoot`

### Task 10.6 — Create "Export as Video" flow
- New button in toolbar or ExportDialog: "Export as Video"
- Writes current LayoutSpec(s) as JSON to `public/design-data.json`
- Triggers `npx remotion render src/index.ts DesignVideo out/design-video.mp4 --props="./public/design-data.json"`
- Shows rendering progress
- On completion: offers download of MP4

### Task 10.7 — Preview in Remotion Studio
- `npx remotion studio` opens browser preview
- Loads current design data
- Verify: animations play correctly, transitions work, timing feels right

**Phase 10 verification:**
- Single-slide design → animated video with staggered entrances
- Multi-slide design → transitions between slides
- All 4 animation presets produce visibly different results
- Text components animate with typewriter effect
- Image components have Ken Burns zoom
- Video duration matches expected: (slides * framesPerSlide - transitions * 20) / 30 seconds
- Remotion Studio preview works for iteration

---

## Phase 11: Polish + Integration Testing

**Goal:** End-to-end flow works smoothly, edge cases handled.

### Task 11.1 — Error boundaries
- React error boundary around CanvasEditor (canvas crashes shouldn't kill the app)
- API error handling: show user-friendly error messages in chat
- Gemini rate limit handling: exponential backoff + user notification
- Network error handling: offline state detection

### Task 11.2 — Loading states
- Skeleton UI for canvas during generation
- Streaming indicator in chat during LLM calls
- Progress bars for image enhancement and video rendering
- Disable interactions during async operations

### Task 11.3 — Responsive editor layout
- Collapsible side panels (chat + layers)
- Mobile: stack panels vertically, canvas full-width
- Minimum canvas size: 320x320

### Task 11.4 — Keyboard shortcuts
| Shortcut | Action |
|----------|--------|
| Ctrl+Z | Undo |
| Ctrl+Shift+Z | Redo |
| Ctrl+E | Export |
| Delete/Backspace | Delete selected object |
| Ctrl+A | Select all |
| Escape | Deselect |
| Space+Drag | Pan canvas |
| Ctrl+Mouse wheel | Zoom |

### Task 11.5 — End-to-end test flow
Execute this complete flow and verify each step:
1. Open editor page
2. Pick "corporate" style, "web" dimensions, blue palette
3. Type "SaaS dashboard with sidebar navigation, 4 KPI cards, and a data table"
4. Wait for generation → canvas shows layout
5. Chat: "Make the KPI cards bigger and add a chart section below the table"
6. Verify edit applies correctly
7. Click "Enhance with AI Images" if there are placeholders
8. Manually drag some elements to new positions
9. Undo 2 changes, redo 1
10. Export as PNG → verify downloaded file
11. Export as Video → verify MP4 plays correctly
12. Try a second generation with different prompt → verify canvas resets

**Phase 11 verification:**
- Full flow completes without errors
- All keyboard shortcuts work
- Loading states display correctly
- Error cases show user-friendly messages
- No console errors or warnings

---

## Phase 12: Persist + Save/Load Projects (Bonus)

**Goal:** Save designs to local storage or Supabase for later editing.

### Task 12.1 — Local storage persistence
- Auto-save current LayoutSpec to localStorage every 30 seconds
- On page load: check for saved design, offer to restore
- "New Design" clears saved state

### Task 12.2 — Project save/load UI
- Save button → names the project, stores full LayoutSpec as JSON
- Load button → shows list of saved projects
- Each saved project: name, timestamp, thumbnail (canvas.toDataURL at small scale)

### Task 12.3 — (Optional) Supabase integration
- Save projects to Supabase database
- User authentication (optional)
- Share designs via URL

---

## Dependency Graph

```
Phase 1 ──→ Phase 2 ──→ Phase 3 ──→ Phase 4 ──→ Phase 5
(scaffold)   (LLM)      (engine)    (canvas)    (input UI)
                                        │
                                        ├──→ Phase 6 (sync + undo)
                                        │         │
                                        │         ├──→ Phase 8 (chat edit)
                                        │         │
                                        │         └──→ Phase 9 (export)
                                        │
                                        ├──→ Phase 7 (AI images)
                                        │
                                        └──→ Phase 10 (Remotion)

Phase 6 + 7 + 8 + 9 + 10 ──→ Phase 11 (polish)
                               Phase 11 ──→ Phase 12 (persist — bonus)
```

**Independent phases that can be built in parallel:**
- Phase 7 (AI images) — only needs canvas (Phase 4)
- Phase 10 (Remotion) — only needs types (Phase 1)
- Phase 9 (export) — only needs canvas (Phase 4)

---

## Effort Estimates

| Phase | Description | Tasks | Est. Time |
|-------|-------------|-------|-----------|
| 1 | Scaffold + Types | 8 | 2-3 hours |
| 2 | LLM Pipeline | 3 | 3-4 hours |
| 3 | Layout Engine + SVG | 3 | 2-3 hours |
| 4 | Canvas Editor | 5 | 4-5 hours |
| 5 | Input UI | 5 | 3-4 hours |
| 6 | Sync + Undo/Redo | 5 | 3-4 hours |
| 7 | AI Images | 4 | 2-3 hours |
| 8 | Chat Editing | 4 | 3-4 hours |
| 9 | Static Export | 3 | 1-2 hours |
| 10 | Remotion Pipeline | 7 | 4-5 hours |
| 11 | Polish + E2E Test | 5 | 3-4 hours |
| 12 | Persist (bonus) | 3 | 2-3 hours |
| **Total** | | **55 tasks** | **~33-44 hours** |

---

## How to Execute This Plan

Each phase should be run as a self-contained session:

1. **Start with:** "Implement Phase N of the design-to-animation project. Task list: [link to this doc]. Architecture doc: [link to pipeline doc]."
2. **Verify each phase** using its verification checklist before moving on.
3. **If a phase fails:** Fix the failing tasks before starting the next phase.
4. **Parallel execution:** Phases 7, 9, and 10 can start once Phase 4 is done — run them in separate sessions if desired.
5. **Commit after each phase:** One commit per phase, message format: `feat(design-to-animation): phase N — {description}`

---

## Key Files Quick Reference

| File | Purpose | Phase |
|------|---------|-------|
| `app/lib/schemas.ts` | All Zod schemas | 1 |
| `app/lib/types.ts` | Inferred TypeScript types | 1 |
| `app/lib/prompt-builder.ts` | LLM prompt construction | 2 |
| `app/api/generate-layout/route.ts` | Gemini → LayoutSpec | 2 |
| `app/lib/layout-engine.ts` | Position computation + collision | 3 |
| `app/lib/svg-mapper.ts` | ComponentSpec → SVG string | 3 |
| `app/components/CanvasEditor.tsx` | Fabric.js v6 canvas | 4 |
| `app/editor/page.tsx` | Main editor page layout | 4 |
| `app/components/ChatPanel.tsx` | Chat input + message history | 5 |
| `app/components/ColorPalettePicker.tsx` | 5-swatch color picker | 5 |
| `app/components/ImageUploader.tsx` | Drag-drop image upload | 5 |
| `app/components/ToolBar.tsx` | Top bar with actions | 5 |
| `app/lib/design-history.ts` | Undo/redo state manager | 6 |
| `app/lib/canvas-sync.ts` | Canvas ↔ LayoutSpec sync | 6 |
| `app/components/LayerPanel.tsx` | Layer list sidebar | 6 |
| `app/api/generate-image/route.ts` | Nano Banana image gen | 7 |
| `app/api/edit-design/route.ts` | Diff-based edit operations | 8 |
| `app/lib/export-utils.ts` | PNG/JPG/PDF export | 9 |
| `app/components/ExportDialog.tsx` | Export format modal | 9 |
| `src/lib/animation-presets.ts` | Spring config presets | 10 |
| `src/components/DesignScene.tsx` | LayoutSpec → animated scene | 10 |
| `src/components/RemotionComponent.tsx` | Component-level animations | 10 |
| `src/DesignAnimation.tsx` | TransitionSeries composition | 10 |
| `src/Root.tsx` | Remotion root + metadata | 10 |
