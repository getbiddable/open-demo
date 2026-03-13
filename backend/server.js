'use strict';

const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const { nanoid } = require('nanoid');

const app  = express();
const PORT = process.env.PORT || 3000;

const pool = new Pool({
  user:     'opendemo',
  host:     'localhost',
  database: 'opendemo',
  password: process.env.DB_PASSWORD,
  port:     5432,
});

app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '50mb' }));

// ── POST /api/guides — store a guide, return its ID ──────────────────────────

app.post('/api/guides', async (req, res) => {
  const { title, steps } = req.body;

  if (!Array.isArray(steps) || steps.length === 0) {
    return res.status(400).json({ error: 'steps must be a non-empty array' });
  }

  const id = nanoid(10);

  try {
    await pool.query(
      'INSERT INTO guides (id, title, steps) VALUES ($1, $2, $3)',
      [id, title || 'Untitled Guide', JSON.stringify(steps)]
    );
    res.json({ id, url: `https://od.salandru.com/g/${id}` });
  } catch (err) {
    console.error('[open-demo] Failed to save guide:', err.message);
    res.status(500).json({ error: 'Failed to save guide' });
  }
});

// ── GET /g/:id — public viewer page ──────────────────────────────────────────

app.get('/g/:id', async (req, res) => {
  const { id } = req.params;

  if (!/^[a-zA-Z0-9_-]{10}$/.test(id)) {
    return res.status(404).send('Not found');
  }

  try {
    const result = await pool.query('SELECT * FROM guides WHERE id = $1', [id]);
    if (result.rows.length === 0) return res.status(404).send('Guide not found');

    const guide = result.rows[0];
    const steps = guide.steps;

    const stepsHtml = steps.map((step, i) => {
      const esc = (s) => String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
      const img = step.screenshot && step.screenshot.startsWith('data:image/')
        ? `<img src="${step.screenshot}" alt="Step ${i + 1}" class="step-img" />`
        : '';
      return `
      <div class="step">
        <div class="step-header">
          <span class="step-num">${i + 1}</span>
          <span class="step-desc">${esc(step.description)}</span>
          <span class="badge badge-${esc(step.action)}">${esc(step.action)}</span>
        </div>
        ${img}
      </div>`;
    }).join('\n');

    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${guide.title.replace(/</g,'&lt;')} — open-demo</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f7f7f7; color: #1a1a1a; padding: 32px 20px; }
    .header { max-width: 800px; margin: 0 auto 32px; }
    .title { font-size: 28px; font-weight: 800; margin-bottom: 4px; }
    .meta { font-size: 13px; color: #666; }
    .steps { max-width: 800px; margin: 0 auto; display: flex; flex-direction: column; gap: 24px; }
    .step { background: #fff; border: 1px solid #e0e0e0; border-radius: 10px; overflow: hidden; }
    .step-header { padding: 14px 16px; display: flex; align-items: center; gap: 10px; border-bottom: 1px solid #f0f0f0; }
    .step-num { width: 28px; height: 28px; border-radius: 50%; background: #1a1a1a; color: #fff; font-size: 12px; font-weight: 800; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .step-desc { flex: 1; font-size: 15px; font-weight: 500; }
    .badge { font-size: 10px; font-weight: 700; text-transform: uppercase; padding: 3px 7px; border-radius: 4px; }
    .badge-click    { background: #ebf4ff; color: #2b6cb0; }
    .badge-input    { background: #f0fff4; color: #276749; }
    .badge-scroll   { background: #fffff0; color: #744210; }
    .badge-navigate { background: #faf5ff; color: #553c9a; }
    .step-img { width: 100%; display: block; }
    .footer { max-width: 800px; margin: 32px auto 0; font-size: 12px; color: #aaa; text-align: center; }
    .footer a { color: #aaa; }
  </style>
</head>
<body>
  <div class="header">
    <h1 class="title">${guide.title.replace(/</g,'&lt;')}</h1>
    <p class="meta">${steps.length} step${steps.length === 1 ? '' : 's'} &middot; Created ${new Date(guide.created_at).toLocaleDateString()}</p>
  </div>
  <div class="steps">${stepsHtml}</div>
  <div class="footer">Made with <a href="https://github.com/getbiddable/open-demo">open-demo</a></div>
</body>
</html>`);
  } catch (err) {
    console.error('[open-demo] Failed to load guide:', err.message);
    res.status(500).send('Server error');
  }
});

// ── Privacy policy ────────────────────────────────────────────────────────────

app.get('/privacy', (_req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Privacy Policy — open-demo</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f7f7f7; color: #1a1a1a; padding: 48px 20px; }
    .wrap { max-width: 720px; margin: 0 auto; }
    h1 { font-size: 28px; font-weight: 800; margin-bottom: 8px; }
    .meta { font-size: 13px; color: #888; margin-bottom: 40px; }
    h2 { font-size: 17px; font-weight: 700; margin: 32px 0 10px; }
    p, li { font-size: 15px; line-height: 1.7; color: #333; }
    ul { padding-left: 20px; margin-top: 8px; }
    li { margin-bottom: 4px; }
    a { color: #1a1a1a; }
    .footer { margin-top: 48px; font-size: 12px; color: #aaa; }
  </style>
</head>
<body>
  <div class="wrap">
    <h1>Privacy Policy</h1>
    <p class="meta">Last updated: March 2026</p>

    <p>open-demo is a free, open-source Chrome extension that helps you create step-by-step guides from your browser interactions. This policy explains what data is collected and how it is used.</p>

    <h2>What data open-demo collects</h2>
    <p>While recording, open-demo captures:</p>
    <ul>
      <li>Screenshots of the browser tab you are recording</li>
      <li>A description of each action (clicks, form inputs, scrolls, page navigations)</li>
      <li>The URL of each page you visit during a recording</li>
      <li>Text you type into form fields (limited to 50 characters per field)</li>
    </ul>

    <h2>Where your data is stored</h2>
    <p>All recorded data is stored locally in your browser using <code>chrome.storage.local</code>. It never leaves your device unless you explicitly click <strong>Share</strong>.</p>
    <p>When you click Share, your guide (including screenshots and step descriptions) is uploaded to <code>od.salandru.com</code> and assigned a unique link. Anyone with that link can view the guide.</p>

    <h2>What we do not collect</h2>
    <ul>
      <li>We do not collect any data passively or in the background</li>
      <li>We do not track your browsing history</li>
      <li>We do not collect personal identifiers (name, email, IP address)</li>
      <li>We do not use analytics or third-party tracking</li>
      <li>Recording only activates when you explicitly press Start Recording</li>
    </ul>

    <h2>Shared guides</h2>
    <p>Guides published via the Share button are stored on our server and accessible to anyone with the link. There is currently no option to delete a published guide. If you need a guide removed, contact us at the email below.</p>

    <h2>Data retention</h2>
    <p>Local data is cleared when you click Clear in the editor or start a new recording. Published guides are retained on our server indefinitely unless a removal is requested.</p>

    <h2>Open source</h2>
    <p>The full source code for both the extension and the backend is available at <a href="https://github.com/getbiddable/open-demo">github.com/getbiddable/open-demo</a>. You can self-host the backend and keep all data on your own infrastructure.</p>

    <h2>Contact</h2>
    <p>Questions or removal requests: <a href="mailto:salandru@gmail.com">salandru@gmail.com</a></p>

    <div class="footer">open-demo &mdash; <a href="https://github.com/getbiddable/open-demo">github.com/getbiddable/open-demo</a></div>
  </div>
</body>
</html>`);
});

// ── Health check ──────────────────────────────────────────────────────────────

app.get('/health', (_req, res) => res.json({ ok: true }));

app.listen(PORT, '127.0.0.1', () => {
  console.log(`[open-demo] Server running on port ${PORT}`);
});
