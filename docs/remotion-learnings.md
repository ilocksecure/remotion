# Remotion Learnings

Everything we learned from the `remotion-best-practices` skill and building the iLockSecure explainer video.

---

## Installing the Remotion Skill

The Remotion best-practices skill gives Claude Code domain-specific knowledge for building videos with Remotion. Install it with:

```bash
npx skills add remotion-dev/skills
```

This installs the `remotion-best-practices` skill into `.agents/skills/remotion-best-practices/` (or `.claude/skills/`), which contains 36+ rule files covering:

- Animations, timing, springs, easing
- Compositions, sequencing, transitions
- Assets (images, video, audio, fonts, GIFs)
- Text animations, captions, subtitles
- 3D content, charts, audio visualization
- Voiceover (ElevenLabs TTS integration)
- Maps (Mapbox), light leaks, Lottie
- Tailwind usage rules
- And more

Once installed, Claude Code automatically loads these rules when working with Remotion code, ensuring it follows correct patterns (e.g., never using CSS animations, always driving motion from `useCurrentFrame()`).

### Verifying Installation

Check that the skill files exist:
```bash
ls .agents/skills/remotion-best-practices/rules/
# Should show: animations.md, timing.md, compositions.md, transitions.md, etc.
```

Or check for the symlink in `.claude/skills/`:
```bash
ls .claude/skills/
```

---

## The Golden Rule

> **Every visual change MUST be a pure function of the frame number.**

All animation flows from `useCurrentFrame()` → `interpolate()` or `spring()` → style props. No exceptions.

---

## FORBIDDEN Patterns

| Pattern | Why |
|---------|-----|
| CSS `transition-*` properties | Won't render correctly in video output |
| CSS `animation-*` / `@keyframes` | Same — not frame-synchronized |
| Tailwind `animate-*` classes | Same — uses CSS animations under the hood |
| Tailwind `transition-*` classes | Same — uses CSS transitions |
| `useFrame()` from React Three Fiber | Causes flickering — not synced with Remotion's frame clock |
| Third-party animation libraries running on their own clock | Will desync from video frames |

---

## Core Animation API

### `useCurrentFrame()` — The Source of Truth
```tsx
const frame = useCurrentFrame();
const { fps } = useVideoConfig();
```
Every animation reads `frame` and computes a value from it.

### `interpolate()` — Linear Mapping
```tsx
// Map frame 0-100 to opacity 0-1
const opacity = interpolate(frame, [0, 100], [0, 1], {
  extrapolateRight: "clamp",
  extrapolateLeft: "clamp",
});
```
Always clamp to prevent values from overshooting the target range.

### `spring()` — Physics-Based Motion
```tsx
const scale = spring({
  frame,
  fps,
  delay: 15,                    // Frames to wait before starting
  durationInFrames: 40,         // Optional: stretch to specific duration
  config: { damping: 200 },     // Physics properties
});
// Returns 0 → 1 with natural motion
```

**Common spring configs:**
| Name | Config | Use Case |
|------|--------|----------|
| Smooth | `{ damping: 200 }` | Subtle reveals, no bounce |
| Snappy | `{ damping: 20, stiffness: 200 }` | UI element entrances |
| Bouncy | `{ damping: 8 }` | Playful, attention-grabbing |
| Heavy | `{ damping: 15, stiffness: 80, mass: 2 }` | Slow, weighty feel |

### Combining spring + interpolate
```tsx
const springProgress = spring({ frame, fps });
const rotation = interpolate(springProgress, [0, 1], [0, 360]);
// <div style={{ rotate: rotation + "deg" }} />
```

### Easing (alternative to spring)
```tsx
import { Easing } from "remotion";

const value = interpolate(frame, [0, 100], [0, 1], {
  easing: Easing.inOut(Easing.quad),
  extrapolateLeft: "clamp",
  extrapolateRight: "clamp",
});
```
Curves: `quad`, `sin`, `exp`, `circle`. Directions: `in`, `out`, `inOut`.

---

## Composition Structure

### `<Composition>` — Define a Renderable Video
```tsx
// In Root.tsx
<Composition
  id="MyVideo"
  component={MyComponent}
  durationInFrames={900}
  fps={30}
  width={1920}
  height={1080}
/>
```

### `<Sequence>` — Delay & Duration Control
```tsx
const { fps } = useVideoConfig();

<Sequence from={1 * fps} durationInFrames={3 * fps} premountFor={1 * fps}>
  <MyScene />
</Sequence>
```
**Always use `premountFor`** — preloads the component before it appears.

Inside a Sequence, `useCurrentFrame()` returns the **local** frame (starts at 0), not the global frame.

### `<Series>` — Back-to-Back Scenes
```tsx
<Series>
  <Series.Sequence durationInFrames={90}><Intro /></Series.Sequence>
  <Series.Sequence durationInFrames={120}><Main /></Series.Sequence>
  <Series.Sequence durationInFrames={60}><Outro /></Series.Sequence>
</Series>
```

### `<TransitionSeries>` — Scenes with Transitions
```tsx
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";

<TransitionSeries>
  <TransitionSeries.Sequence durationInFrames={120}>
    <SceneA />
  </TransitionSeries.Sequence>
  <TransitionSeries.Transition
    presentation={fade()}
    timing={linearTiming({ durationInFrames: 20 })}
  />
  <TransitionSeries.Sequence durationInFrames={120}>
    <SceneB />
  </TransitionSeries.Sequence>
</TransitionSeries>
```

**Duration math:** Transitions overlap scenes, so total = sum of scenes - sum of transitions.
`(120 + 120) - 20 = 220 frames`

**Available transitions:** `fade()`, `slide({ direction })`, `wipe()`, `flip()`, `clockWipe()`
**Slide directions:** `"from-left"`, `"from-right"`, `"from-top"`, `"from-bottom"`

---

## Assets & Media

### Static Files
```tsx
import { staticFile } from "remotion";

// Files MUST be in the public/ folder
const imageUrl = staticFile("images/photo.png");
```

### Images — Use `<Img>`, NEVER `<img>`
```tsx
import { Img } from "remotion";

<Img src={staticFile("photo.png")} style={{ objectFit: "cover" }} />
```
`<Img>` prevents flickering and blank frames during render.

### Audio
```tsx
import { Audio } from "@remotion/media";

<Audio
  src={staticFile("voiceover.mp3")}
  volume={0.8}
  trimBefore={15}        // Trim start (frames)
  trimAfter={30}         // Trim end (frames)
/>
```

### Video
```tsx
import { Video } from "@remotion/media";

<Video
  src={staticFile("clip.mp4")}
  playbackRate={1.5}
  loop
/>
```

---

## Fonts

### Google Fonts (Recommended)
```tsx
import { loadFont } from "@remotion/google-fonts/Montserrat";

const { fontFamily } = loadFont("normal", {
  weights: ["400", "700", "800"],
  subsets: ["latin"],
});

// Use: style={{ fontFamily }}
```

### Local Fonts
```tsx
import { loadFont } from "@remotion/fonts";
import { staticFile } from "remotion";

await loadFont({
  family: "MyFont",
  url: staticFile("MyFont-Regular.woff2"),
  weight: "400",
});
```

---

## Dynamic Duration with `calculateMetadata`

Automatically size a composition based on data (e.g., audio durations):

```tsx
import { CalculateMetadataFunction } from "remotion";

const calculateMetadata: CalculateMetadataFunction<Props> = async ({ props }) => {
  const duration = await getAudioDuration(staticFile("voiceover.mp3"));
  return {
    durationInFrames: Math.ceil(duration * 30),
    props: { ...props, audioDuration: duration },
  };
};

// In Root.tsx:
<Composition
  calculateMetadata={calculateMetadata}
  durationInFrames={100} // Placeholder, overridden
/>
```

---

## Text Animations

- **Typewriter effect:** Use string slicing (`text.slice(0, charCount)`), NEVER per-character opacity
- **Measure text:** `measureText()`, `fitText()`, `fillTextBox()` — always load fonts first
- **Word highlighting:** Use token-level timing from captions data

---

## Advanced Features (Available in Skill)

| Feature | Package | Key Insight |
|---------|---------|-------------|
| 3D content | `@remotion/three` | Wrap in `<ThreeCanvas>`, never use `useFrame()` |
| Charts | SVG/D3.js | Disable all library animations, drive from `useCurrentFrame()` |
| Audio visualization | `@remotion/media-utils` | `visualizeAudio()` returns frequency data 0-1 |
| Captions/Subtitles | `@remotion/captions` | Whisper.cpp for transcription, `createTikTokStyleCaptions()` |
| Voiceover | ElevenLabs or Gemini TTS | Generate MP3/WAV → `calculateMetadata` for duration |
| Maps | mapbox-gl | Render with `--gl=angle --concurrency=1` |
| Light leaks | `@remotion/light-leaks` | Use in `<TransitionSeries.Overlay>` |
| Transparent video | ProRes 4444 / VP9 | Special codec flags needed |
| GIFs | `@remotion/gif` | `<AnimatedImage>` syncs with timeline |
| Lottie | react-lottie | Load JSON with `delayRender`/`continueRender` |

---

## Common Patterns We Used

### Staggered entrance (cards appearing one by one)
```tsx
const cards = items.map((item, i) => {
  const progress = spring({ frame, fps, delay: 10 + i * 8, config: { damping: 15 } });
  const scale = interpolate(progress, [0, 1], [0.7, 1]);
  const opacity = interpolate(progress, [0, 1], [0, 1]);
  return <div style={{ transform: `scale(${scale})`, opacity }}>{item}</div>;
});
```

### Floating/breathing animation
```tsx
const floatY = Math.sin(frame * 0.04) * 6;
// <div style={{ transform: `translateY(${floatY}px)` }} />
```

### In + Out animation
```tsx
const inAnim = spring({ frame, fps });
const outAnim = spring({ frame, fps, delay: durationInFrames - 1 * fps, durationInFrames: 1 * fps });
const scale = inAnim - outAnim;
```

### SVG dash animation (drawing a line/border)
```tsx
const dashOffset = interpolate(frame, [0, 120], [600, 0], { extrapolateRight: "clamp" });
// <rect strokeDasharray="600" strokeDashoffset={dashOffset} />
```
