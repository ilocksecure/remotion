# Gemini API Reference for Video Pipeline

Technical integration details for using Google Gemini to generate images and speech for Remotion videos.

---

## Authentication

All Gemini API calls use the same authentication:

```
Header: x-goog-api-key: YOUR_GEMINI_API_KEY
```

Store in `.env`:
```
GEMINI_API_KEY=your_key_here
```

Load with: `node --env-file=.env script.ts`

---

## Image Generation

### Model
- **Speed:** `gemini-2.5-flash-image` (fast, good quality)
- **Quality:** `gemini-3-pro-image-preview` (professional-grade, supports complex design)

### Endpoint
```
POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent
```

### Request Format
```json
{
  "contents": [{
    "parts": [
      { "text": "A luxury Rolex watch on a yacht deck at golden hour, cinematic lighting" }
    ]
  }],
  "generationConfig": {
    "responseModalities": ["TEXT", "IMAGE"],
    "imageConfig": {
      "aspectRatio": "16:9",
      "imageSize": "2K"
    }
  }
}
```

### Response Format
Images return as base64-encoded data within `inline_data` parts:
```json
{
  "candidates": [{
    "content": {
      "parts": [
        {
          "inline_data": {
            "mime_type": "image/png",
            "data": "<BASE64_ENCODED_IMAGE>"
          }
        }
      ]
    }
  }]
}
```

### Supported Aspect Ratios
`"1:1"`, `"2:3"`, `"3:2"`, `"3:4"`, `"4:3"`, `"4:5"`, `"5:4"`, `"9:16"`, `"16:9"`, `"21:9"`

### Supported Resolutions
`"1K"` (default), `"2K"`, `"4K"`

### TypeScript Example
```ts
const response = await fetch(
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent`,
  {
    method: "POST",
    headers: {
      "x-goog-api-key": process.env.GEMINI_API_KEY!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseModalities: ["TEXT", "IMAGE"],
        imageConfig: { aspectRatio: "16:9", imageSize: "2K" },
      },
    }),
  }
);

const data = await response.json();

for (const part of data.candidates[0].content.parts) {
  if (part.inline_data) {
    const buffer = Buffer.from(part.inline_data.data, "base64");
    writeFileSync(`public/images/${sceneId}.png`, buffer);
  }
}
```

---

## Speech Generation (TTS)

### Models
- `gemini-2.5-flash-preview-tts` (fast, good for single/multi-speaker)
- `gemini-2.5-pro-preview-tts` (highest quality)

### Endpoint
```
POST https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent
```

### Request Format (Single Speaker)
```json
{
  "contents": [{
    "parts": [{ "text": "What if selling your watch didn't have to be permanent?" }]
  }],
  "generationConfig": {
    "responseModalities": ["AUDIO"],
    "speechConfig": {
      "voiceConfig": {
        "prebuiltVoiceConfig": {
          "voiceName": "Kore"
        }
      }
    }
  }
}
```

### Response Format
Audio returns as base64-encoded PCM data:
```json
{
  "candidates": [{
    "content": {
      "parts": [{
        "inlineData": {
          "mimeType": "audio/pcm",
          "data": "<BASE64_ENCODED_PCM>"
        }
      }]
    }
  }]
}
```

### Audio Specifications
- **Format:** Raw PCM (signed 16-bit little-endian)
- **Sample rate:** 24,000 Hz
- **Channels:** 1 (mono)
- **Bit depth:** 16-bit

### Converting PCM to WAV
WAV is PCM with a 44-byte header. Write the header manually:

```ts
function pcmToWav(pcmBuffer: Buffer, sampleRate = 24000, channels = 1, bitDepth = 16): Buffer {
  const byteRate = sampleRate * channels * (bitDepth / 8);
  const blockAlign = channels * (bitDepth / 8);
  const dataSize = pcmBuffer.length;
  const header = Buffer.alloc(44);

  header.write("RIFF", 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);          // PCM format chunk size
  header.writeUInt16LE(1, 20);           // Audio format: PCM
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitDepth, 34);
  header.write("data", 36);
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, pcmBuffer]);
}
```

### Available Voices (30 total)

| Voice | Character |
|-------|-----------|
| Kore | Firm, authoritative |
| Puck | Upbeat, energetic |
| Charon | Informative, clear |
| Fenrir | Excitable, dramatic |
| Enceladus | Breathy, calm |
| Algieba | Smooth, warm |
| Leda | Youthful, bright |
| Orus | Firm, measured |
| Aoede | Bright, cheerful |
| Callirrhoe | Easy-going, natural |
| Autonoe | Bright, confident |
| Izar | Deliberate, steady |
| Hesperia | Warm, approachable |
| Erinome | Clear, composed |
| Clio | Bold, dynamic |
| Helios | Bright, warm |
| ... | (14 more available) |

### Language Support
90+ languages. Auto-detected from input text. No language parameter needed.

### TypeScript Example
```ts
const response = await fetch(
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent`,
  {
    method: "POST",
    headers: {
      "x-goog-api-key": process.env.GEMINI_API_KEY!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: narrationText }] }],
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: "Kore" },
          },
        },
      },
    }),
  }
);

const data = await response.json();
const pcmBase64 = data.candidates[0].content.parts[0].inlineData.data;
const pcmBuffer = Buffer.from(pcmBase64, "base64");
const wavBuffer = pcmToWav(pcmBuffer);
writeFileSync(`public/voiceover/${sceneId}.wav`, wavBuffer);
```

---

## Integration with Remotion

### Loading Generated Images
```tsx
import { Img, staticFile } from "remotion";

<Img src={staticFile(`images/${sceneId}.png`)} style={{
  width: "100%",
  height: "100%",
  objectFit: "cover",
}} />
```

### Playing Generated Audio
```tsx
import { Audio } from "@remotion/media";
import { staticFile } from "remotion";

<Audio src={staticFile(`voiceover/${sceneId}.wav`)} />
```

### Dynamic Duration from Audio
```tsx
import { CalculateMetadataFunction, staticFile } from "remotion";
import { getAudioDurationInSeconds } from "@remotion/media-utils";

const calculateMetadata: CalculateMetadataFunction<Props> = async ({ props }) => {
  const durations = await Promise.all(
    props.scenes.map(s =>
      getAudioDurationInSeconds(staticFile(`voiceover/${s.id}.wav`))
    )
  );

  const totalFrames = durations.reduce((sum, d) => sum + Math.ceil(d * 30), 0);

  return {
    durationInFrames: totalFrames,
    props: { ...props, sceneDurations: durations.map(d => Math.ceil(d * 30)) },
  };
};
```
