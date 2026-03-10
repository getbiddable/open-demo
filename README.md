# open-demo

A free, open-source alternative to [Scribe](https://scribehow.com/) — a Chrome extension that automatically creates step-by-step guides from your browser interactions.

## Features

- **One-click recording** — start and stop capture from the extension popup
- **Auto-captures steps** — screenshots + click/input/scroll/navigate detection on every interaction
- **Click annotation** — red circle highlights exactly where you clicked in each screenshot
- **Guide editor** — reorder steps via drag and drop, edit descriptions, preview screenshots
- **Export** — PDF (via print), self-contained HTML, or Markdown with embedded images
- **Share** — publish guides as a public link at `od.salandru.com/g/:id`
- **Live sidebar** — Chrome side panel shows a real-time preview as you record

## Getting Started

### Install the extension (developer mode)

1. Clone this repo
2. Go to `chrome://extensions`
3. Enable **Developer mode** (top right)
4. Click **Load unpacked** and select the `extension/` folder

### Record a guide

1. Click the open-demo icon in your toolbar
2. Hit **Start Recording**
3. Interact with any webpage — clicks, inputs, scrolls, and navigation are all captured
4. Hit **Stop Recording** — the editor opens automatically

### Export or share

From the editor toolbar:
- **Export Markdown** — `.md` file with embedded base64 screenshots
- **Export HTML** — self-contained single-file export
- **Export PDF** — opens browser print dialog
- **Share** — publishes to `od.salandru.com` and gives you a shareable link

## Project Structure

```
extension/          Chrome MV3 extension (vanilla JS, no build step)
├── background.js   Service worker — screenshot capture, step storage
├── content.js      Injected into pages — captures user interactions
├── popup/          Start/Stop recording UI
├── editor/         Full-page guide editor + export
└── sidebar/        Chrome Side Panel — live step preview

backend/            Node.js/Express share backend
├── server.js       POST /api/guides, GET /g/:id
└── schema.sql      PostgreSQL schema

shared/
└── types.ts        TypeScript type reference (Step, Guide)
```

## Backend (self-hosting)

The share feature points to `od.salandru.com` by default. To self-host:

1. Provision a server with Node.js and PostgreSQL
2. Run `npm install` in `backend/`
3. Create a Postgres database and run `schema.sql`
4. Set `DB_PASSWORD` in your environment
5. Start with `node server.js`
6. Update the URL in `extension/manifest.json` (`host_permissions`) and `extension/editor/editor.js`

## Tech Stack

| Layer | Tech |
|-------|------|
| Extension | Vanilla JS, Chrome MV3 |
| Screenshot annotation | OffscreenCanvas (service worker) |
| Export | Native browser APIs (Blob, print) |
| Backend | Node.js, Express |
| Database | PostgreSQL |
| Hosting | Google Cloud (e2-micro), Nginx, Let's Encrypt |

## Contributing

Pull requests welcome. Open an issue first for significant changes.

## License

MIT
