import type { DesignBrief, LayoutSpec, Palette } from "./types";

/**
 * Stage 1: Generate a detailed design specification as structured text.
 * No JSON constraints — lets Gemini be creative and specific.
 */
export function buildDesignSpecPrompt(brief: DesignBrief): string {
  return `You are a senior UI designer creating a detailed design specification for a ${brief.targetFormat}.

Design request: ${brief.description}
Industry: ${brief.industry ?? "general"}
Style preset: ${brief.style}
Canvas size: ${brief.dimensions.width}x${brief.dimensions.height} pixels

Color palette:
  - Primary: ${brief.palette.primary}
  - Secondary: ${brief.palette.secondary}
  - Accent: ${brief.palette.accent}
  - Background: ${brief.palette.background}
  - Text: ${brief.palette.text}

Style-specific guidance:
${getStyleInstructions(brief.style)}

## Design Principles You MUST Apply

### Visual Hierarchy Through Contrast
- Use 3-4x size ratios between heading levels (e.g. 48px title → 14px body = 3.4x)
- Create weight contrast: pair bold headings (700-800) with light body (400)
- Use accent color on max 2-3 elements — restraint creates impact
- Every layout needs ONE dominant focal point (hero text, feature image, or stat)

### Depth and Elevation
- Use 2-3 layered shadows for realistic depth instead of a single flat shadow:
  - Ambient layer: { x: 0, y: 1, blur: 3, color: "rgba(0,0,0,0.08)" }
  - Key shadow: { x: 0, y: 4, blur: 16, color: "rgba(0,0,0,0.06)" }
  - Elevated: { x: 0, y: 8, blur: 32, color: "rgba(0,0,0,0.04)" }
- Cards should feel lifted off the background, not flat
- Buttons should have subtle depth — they're interactive affordances

### Whitespace as a Design Element
- 48-80px spacing between major sections (never less than 32px)
- 24-32px internal padding for cards
- 80px+ side margins for content (content should fill 60-80% of canvas width, not edge-to-edge)
- Let elements breathe — crowded layouts look amateur

### Color Temperature
- Use warm or cool neutrals for backgrounds (not pure white #FFFFFF — try #FAFAFA, #F8FAFC, #FFF8F0)
- Pure white cards on slightly tinted backgrounds create natural contrast
- Dark text should be #1A1A2E or #0F172A (not pure #000000)

### Typography Rhythm
- Use a consistent type scale: 48 / 32 / 24 / 18 / 16 / 14 / 12
- Headings: tight letter-spacing (-0.5 to -1px)
- Body: generous line-height (1.5-1.6)
- Labels/badges: uppercase with wide letter-spacing (1-2px), use textTransform "uppercase"
- Never use more than 2 font families

### Component Composition Patterns
- Pricing card: badge (plan name, uppercase) → price (48px bold) → period ("/mo", 14px muted) → feature list → CTA button
- Hero section: overline text (uppercase, small, accent color) → headline (48px+) → subtitle (18px, muted) → CTA group → optional image
- Feature card: icon (48px circle) → title (20px bold) → description (14px, 2-3 lines max)
- Stat card: label (12px uppercase) → value (36-48px bold) → trend indicator (badge)
- Nav bar: logo text left → menu items center/right → CTA button far right

### Layout Density
- Content should occupy 60-80% of canvas width, centered
- Never place components at the very edge of the canvas
- Use invisible container components to group sections and create structure

Create a comprehensive, opinionated design specification. Be EXTREMELY specific — use exact hex colors, exact pixel sizes, and write out all text content verbatim. Do NOT be vague or use placeholders like "some text here".

Structure your response with these sections:

## Visual Theme
- Background color and any background elements (shapes, gradients)
- Overall mood and visual approach
- Font choices (specific font families)

## Content
- Exact headline text (write the actual words)
- Exact subheadline/tagline text
- Body copy (write out every paragraph)
- Button labels (exact text)
- Badge/tag text
- Any list items, feature names, or data points

## Layout Structure
- Describe each section from top to bottom
- Approximate position and size of each section in pixels
- How sections relate to each other (stacked, side-by-side, overlapping)
- Overall composition pattern (centered, asymmetric, grid, etc.)

## Typography
- For each text element: font family, size in px, weight (100-900), color (hex), letter-spacing, alignment, textTransform
- Clear hierarchy from largest to smallest

## Component Details
- For each visual element: what type it is (card, button, avatar, badge, shape, divider, image-placeholder, input-field, icon, text, container)
- Exact fill colors, border radius in px, stroke colors and widths
- Shadow layers (use "shadows" array for multi-layered depth: ambient + key + optional elevated)
- Gradient details (angle, color stops) where applicable
- textTransform for labels, badges, and nav items

## Spacing
- Gaps between sections in px (48-80px between major sections)
- Internal padding of cards/containers in px (24-32px)
- Margins from canvas edges in px (80px+ side margins)

Use the provided color palette — do not invent new colors outside the palette. Be specific and opinionated about every detail. This spec will be mechanically converted to a component layout, so precision matters.`;
}

/**
 * Stage 2: Convert a design specification into valid LayoutSpec JSON.
 * Focused on mechanical translation with strict schema adherence.
 */
export function buildLayoutJsonPrompt(brief: DesignBrief, designSpec: string): string {
  return `You are a layout engineer. Convert the following design specification into valid JSON matching the schema below. Follow the design spec exactly — use the exact colors, sizes, text content, and layout described.

Required JSON schema:
{
  "id": "string (unique layout id)",
  "canvasWidth": ${brief.dimensions.width},
  "canvasHeight": ${brief.dimensions.height},
  "background": { "type": "solid", "value": "${brief.palette.background}" },
  "components": [
    {
      "id": "string (kebab-case, e.g. header-title)",
      "type": "text|shape|icon|image-placeholder|button|card|container|avatar|badge|divider|input-field",
      "position": { "x": number, "y": number },
      "size": { "width": number (min 1), "height": number (min 1) },
      "rotation": 0,
      "zIndex": number (0+),
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
        "color?": "#hex (text color)",
        "letterSpacing?": number (px),
        "lineHeight?": number (multiplier),
        "gradient?": {
          "angle": number (degrees, 0=right, 90=down, 180=left),
          "stops": [{ "color": "#hex", "position": 0-100 }]
        },
        "shadow?": { "x": number, "y": number, "blur": number, "color": "rgba()" },
        "shadows?": [
          { "x": number, "y": number, "blur": number, "color": "rgba()" }
        ],
        "textTransform?": "uppercase|lowercase|capitalize|none"
      },
      "children?": [ ...same component shape ],
      "content?": "string (text content, initials for avatar, label for badge, placeholder for input-field)"
    }
  ],
  "layers": [{ "id": "main", "name": "Main", "visible": true, "locked": false, "componentIds": ["all", "component", "ids"] }]
}

Component types guide:
- "text": Headings, paragraphs, labels. Use textAlign, letterSpacing, textTransform for polish.
- "shape": Rectangles, decorative blocks. Supports gradient fills and shadows.
- "icon": Circular icon with inner symbol. Set content to "check", "star", "arrow" for specific icons.
- "image-placeholder": Polished placeholder with mountain/sun icon. Set content to descriptive text (e.g. "Hero product shot"). NOT a dashed gray box — renders as a styled card with icon.
- "button": CTA buttons with gradient support and inner highlight. Default fontWeight 600. Use textTransform "uppercase" for action labels.
- "card": Content cards with automatic multi-layer shadow and 1px border. Use children array for inner components. IMPORTANT: Every child inside a card MUST have a "style" object (at minimum an empty {} or with relevant properties).
- "container": Invisible grouping wrapper with optional background. Use for sections/rows.
- "avatar": Circle with gradient background + centered initials. Set content to person's name (e.g. "Jane Doe" -> "JD").
- "badge": Small pill/tag label. Set content to status text (e.g. "Active", "Pro", "New"). Renders uppercase by default — use textTransform to control.
- "divider": Horizontal or vertical separator line. Use stroke color and strokeWidth.
- "input-field": Form input with light background, border, and placeholder text. Set content to placeholder text.

Layout rules:
- All positions are absolute pixel coordinates from top-left origin
- Component IDs must be unique, descriptive kebab-case (e.g. "hero-heading", "cta-button", "team-avatar-1")
- Ensure no component extends beyond canvas boundaries (0,0 to ${brief.dimensions.width},${brief.dimensions.height})
- Include a single default layer named "main" that references all top-level component IDs
- Maximum 50 components. Prefer fewer, well-structured components over many small ones
- EVERY component MUST have a "style" object — never omit it, even if empty ({})

Spacing and layout (CRITICAL — this makes or breaks the design):
- 48-64px spacing between major sections (hero → features → CTA)
- 24-32px internal padding for cards (child position = card position + 24)
- 80px+ horizontal margins from canvas edges — content should be centered in 60-80% of canvas width
- 16-24px gaps between cards in a grid
- Consistent vertical rhythm: same spacing between repeated elements

Typography hierarchy:
- Page titles: 42-56px, fontWeight 700-800, letterSpacing -0.5 to -1
- Section headings: 24-32px, fontWeight 600-700
- Subheadings: 18-22px, fontWeight 500-600
- Body text: 14-16px, fontWeight 400
- Overline/labels: 11-13px, fontWeight 500-600, letterSpacing 1-2, textTransform "uppercase"
- Badges: 10-12px, fontWeight 600, letterSpacing 0.5, textTransform "uppercase"

Multi-shadow depth system (use "shadows" array for realistic depth):
- Subtle (cards, inputs): shadows: [{ x: 0, y: 1, blur: 3, color: "rgba(0,0,0,0.08)" }, { x: 0, y: 4, blur: 16, color: "rgba(0,0,0,0.06)" }]
- Elevated (buttons, hover cards): shadows: [{ x: 0, y: 2, blur: 4, color: "rgba(0,0,0,0.08)" }, { x: 0, y: 8, blur: 24, color: "rgba(0,0,0,0.08)" }]
- Modal/floating: shadows: [{ x: 0, y: 4, blur: 8, color: "rgba(0,0,0,0.08)" }, { x: 0, y: 16, blur: 48, color: "rgba(0,0,0,0.12)" }]
- Flat/minimal: no shadow or shadows properties
- Prefer "shadows" (array) over "shadow" (single) for richer depth

textTransform usage:
- Badges and tags: textTransform "uppercase" (default behavior)
- Navigation items: textTransform "uppercase" with letterSpacing 1
- Overline labels (e.g. "FEATURED", "POPULAR"): textTransform "uppercase"
- Headings and body: no textTransform (leave as-is)

Gradient usage:
- Use the "gradient" property on style to create linear gradients instead of flat fills
- Hero sections and primary buttons benefit most from gradients
- Example: { "angle": 135, "stops": [{ "color": "#6366F1", "position": 0 }, { "color": "#8B5CF6", "position": 100 }] }
- Gradients should use colors from the palette (primary->accent, or primary->secondary)
- Don't overuse gradients — 2-3 gradient elements per design maximum

Component composition best practices:
- Cards should contain: image-placeholder at top -> title text -> description text -> optional CTA button
- Team/profile sections should use avatar components with name text beside them
- Form sections should use input-field components with label text above each field
- Use badge components for status indicators, plan labels, and category tags
- Use divider components to separate sections or between list items
- Navigation bars should be a container with text children for menu items
${brief.referenceImages && brief.referenceImages.length > 0 ? `
Reference images are attached. Use them to refine positioning and visual details.
` : ""}
--- DESIGN SPECIFICATION TO CONVERT ---
${designSpec}
--- END DESIGN SPECIFICATION ---

Convert this design specification to valid JSON. Follow it exactly — use the exact colors, font sizes, text content, positions, and component types described. Do not add, remove, or change any design decisions. Your job is purely mechanical translation from the spec to JSON.`;
}

/**
 * @deprecated Use buildDesignSpecPrompt() + buildLayoutJsonPrompt() for the two-stage pipeline.
 * Kept for backwards compatibility.
 */
export function buildDesignPrompt(brief: DesignBrief): string {
  return buildLayoutJsonPrompt(brief, `Design brief: ${brief.description}\nStyle: ${brief.style}\nCreate a polished, visually rich, professional layout. Use layered shadows, gradients, generous spacing, and proper hierarchy to create depth. The output should look like a real product design, not a wireframe. Use the shadows array for multi-layer depth on cards and buttons. Use textTransform "uppercase" for badges and labels.`);
}

function getStyleInstructions(
  style: DesignBrief["style"]
): string {
  switch (style) {
    case "minimal":
      return `MINIMAL STYLE — Refined simplicity, every element intentional.

Visual Foundation:
- ZERO shadows and ZERO gradients on any component — this is non-negotiable
- Cards defined by 1px borders in rgba(0,0,0,0.06) or #E5E7EB — never by shadow
- Background: warm white #FAFAF9 or cool #F8FAFC (NEVER pure #FFFFFF for the page background)
- Cards: pure #FFFFFF (contrast comes from the off-white background)

Typography:
- Font: Inter for everything
- Headings: weight 500 (medium, NOT bold) — bold feels heavy in minimal design
- Body: weight 400, color #64748B (muted slate)
- Text color: #1E293B for headings (dark slate, not black)
- One accent color only — use it on max 1 CTA button and 1 text link
- Labels/overlines: 11px, weight 500, textTransform "uppercase", letterSpacing 2

Layout & Spacing:
- 64-80px between major sections — whitespace IS the design
- 24px card internal padding
- Content width: max 60% of canvas, generously centered
- Buttons: flat fill with NO shadow, borderRadius 6px, height 40-44px

Component Rules:
- Dividers between sections: 1px, opacity 0.15
- Badges: outline style — transparent fill, 1px border in accent color, accent text color
- No decorative shapes or background elements — content only
- Image placeholders: 4px borderRadius, no border`;

    case "corporate":
      return `CORPORATE STYLE — Trustworthy, structured, polished professionalism.

Visual Foundation:
- Background: #F8FAFC or #F1F5F9 (cool blue-gray tint)
- Cards: #FFFFFF with multi-layer shadows for depth:
  shadows: [{ x: 0, y: 1, blur: 3, color: "rgba(0,0,0,0.06)" }, { x: 0, y: 4, blur: 16, color: "rgba(0,0,0,0.04)" }]
- borderRadius: 12px for cards, 8px for buttons, 6px for inputs
- Primary color for section headers, CTA buttons, and active states
- Secondary color for secondary buttons, borders, and muted elements

Typography:
- Font: Inter for everything (or specified palette font)
- Page title: 48px, weight 800, letterSpacing -1, color: #0F172A
- Section headings: 28px, weight 700, color: #1E293B
- Subheadings: 18px, weight 600, color: #334155
- Body: 15px, weight 400, color: #64748B, lineHeight 1.6
- Labels: 12px, weight 600, textTransform "uppercase", letterSpacing 1.5
- Badges: 11px, weight 600, textTransform "uppercase", letterSpacing 0.5

Layout:
- Structured grid: header card grid, or sidebar + main content
- 48-64px between major sections
- 24px card internal padding, 16-20px gaps between cards in a grid
- 80px+ side margins (content centered in ~70% of canvas width)

Component Recipes:
- Status badges: fill primary (light tint), text primary (dark), borderRadius 999 (full pill)
- Stat cards: 12px label (uppercase, muted) above 36px bold value above optional trend badge
- Avatar + name combos in team sections
- Buttons: primary fill + white text + shadow, secondary: white fill + primary border + primary text
- Tables/lists: use dividers between items with 0.08 opacity
- Input fields: white fill, #E2E8F0 border, 12px borderRadius`;

    case "playful":
      return `PLAYFUL STYLE — Energetic, bold, fun and inviting.

Visual Foundation:
- Background: white or very light tint (#FFFBF5 warm, #F0F9FF cool)
- Cards with visible, personality-rich shadows:
  shadows: [{ x: 0, y: 4, blur: 8, color: "rgba(0,0,0,0.06)" }, { x: 0, y: 12, blur: 32, color: "rgba(0,0,0,0.08)" }]
- borderRadius: 20-24px for cards, 14px for buttons, 999px for avatars and badges (full pill)
- Gradient buttons are MANDATORY: gradient from primary -> accent at 135 degrees

Typography:
- Font: Inter (or a rounded sans-serif if specified)
- Title: 52-60px, weight 800, letterSpacing -1.5 — go BIG and bold
- Section headings: 32px, weight 700
- Body: 16px, weight 400, lineHeight 1.6
- Labels: 12px, weight 700, textTransform "uppercase", letterSpacing 1.5
- Use accent color for highlighted words in headings

Layout & Spacing:
- 48-64px between sections
- 24-32px card padding
- Cards in a grid with 20-24px gaps

Component Recipes:
- Buttons: 48-56px height, gradient fill, white bold text, borderRadius 14px, shadow
- Badges: accent fill, white text, full-pill radius (999px), textTransform "uppercase"
- Color-tinted shadows on accent elements: use rgba version of accent color at 0.15 opacity
- Decorative shapes: 2-3 subtle background shape components with gradient fills, large borderRadius, opacity 0.08-0.15
- Avatars: outlined with 2px accent stroke
- Icons: vibrant accent fill backgrounds`;

    case "luxury":
      return `LUXURY STYLE — Opulent, refined, exclusive sophistication.

Visual Foundation:
- Background: DARK palette background (expect #0A0A0A, #0D0D0D, #1A1A2E or similar)
- Cards: slightly lighter dark (#141414, #1A1A2E) with subtle gold/accent strokes
  stroke: accent color at ~0.3 opacity, strokeWidth: 1
- Gold accents (accent color, expect #D4AF37 or similar) ONLY on: dividers, badge borders, button strokes, icon fills — never as large background fills
- shadows: [{ x: 0, y: 2, blur: 8, color: "rgba(0,0,0,0.3)" }, { x: 0, y: 8, blur: 32, color: "rgba(0,0,0,0.2)" }]

Typography:
- Headings: "Playfair Display, Georgia, serif", weight 400-500 (elegant, NOT bold — luxury avoids heaviness)
- Body: "Inter, system-ui, sans-serif", weight 300-400, color: rgba(255,255,255,0.7)
- Title: 48-56px, weight 500, letterSpacing -0.5, color: #FFFFFF
- Section headings: 28-32px, weight 400, color: accent gold
- Overline labels: 11px, weight 500, textTransform "uppercase", letterSpacing 3-4, color: accent gold
- Body text: 15px, weight 300, color: rgba(255,255,255,0.65), lineHeight 1.7

Layout & Spacing (GENEROUS — luxury = space):
- 72-96px between major sections — space conveys exclusivity
- 32px card internal padding
- Content width: max 50-60% of canvas — generous margins, centered
- 80-120px side margins

Component Recipes:
- Dividers: accent/gold stroke, strokeWidth 1, opacity 0.4
- Badges: transparent fill, 1px gold stroke, gold text, textTransform "uppercase"
- Buttons: transparent or dark fill, 1px gold stroke, gold text — never bold/chunky
- Image placeholders: 12px borderRadius, 1px accent border
- Cards: dark fill, 1px accent stroke at 0.2 opacity
- Decorative elements: thin gold lines, small accent shapes with low opacity
- NO gradients on buttons — keep them sleek and understated
- Gradient only on hero background: subtle dark-to-slightly-lighter-dark`;

    case "tech":
      return `TECH STYLE — Precision-engineered, data-driven, cutting-edge.

Visual Foundation:
- Background: #0B1120 or #0F172A (deep navy-black)
- Cards: #111827 or #1E293B, defined by BORDERS not shadows
  stroke: "#1E3A5F" or "#334155", strokeWidth: 1
  borderRadius: 6-8px (sharp but not harsh)
- Accent glow recipe for key elements:
  shadows: [{ x: 0, y: 0, blur: 20, color: "rgba(accent,0.15)" }, { x: 0, y: 0, blur: 4, color: "rgba(accent,0.3)" }]
  (replace "accent" with actual accent color values)

Typography:
- Headings: "Inter, system-ui, sans-serif", weight 700, color: #F1F5F9
- Body: "Inter, system-ui, sans-serif", weight 400, color: #94A3B8
- Data/numbers/code: "JetBrains Mono, Fira Code, monospace", weight 500
- Title: 40-48px, weight 700, letterSpacing -0.5
- Stat values: 36-48px, weight 700, monospace font, accent color
- Labels: 11px, weight 600, textTransform "uppercase", letterSpacing 1.5, color: #64748B

Layout & Spacing:
- 48-64px between major sections
- 20-24px card padding
- Content width: 70-80% of canvas
- 16-20px grid gaps between cards
- Dark section alternation: alternate between #0B1120 and #111827 backgrounds for sections

Component Recipes:
- Cards: border-defined (NOT shadow-defined), 1px #1E3A5F border, dark fill
- Buttons: gradient fill (accent start -> accent end, 135 degrees), white text, 8px radius
  OR: transparent fill, 1px accent border, accent text (secondary style)
- Badges: accent gradient fill for primary, dark fill + accent border for secondary, textTransform "uppercase"
- Input fields: dark fill (#1E293B), border #334155, borderRadius 6px, color #E2E8F0
- Stat cards: large monospace number + small uppercase label + optional trend badge
- Dividers: #1E293B color, opacity 0.6
- Accent glow on primary buttons and key metrics: shadows array with accent-tinted blur
- Progress/status indicators: accent gradient fill shapes`;
  }
}

// ─── Edit Prompt Builder ────────────────────────────────────────────

interface EditPromptOptions {
  style: DesignBrief["style"];
  palette: Palette;
  dimensions: { width: number; height: number };
}

function serializeLayout(layout: LayoutSpec): string {
  const bg = layout.background;
  const lines = [
    `Canvas: ${layout.canvasWidth}x${layout.canvasHeight}, bg=${bg.type === "solid" ? bg.value : bg.type}`,
    `Components (${layout.components.length}):`,
  ];
  for (const c of layout.components) {
    const s = c.style;
    const styleParts: string[] = [];
    if (s.fill) styleParts.push(`fill:${s.fill}`);
    if (s.color) styleParts.push(`color:${s.color}`);
    if (s.fontSize) styleParts.push(`${s.fontSize}px`);
    if (s.fontWeight) styleParts.push(`w${s.fontWeight}`);
    if (s.borderRadius) styleParts.push(`r${s.borderRadius}`);
    if (s.gradient) styleParts.push("gradient");
    if (s.shadow) styleParts.push("shadow");
    if (s.shadows && s.shadows.length > 0) styleParts.push(`shadows(${s.shadows.length})`);
    if (s.textTransform) styleParts.push(`text:${s.textTransform}`);
    const styleStr = styleParts.length > 0 ? ` [${styleParts.join(", ")}]` : "";
    const content = c.content ? ` "${c.content.slice(0, 40)}"` : "";
    lines.push(
      `  ${c.id} (${c.type}) ${c.position.x},${c.position.y} ${c.size.width}x${c.size.height} z${c.zIndex}${styleStr}${content}`
    );
  }
  return lines.join("\n");
}

export function buildEditPrompt(
  currentLayout: LayoutSpec,
  editRequest: string,
  options: EditPromptOptions
): string {
  const layoutSummary = serializeLayout(currentLayout);

  return `You are a UI design editor. The user has an existing layout and wants to make changes.

Current layout:
${layoutSummary}

Style preset: ${options.style}
Palette: primary=${options.palette.primary} secondary=${options.palette.secondary} accent=${options.palette.accent} bg=${options.palette.background} text=${options.palette.text}
Canvas: ${options.dimensions.width}x${options.dimensions.height}

User's edit request: "${editRequest}"

Decide whether this is a targeted EDIT (modify specific components) or a full REGENERATE (redesign from scratch).

Choose "edit" mode when:
- Changing specific properties (color, size, position, text)
- Adding or removing individual components
- Reordering layers
- Small to medium adjustments

Choose "regenerate" mode when:
- Complete theme/style change ("make it dark", "redesign as luxury")
- Major structural overhaul ("rearrange everything", "completely different layout")
- The request affects most or all components

Respond with ONLY valid JSON in one of these two formats:

Edit mode:
{
  "mode": "edit",
  "reasoning": "Brief explanation of what you changed and why",
  "operations": [
    { "action": "modify", "componentId": "existing-id", "changes": { "style": { "fontSize": 48 }, "content": "New text" } },
    { "action": "add", "component": { "id": "new-id", "type": "text", "position": { "x": 0, "y": 0 }, "size": { "width": 200, "height": 40 }, "rotation": 0, "zIndex": 10, "style": { "color": "#000" }, "content": "New component" } },
    { "action": "remove", "componentId": "id-to-remove" },
    { "action": "reorder", "componentId": "id", "newZIndex": 5 }
  ]
}

Regenerate mode:
{
  "mode": "regenerate",
  "reasoning": "Brief explanation of the redesign approach",
  "layout": { ...full LayoutSpec JSON matching the schema... }
}

For "modify" operations, only include the fields that change — do not repeat unchanged fields.
For "add" operations, every component MUST have: id, type, position, size, rotation, zIndex, style.
Component IDs are kebab-case. Available types: text, shape, icon, image-placeholder, button, card, container, avatar, badge, divider, input-field.
Style fields (all optional): fill, stroke, strokeWidth, borderRadius, opacity, fontFamily, fontSize, fontWeight, textAlign, color, letterSpacing, lineHeight, gradient, shadow, shadows (array of {x,y,blur,color} for multi-layer depth), textTransform ("uppercase"|"lowercase"|"capitalize"|"none").

IMPORTANT: Respond with ONLY valid JSON. No markdown fences. No comments.`;
}
