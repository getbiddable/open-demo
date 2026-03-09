  open-demo: Free Open-Source Scribe Alternative (Chrome Extension)

  What Scribe Does (core features to replicate)

  1. One-click recording — start/stop capture from extension popup
  2. Auto-captures steps — screenshots + click/action detection on every user interaction
  3. AI-generated text — writes step descriptions automatically
  4. Screenshot annotation — highlights click targets, blurs sensitive areas, adds labels
  5. Guide editor — reorder steps, merge into GIFs, add tips/alerts
  6. Export — PDF, HTML, Markdown
  7. Share via link — embeddable in Notion, Confluence, etc.

  ---
  Architecture

  open-demo/
  ├── extension/               # Chrome Extension (MV3)
  │   ├── manifest.json
  │   ├── background.js        # Service worker — captures screenshots
  │   ├── content.js           # Injected — listens to clicks/inputs/scrolls
  │   ├── popup/               # Start/Stop recording UI
  │   ├── editor/              # Full-page guide editor (new tab)
  │   └── sidebar/             # Chrome Side Panel — live step preview
  ├── backend/                 # Lightweight API at slandru.com
  │   ├── api/share.js         # Store guide JSON + images, return share URL
  │   └── api/view/[id].js     # Public viewer page
  └── shared/
      └── types.ts             # Guide/Step schema

  How Recording Works

  - content.js intercepts click, input, keydown, scroll events → sends event metadata to background
  - background.js receives events → calls chrome.tabs.captureVisibleTab() → stores screenshot + step data
  - Step object: { id, action, element, screenshot (base64), description, timestamp }

  AI Step Descriptions

  - Use Claude API (claude-haiku-4-5 for cost) to auto-write step text from element info + action type
  - Runs locally in background.js — user brings their own API key (stored in chrome.storage.local)
  - Fallback: template-based descriptions ("Clicked [button label]", "Typed in [field name]")

  Editor

  - Runs as a Chrome new tab / side panel
  - Features: reorder (drag & drop), delete, edit text, annotate screenshots (canvas overlay for
  blur/highlight), merge steps → GIF

  Export

  - PDF: jsPDF + html2canvas
  - HTML: self-contained single-file export
  - Markdown: text + embedded base64 images

  Share (via slandru.com)

  - User clicks "Share" → extension POSTs guide JSON to https://slandru.com/api/guides
  - Returns a URL like https://slandru.com/g/abc123
  - Backend: simple Vercel/Next.js serverless functions + free-tier DB (Supabase or PlanetScale)
  - Public viewer page is a clean read-only render of the guide

  ---
  Tech Stack

  ┌───────────────┬───────────────────────────────────────────────────────┐
  │     Layer     │                         Tech                          │
  ├───────────────┼───────────────────────────────────────────────────────┤
  │ Extension     │ Vanilla JS + MV3, no build step needed initially      │
  ├───────────────┼───────────────────────────────────────────────────────┤
  │ Editor UI     │ React (bundled with Vite)                             │
  ├───────────────┼───────────────────────────────────────────────────────┤
  │ AI            │ Claude API (haiku) — user-supplied key                │
  ├───────────────┼───────────────────────────────────────────────────────┤
  │ Export        │ jsPDF, html2canvas                                    │
  ├───────────────┼───────────────────────────────────────────────────────┤
  │ Backend       │ Next.js API routes on Vercel                          │
  ├───────────────┼───────────────────────────────────────────────────────┤
  │ DB            │ Supabase (free tier — stores guide JSON + image URLs) │
  ├───────────────┼───────────────────────────────────────────────────────┤
  │ Image storage │ Supabase Storage                                      │
  ├───────────────┼───────────────────────────────────────────────────────┤
  │ Domain        │ slandru.com                                           │
  └───────────────┴───────────────────────────────────────────────────────┘

  ---
  Build Order

  1. Phase 1 — Recording core (content.js + background.js + popup)
  2. Phase 2 — Guide editor page (view/edit/reorder steps)
  3. Phase 3 — Export (PDF, HTML, Markdown)
  4. Phase 4 — AI descriptions (Claude API integration)
  5. Phase 5 — Share backend on slandru.com