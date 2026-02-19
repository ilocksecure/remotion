# Skill Stacking Pipeline: AI Video Production

## Overview

A multi-skill pipeline that chains AI tools to produce polished explainer videos from a single concept config file.

```
concept.ts ──→ Gemini Image Gen ──→ public/images/
    │
    ├────────→ Gemini TTS ────────→ public/voiceover/
    │
    └────────→ Remotion ──────────→ Final MP4 Video
                  │
                  ├── Loads generated images (<Img>)
                  ├── Plays generated voiceover (<Audio>)
                  ├── Adds text overlays + spring animations
                  └── calculateMetadata sizes video to audio duration
```

**All powered by:** One Google Gemini API key + Remotion (React)

---

## The 4 Steps

### Step 1: Concept (Claude)
Claude brainstorms and writes a scene-by-scene script stored in `src/concept.ts`:

```ts
export type Scene = {
  id: string;
  imagePrompt: string;        // Drives Gemini image generation
  narration: string;           // Drives Gemini TTS
  textOverlay?: string;        // On-screen text (optional)
  textPosition?: "center" | "bottom" | "top";
};

export const concept = {
  title: "My Explainer Video",
  aspectRatio: "16:9",
  voice: "Kore",               // Gemini TTS voice
  scenes: [
    {
      id: "scene-01-hook",
      imagePrompt: "Luxury watch on yacht deck, golden hour...",
      narration: "What if selling your watch didn't have to be permanent?",
      textOverlay: "What if it didn't have to be permanent?",
    },
    // ... more scenes
  ],
};
```

This single file drives the entire pipeline.

### Step 2: Image Generation (Gemini 3 Pro)
- **Model:** `gemini-3-pro-image-preview`
- **Endpoint:** `POST https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent`
- **Input:** `imagePrompt` from concept config
- **Output:** Base64-encoded PNG images
- **Config:** `responseModalities: ["TEXT", "IMAGE"]`, aspect ratio, resolution
- **Result:** PNG files saved to `public/images/{scene.id}.png`

### Step 3: Animation (Remotion)
- Each scene uses `<Img src={staticFile("images/scene-01.png")} />` for AI-generated backgrounds
- `<Audio src={staticFile("voiceover/scene-01.wav")} />` plays narration
- Text overlays animated with `spring()` + `interpolate()` (never CSS animations)
- `<TransitionSeries>` chains scenes with fade/slide transitions
- `calculateMetadata` dynamically sizes composition to match total audio duration
- Ken Burns effect (slow zoom/pan) on images via `useCurrentFrame()`

### Step 4: Voiceover (Gemini TTS)
- **Model:** `gemini-2.5-flash-preview-tts`
- **Endpoint:** `POST https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent`
- **Input:** `narration` text from concept config + voice selection
- **Output:** Base64-encoded PCM audio (24kHz, 16-bit, mono)
- **Post-processing:** Convert PCM → WAV with proper header
- **Result:** WAV files saved to `public/voiceover/{scene.id}.wav`

---

## Project Structure

```
ai-video-pipeline/
├── .env                          # GEMINI_API_KEY=your_key_here
├── package.json
├── tsconfig.json
├── remotion.config.ts
├── src/
│   ├── index.ts                  # registerRoot
│   ├── Root.tsx                  # Composition + calculateMetadata
│   ├── ExplainerVideo.tsx        # Main composition (TransitionSeries)
│   ├── concept.ts                # Scene definitions (USER EDITS THIS)
│   ├── theme.ts                  # Colors, fonts
│   └── components/
│       └── SceneRenderer.tsx     # Generic scene: image bg + text + audio
├── scripts/
│   ├── generate-images.ts        # Gemini image API
│   ├── generate-voiceover.ts     # Gemini TTS API
│   └── generate-all.ts           # Runs both scripts
└── public/
    ├── images/                   # Generated PNGs
    └── voiceover/                # Generated WAVs
```

---

## Usage

```bash
# 1. Configure
cp .env.example .env
# Add your GEMINI_API_KEY

# 2. Edit concept
# Modify src/concept.ts with your scenes

# 3. Generate assets
node --env-file=.env scripts/generate-all.ts

# 4. Preview
npm start
# Opens Remotion Studio at http://localhost:3000

# 5. Render
npm run build
# Output: out/video.mp4
```

---

## Why This Architecture

| Decision | Rationale |
|----------|-----------|
| Single `concept.ts` config | One source of truth for prompts, narration, and overlays |
| Google Gemini for both image + voice | Single API key, consistent quality, no vendor sprawl |
| `calculateMetadata` for duration | Video length automatically matches voiceover — no manual frame counting |
| `<TransitionSeries>` | Professional scene transitions with automatic overlap calculation |
| Base64 decode → local files | Assets in `public/` work offline in Remotion without network calls during render |
| Reusable `SceneRenderer` component | Same component handles any scene — just swap the concept config |
