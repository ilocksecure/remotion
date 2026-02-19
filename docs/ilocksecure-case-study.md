# iLockSecure Case Study: Building an Explainer Video with Remotion

A walkthrough of how we built a 30-second animated explainer video for iLockSecure, including research challenges, brand discovery, and iterative design.

---

## The Brief

Create an explainer video for ilocksecure.com that captures the company's branding, colors, and messaging.

---

## Research Phase: Challenges

### Problem: JS-Rendered Website
The iLockSecure website is heavily JavaScript-rendered (likely a React/Next.js SPA). Standard web scraping tools returned only:
- A `<title>` tag: "Sell Luxury Watches for Highest Cash Prices | iLockSecure"
- A Google Analytics tracking ID
- No CSS, no rendered content, no colors, no images

**Tools tried (that failed):**
- `WebFetch` (got minimal HTML shell — just `<title>` tag + analytics script)
- `WebSearch` (site not indexed by Google — `site:ilocksecure.com` returned 0 results)
- App Store search (found the iLockSecure iOS app but no visual branding info)

### Lesson: Use Playwright MCP to Browse JS-Heavy Sites

For client-side rendered websites, **always use the Playwright MCP server or browser tools first** to actually visit the site and take screenshots. Static fetching tools (`WebFetch`, `WebSearch`) only get the HTML shell of SPAs.

**The correct approach:**

```
1. Use Playwright MCP to navigate to the URL:
   → browser_navigate({ url: "https://ilocksecure.com" })

2. Wait for the page to fully render:
   → browser_wait_for({ time: 3 })

3. Take a screenshot to see the actual UI:
   → browser_take_screenshot({ type: "png", fullPage: true })

4. Take an accessibility snapshot to read all text content:
   → browser_snapshot()

5. Scroll down and take more screenshots to capture below-the-fold content:
   → browser_evaluate({ function: "() => window.scrollTo(0, 800)" })
   → browser_take_screenshot({ type: "png" })

6. Extract computed styles (colors, fonts) directly from the DOM:
   → browser_evaluate({ function: "() => getComputedStyle(document.querySelector('.cta-button')).backgroundColor" })
```

**Why this matters:**
- You see the **real rendered UI** — colors, layout, images, typography
- You can **extract actual CSS values** (hex colors, font families, sizes) from computed styles
- You can **read all text content** that's dynamically rendered by JavaScript
- You can **scroll through the full page** to capture every section
- You get the **actual user experience** — not just the HTML skeleton

**If Playwright MCP is not connected,** ask the user to provide screenshots of key pages. Five screenshots from the user are worth more than ten failed web fetches.

---

## First Attempt: Assumed Branding (The Wrong Way)

Without using Playwright to actually see the website, we built the video based on assumptions from the `<title>` tag alone:

| Assumption | Reality |
|-----------|---------|
| Dark navy/midnight blue palette | Light sky blue (#A8D8EA) |
| Gold accent for luxury | Teal/mint green (#4ECDC4) |
| "Sell Luxury Watches for Top Cash" | "Sell your watch today, Buy it back tomorrow" |
| Standard buy/sell platform | Unique buy-back program + vault storage |
| Generic security messaging | TransGuard partnership + NFT ownership |

The video looked polished but was completely wrong for the brand.

---

## Brand Discovery: Real Identity

The user provided screenshots from the actual website, revealing:

### Visual Identity
- **Primary background:** Light sky blue `#A8D8EA`
- **Accent color:** Teal/mint `#4ECDC4` (buttons, highlights, key words)
- **Text:** Dark charcoal on light backgrounds, white on dark/image backgrounds
- **Logo:** Teal cube with lock icon + "iLock" in dark, "SECURE" small underneath
- **Style:** Clean, airy, aspirational lifestyle (yacht imagery, "Live Better")
- **CTA buttons:** Rounded pill shape in teal green

### Core Messaging
The BIG differentiator we missed: **selling doesn't have to be permanent**.

**Hero tagline:**
> "Sell your watch today / Buy it back tomorrow / Live Better"

### Four Service Pillars
1. **Get Immediate Cash** — Cash or Bank Transfer
2. **Get Highest Market Price** — Through global dealer network
3. **Buy Your Watch Back** — Lock in a future buy-back price at low rates
4. **Bank-Vault Storage** — Secured, Insured & Tamper Proof

### Key Features We Missed
- **Global dealer network** with world map showing dealer locations
- **TransGuard partnership** — bank-vault custody for watches
- **NFT-verified ownership** — blockchain-based proof on the user's behalf
- **Watch Buy Back program** — the core value proposition

---

## The Rebuild

### Updated Theme (`theme.ts`)
```ts
// FROM (wrong):
primaryDark: "#0A1628"    // Dark navy
accentGold: "#C9A84C"     // Gold

// TO (correct):
skyBlue: "#A8D8EA"         // Light blue backgrounds
teal: "#4ECDC4"            // Teal accents/buttons
charcoal: "#2D3748"        // Dark text
```

### Updated Scene Flow (7 scenes, 30 seconds)

| # | Scene | Duration | Content |
|---|-------|----------|---------|
| 1 | Hero Intro | 4.5s | Teal lock logo → "iLock SECURE" → "Sell today / Buy back tomorrow" → *Live Better* → "Get An Offer" |
| 2 | The Hook | 4.5s | *"What if selling your watch didn't have to be permanent?"* on sky blue |
| 3 | Four Pillars | 5s | 4 animated cards: Cash, Market Price, Buy Back, Vault Storage |
| 4 | Global Network | 5s | "Highest Prices" pill → heading + dot-pattern world map with animated red pins |
| 5 | Watch Buy-Back | 5s | Gold coins illustration + "Selling your watch doesn't have to be permanent" |
| 6 | TransGuard Vault | 5s | Vault door illustration with rotating spokes + NFT verification badge |
| 7 | CTA Finale | 5s | Brand names on dark bg → tagline → "Get Quote Today" → ilocksecure.com |

### Technical Implementation
- **All illustrations built with inline SVG** — no external images needed
- **Spring animations** for every entrance (`damping: 200` for smooth, `damping: 12` for bouncy)
- **`<TransitionSeries>`** with `fade()` and `slide()` transitions between scenes
- **Staggered card entrances** using incremental `delay` on springs
- **Floating effects** using `Math.sin(frame * speed) * amplitude`
- **SVG dash animation** for vault door spokes rotating
- **World map** built with a dot grid + conditional continent masking + animated pin drops

---

## Lessons Learned

### 1. Use Playwright MCP First for Brand Research
**This is the #1 lesson.** Before doing anything else, use Playwright MCP (or browser automation) to visit the target website and take full-page screenshots. This gives you:
- Actual rendered colors, fonts, and layout
- All dynamically loaded text and images
- The real user experience (not just an HTML skeleton)
- Ability to extract computed CSS values directly from the DOM

If Playwright MCP isn't connected, immediately ask the user for screenshots. Don't attempt to build anything from `WebFetch`/`WebSearch` alone for JS-rendered sites — you'll get it wrong.

### 2. Always Get Real Brand Assets
Screenshots > assumptions. A JS-rendered site that can't be scraped means you MUST get visual references from the client. Five screenshots were worth more than 10 web fetches.

### 3. The Core Value Prop Matters Most
We initially built a generic "sell watches for cash" video. The REAL story was "sell today, buy back tomorrow" — a completely different emotional message. Getting the value prop wrong means the whole video misses the mark.

### 4. SVG Illustrations Scale Well
Building visuals with inline SVG meant:
- Zero external dependencies or image files
- Infinitely scalable at any resolution
- Every element is animatable via `useCurrentFrame()`
- No CORS issues or loading delays

### 5. Iterative Design is the Way
First attempt → wrong colors, wrong message, wrong features. Second attempt (with screenshots) → accurate brand, correct messaging, proper feature set. Budget time for at least one iteration.

### 6. Remotion's TransitionSeries is Powerful
The math for overlapping transitions (`total = sum_of_scenes - sum_of_transitions`) requires careful tracking, but the visual results are professional-grade with minimal code.

---

## Project Location

```
C:\GitHub\ilocksecure-explainer\
├── src/
│   ├── theme.ts                    # Brand colors and fonts
│   ├── Root.tsx                    # Composition definition
│   ├── ILockSecureExplainer.tsx    # Main composition with TransitionSeries
│   └── components/
│       ├── Scene1Intro.tsx         # Hero with logo + tagline
│       ├── Scene2Problem.tsx       # "What if..." hook
│       ├── Scene3Solution.tsx      # Four service pillars
│       ├── Scene4HowItWorks.tsx    # Global dealer network + map
│       ├── Scene5Features.tsx      # Watch buy-back
│       ├── Scene6Brands.tsx        # TransGuard vault + NFT
│       └── Scene7CTA.tsx           # Brands + final CTA
├── remotion.config.ts
└── package.json
```

### Commands
```bash
npm start              # Open Remotion Studio (preview)
npm run build          # Render to out/video.mp4
npx tsc --noEmit       # Type check
```
