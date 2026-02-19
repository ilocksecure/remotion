import type { DesignBrief } from "./types";

export function buildDesignPrompt(brief: DesignBrief): string {
  return `You are a senior UI designer. Generate a structured layout specification as JSON.

Required JSON schema:
{
  "id": "string (unique layout id)",
  "canvasWidth": ${brief.dimensions.width},
  "canvasHeight": ${brief.dimensions.height},
  "background": { "type": "solid", "value": "${brief.palette.background}" },
  "components": [
    {
      "id": "string (kebab-case, e.g. header-title)",
      "type": "text|shape|icon|image-placeholder|button|card|container",
      "position": { "x": number, "y": number },
      "size": { "width": number (min 1), "height": number (min 1) },
      "rotation": 0,
      "zIndex": number (0+),
      "style": {
        "fill?": "#hex", "stroke?": "#hex", "strokeWidth?": number,
        "borderRadius?": number, "opacity?": 0-1,
        "fontFamily?": "string", "fontSize?": 8-200, "fontWeight?": 100-900,
        "textAlign?": "left|center|right", "color?": "#hex",
        "shadow?": { "x": number, "y": number, "blur": number, "color": "#hex" }
      },
      "children?": [ ...same component shape ],
      "content?": "string (text content or image description)"
    }
  ],
  "layers": [{ "id": "main", "name": "Main", "visible": true, "locked": false, "componentIds": ["all", "component", "ids"] }]
}

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

Rules:
- All positions are absolute pixel coordinates from top-left origin
- Use the provided color palette — do not invent new colors
- Component IDs must be unique, descriptive kebab-case (e.g. "header-title", "cta-button")
- Font sizes in pixels. Use 24-48 for headings, 14-18 for body text
- image-placeholder components must have a descriptive content field for AI image generation later
- Maximum 50 components. Prefer fewer, well-structured components over many small ones
- Group related elements using "container" type with children array
- Ensure no component extends beyond canvas boundaries (0,0 to ${brief.dimensions.width},${brief.dimensions.height})
- Background should use the palette background color as a solid fill
- Create a realistic, professional layout with proper spacing and hierarchy
- Include a single default layer named "main" that references all component IDs

Style-specific instructions:
${getStyleInstructions(brief.style)}`;
}

function getStyleInstructions(
  style: DesignBrief["style"]
): string {
  switch (style) {
    case "minimal":
      return `- Generous whitespace, clean lines
- Limited color usage — mostly background + text + one accent
- Thin borders or no borders, subtle shadows
- Sans-serif fonts, light font weights`;
    case "corporate":
      return `- Structured grid layout with clear sections
- Professional color usage — primary for headers, secondary for accents
- Cards with subtle shadows for content grouping
- Clear visual hierarchy with distinct heading sizes`;
    case "playful":
      return `- Rounded corners (12-20px border radius)
- Bold accent colors for interactive elements
- Larger font sizes, friendly tone
- Cards and buttons with visible shadows`;
    case "luxury":
      return `- Dark backgrounds with gold/light accent colors
- Ample spacing, elegant typography
- Thin strokes, subtle gradients
- Serif or display fonts for headings`;
    case "tech":
      return `- Dark or neutral backgrounds
- Monospace or geometric sans-serif fonts
- Sharp corners, glowing accents
- Grid-based layouts with data-heavy components`;
  }
}
