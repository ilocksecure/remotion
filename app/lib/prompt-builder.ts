import type { DesignBrief } from "./types";

export function buildDesignPrompt(brief: DesignBrief): string {
  return `You are a senior UI designer creating polished, production-quality layouts. Generate a structured layout specification as JSON.

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
        "shadow?": { "x": number, "y": number, "blur": number, "color": "rgba()" }
      },
      "children?": [ ...same component shape ],
      "content?": "string (text content, initials for avatar, label for badge, placeholder for input-field)"
    }
  ],
  "layers": [{ "id": "main", "name": "Main", "visible": true, "locked": false, "componentIds": ["all", "component", "ids"] }]
}

Component types guide:
- "text": Headings, paragraphs, labels. Use textAlign, letterSpacing for polish.
- "shape": Rectangles, decorative blocks. Supports gradient fills.
- "icon": Circular icon with inner symbol. Set content to "check", "star", "arrow" for specific icons.
- "image-placeholder": Polished placeholder with mountain/sun icon. Set content to descriptive text (e.g. "Hero product shot"). NOT a dashed gray box — renders as a styled card with icon.
- "button": CTA buttons with gradient support and inner highlight. Default fontWeight 600.
- "card": Content cards with automatic shadow and 1px border. Use children array for inner components.
- "container": Invisible grouping wrapper with optional background. Use for sections/rows.
- "avatar": Circle with gradient background + centered initials. Set content to person's name (e.g. "Jane Doe" → "JD").
- "badge": Small pill/tag label. Set content to status text (e.g. "Active", "Pro", "New").
- "divider": Horizontal or vertical separator line. Use stroke color and strokeWidth.
- "input-field": Form input with light background, border, and placeholder text. Set content to placeholder text.

Design brief: ${brief.description}
Industry: ${brief.industry ?? "general"}

Color palette:
  - Primary: ${brief.palette.primary}
  - Secondary: ${brief.palette.secondary}
  - Accent: ${brief.palette.accent}
  - Background: ${brief.palette.background}
  - Text: ${brief.palette.text}

Canvas: ${brief.dimensions.width}x${brief.dimensions.height}
Style: ${brief.style}
Target: ${brief.targetFormat}

Layout rules:
- All positions are absolute pixel coordinates from top-left origin
- Use the provided color palette — do not invent new colors
- Component IDs must be unique, descriptive kebab-case (e.g. "hero-heading", "cta-button", "team-avatar-1")
- Ensure no component extends beyond canvas boundaries (0,0 to ${brief.dimensions.width},${brief.dimensions.height})
- Include a single default layer named "main" that references all top-level component IDs
- Maximum 50 components. Prefer fewer, well-structured components over many small ones

Spacing and layout:
- Use 16/24/32px spacing increments between sections and components
- Cards should have 16px internal padding offset for children (child position = card position + 16)
- Maintain consistent gutters: 16px between cards in a grid, 24-32px between major sections
- Vertical rhythm: keep consistent spacing between stacked elements

Typography hierarchy:
- Page titles: 36-48px, fontWeight 700-800, letterSpacing -0.5 to -1
- Section headings: 24-32px, fontWeight 600-700
- Subheadings: 18-22px, fontWeight 500-600
- Body text: 14-16px, fontWeight 400
- Captions/labels: 11-13px, fontWeight 400-500, letterSpacing 0.5
- Badges: 10-12px, fontWeight 600, letterSpacing 0.5

Shadow depth guidelines:
- Cards: shadow { x: 0, y: 4, blur: 12, color: "rgba(0,0,0,0.08)" }
- Buttons: shadow { x: 0, y: 2, blur: 6, color: "rgba(0,0,0,0.12)" }
- Elevated modals/popups: shadow { x: 0, y: 8, blur: 24, color: "rgba(0,0,0,0.15)" }
- Flat/minimal items: no shadow

Gradient usage:
- Use the "gradient" property on style to create linear gradients instead of flat fills
- Hero sections and primary buttons benefit most from gradients
- Example: { "angle": 135, "stops": [{ "color": "#6366F1", "position": 0 }, { "color": "#8B5CF6", "position": 100 }] }
- Gradients should use colors from the palette (primary→accent, or primary→secondary)
- Don't overuse gradients — 2-3 gradient elements per design maximum

Component composition best practices:
- Cards should contain: image-placeholder at top → title text → description text → optional CTA button
- Team/profile sections should use avatar components with name text beside them
- Form sections should use input-field components with label text above each field
- Use badge components for status indicators, plan labels, and category tags
- Use divider components to separate sections or between list items
- Navigation bars should be a container with text children for menu items

Style-specific instructions:
${getStyleInstructions(brief.style)}

Create a polished, visually rich, professional layout. Use shadows, gradients, and proper spacing to create depth and hierarchy. The output should look like a real product design, not a wireframe.`;
}

function getStyleInstructions(
  style: DesignBrief["style"]
): string {
  switch (style) {
    case "minimal":
      return `- No gradients, no shadows on any components
- 1px borders in #E5E5E5 or rgba(0,0,0,0.08) for cards instead of shadows
- White (#FFFFFF) cards on a #FAFAFA or palette background
- Generous whitespace — at least 32px between sections, 24px between cards
- Sans-serif fonts (Inter), light font weights (300-400 for body, 500-600 for headings)
- Limited color usage: background + text + one accent for CTAs only
- Buttons: flat fill with no shadow, borderRadius 4-6px
- Use divider components between sections with opacity 0.3`;

    case "corporate":
      return `- Subtle shadows on all cards: { x: 0, y: 4, blur: 12, color: "rgba(0,0,0,0.08)" }
- Primary color for section headers and CTA buttons
- Secondary color for secondary buttons and accents
- Use badge components for status indicators (e.g. "Active", "Pending", "Enterprise")
- Include avatar components in team/user sections with names and roles
- Structured grid layout: sidebar + main content, or header + card grid
- borderRadius 8px for cards, 6px for buttons
- Clear visual hierarchy with distinct heading sizes (48px → 24px → 16px)
- Use input-field components for any form sections with label text above`;

    case "playful":
      return `- Use gradients on primary buttons: gradient from primary → accent at 135°
- Larger borderRadius: 16-20px for cards, 12px for buttons, full-round for avatars
- Bold, visible shadows: { x: 0, y: 6, blur: 16, color: "rgba(0,0,0,0.12)" }
- Accent color prominently used for badges, icons, and interactive elements
- Use badge components with accent fill and white text for tags and labels
- Slightly larger font sizes: body at 16px, headings at 36-48px
- Rounded avatar components for any user/team content
- Buttons should feel chunky: 48-56px height, bold text, gradient fills`;

    case "luxury":
      return `- Dark backgrounds: use palette background (expect dark tones like #0A0A0A, #1A1A2E)
- Gold accents: use accent color (expect #D4AF37 or similar gold) for strokes, badges, and highlights
- Gradient fills on hero sections: dark → slightly lighter dark, or dark → gold at low opacity
- Serif fonts for headings: "Playfair Display, Georgia, serif". Sans-serif for body text.
- Thin strokes (1px) in gold/accent on cards and dividers
- Shadows with more opacity: { x: 0, y: 8, blur: 24, color: "rgba(0,0,0,0.25)" }
- Elegant letter-spacing: -1 for large headings, 2-4 for small uppercase labels
- Use divider components with gold stroke between sections
- Ample spacing — 48-64px between sections, 32px between cards
- Image placeholders should feel premium: larger borderRadius 12px, subtle border`;

    case "tech":
      return `- Dark fills for backgrounds and cards: #111827, #1F2937, #0F172A
- Cyan/green accent gradients: gradient from #06B6D4 → #10B981 or #3B82F6 → #8B5CF6
- Sharp corners: borderRadius 0-4px for cards and buttons (not rounded)
- Monospace fonts for data/code elements: "JetBrains Mono, Fira Code, monospace"
- Sans-serif (Inter) for headings and body text
- Use input-field components in form sections with dark fill (#1F2937) and lighter border (#374151)
- Use badge components with accent gradient for plan tiers, status labels
- Cards with subtle border: stroke "#374151", strokeWidth 1
- Shadows with blue/purple tint: { x: 0, y: 4, blur: 16, color: "rgba(59,130,246,0.1)" }
- Glowing accent elements: use opacity and bright accent colors for key highlights
- Grid-based layouts with data tables, stat cards, and metric displays`;
  }
}
