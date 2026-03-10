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
    res.json({ id, url: `https://od.slandru.com/g/${id}` });
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
  <div class="footer">Made with <a href="https://github.com/salandru/open-demo">open-demo</a></div>
</body>
</html>`);
  } catch (err) {
    console.error('[open-demo] Failed to load guide:', err.message);
    res.status(500).send('Server error');
  }
});

// ── Health check ──────────────────────────────────────────────────────────────

app.get('/health', (_req, res) => res.json({ ok: true }));

app.listen(PORT, '127.0.0.1', () => {
  console.log(`[open-demo] Server running on port ${PORT}`);
});
