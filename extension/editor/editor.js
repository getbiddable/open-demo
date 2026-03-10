// editor.js — open-demo guide editor (vanilla JS, no framework)

'use strict';

// ─── State ────────────────────────────────────────────────────────────────────

let steps = [];
let selectedStepId = null;
let dragSrcIndex = null;

// ─── DOM refs ─────────────────────────────────────────────────────────────────

const guideTitleInput  = document.getElementById('guideTitleInput');
const stepCountBadge   = document.getElementById('stepCountBadge');
const stepsList        = document.getElementById('stepsList');
const emptyState       = document.getElementById('emptyState');
const previewPlaceholder = document.getElementById('previewPlaceholder');
const previewContent   = document.getElementById('previewContent');
const previewImage     = document.getElementById('previewImage');
const previewHeader    = document.getElementById('previewHeader');
const printContent     = document.getElementById('printContent');

const exportMdBtn   = document.getElementById('exportMdBtn');
const exportHtmlBtn = document.getElementById('exportHtmlBtn');
const exportPdfBtn  = document.getElementById('exportPdfBtn');
const clearAllBtn   = document.getElementById('clearAllBtn');
const refreshBtn    = document.getElementById('refreshBtn');

// ─── Utilities ────────────────────────────────────────────────────────────────

function getBadgeClass(action) {
  const map = {
    click:    'badge-click',
    input:    'badge-input',
    scroll:   'badge-scroll',
    navigate: 'badge-navigate',
  };
  return map[action] || 'badge-click';
}

function downloadFile(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function getTitle() {
  return guideTitleInput.value.trim() || 'Untitled Guide';
}

// ─── Render ───────────────────────────────────────────────────────────────────

function updateStepCountBadge() {
  const n = steps.length;
  stepCountBadge.textContent = `${n} step${n === 1 ? '' : 's'}`;
}

function createStepCard(step, index) {
  const card = document.createElement('div');
  card.className = 'step-card';
  card.dataset.stepId  = step.id;
  card.dataset.index   = index;
  card.draggable       = true;

  if (step.id === selectedStepId) {
    card.classList.add('selected');
  }

  // ── Top row ──
  const top = document.createElement('div');
  top.className = 'step-card-top';

  // Thumbnail
  if (step.screenshot) {
    const img = document.createElement('img');
    img.className = 'step-thumbnail';
    img.src       = step.screenshot;
    img.alt       = `Step ${index + 1}`;
    img.loading   = 'lazy';
    top.appendChild(img);
  } else {
    const ph = document.createElement('div');
    ph.className   = 'step-thumbnail-placeholder';
    ph.textContent = '📷';
    top.appendChild(ph);
  }

  // Info
  const info = document.createElement('div');
  info.className = 'step-top-info';

  // Meta row
  const meta = document.createElement('div');
  meta.className = 'step-meta';

  const dragHandle = document.createElement('span');
  dragHandle.className   = 'drag-handle';
  dragHandle.textContent = '⠿';
  dragHandle.title       = 'Drag to reorder';

  const stepNum = document.createElement('span');
  stepNum.className   = 'step-num';
  stepNum.textContent = `Step ${index + 1}`;

  const badge = document.createElement('span');
  badge.className   = `action-badge ${getBadgeClass(step.action)}`;
  badge.textContent = step.action;

  const deleteBtn = document.createElement('button');
  deleteBtn.className   = 'btn-delete';
  deleteBtn.textContent = '×';
  deleteBtn.title       = 'Delete step';
  deleteBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    deleteStep(step.id);
  });

  meta.appendChild(dragHandle);
  meta.appendChild(stepNum);
  meta.appendChild(badge);
  meta.appendChild(deleteBtn);

  info.appendChild(meta);
  top.appendChild(info);
  card.appendChild(top);

  // ── Description (contenteditable) ──
  const desc = document.createElement('div');
  desc.className       = 'step-description';
  desc.contentEditable = 'true';
  desc.textContent     = step.description || '';
  desc.spellcheck      = true;

  // Prevent card click when editing description
  desc.addEventListener('click', (e) => e.stopPropagation());
  desc.addEventListener('blur', () => {
    const newDesc = desc.textContent.trim();
    step.description = newDesc;
    persistSteps();
  });

  card.appendChild(desc);

  // ── Card click → select & preview ──
  card.addEventListener('click', () => selectStep(step.id));

  // ── Drag & drop ──
  card.addEventListener('dragstart', (e) => {
    dragSrcIndex = index;
    e.dataTransfer.effectAllowed = 'move';
    card.style.opacity = '0.5';
  });

  card.addEventListener('dragend', () => {
    card.style.opacity = '';
    document.querySelectorAll('.step-card.drag-over').forEach((c) =>
      c.classList.remove('drag-over')
    );
  });

  card.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    card.classList.add('drag-over');
  });

  card.addEventListener('dragleave', () => {
    card.classList.remove('drag-over');
  });

  card.addEventListener('drop', (e) => {
    e.preventDefault();
    card.classList.remove('drag-over');
    const destIndex = index;
    if (dragSrcIndex === null || dragSrcIndex === destIndex) return;
    const [moved] = steps.splice(dragSrcIndex, 1);
    steps.splice(destIndex, 0, moved);
    dragSrcIndex = null;
    persistSteps();
    renderSteps();
  });

  return card;
}

function renderSteps() {
  // Remove all step cards (keep emptyState)
  Array.from(stepsList.children).forEach((child) => {
    if (child !== emptyState) child.remove();
  });

  if (steps.length === 0) {
    emptyState.style.display = 'flex';
    updateStepCountBadge();
    return;
  }

  emptyState.style.display = 'none';
  steps.forEach((step, i) => {
    stepsList.appendChild(createStepCard(step, i));
  });

  updateStepCountBadge();
}

function selectStep(stepId) {
  selectedStepId = stepId;

  // Update card selection state
  document.querySelectorAll('.step-card').forEach((card) => {
    if (card.dataset.stepId === stepId) {
      card.classList.add('selected');
    } else {
      card.classList.remove('selected');
    }
  });

  // Update preview panel
  const step = steps.find((s) => s.id === stepId);
  if (!step) return;

  const idx = steps.indexOf(step);

  if (step.screenshot) {
    previewPlaceholder.style.display = 'none';
    previewContent.style.display     = 'flex';
    previewImage.src                  = step.screenshot;
    previewHeader.textContent         = `Step ${idx + 1}: ${step.description || ''}`;
  } else {
    previewPlaceholder.style.display = 'flex';
    previewContent.style.display     = 'none';
  }
}

// ─── Data management ──────────────────────────────────────────────────────────

function loadSteps() {
  chrome.storage.local.get(['guide_steps'], (result) => {
    if (chrome.runtime.lastError) {
      console.warn('[open-demo editor] loadSteps error:', chrome.runtime.lastError.message);
      return;
    }
    steps = result.guide_steps || [];
    renderSteps();
  });
}

function persistSteps() {
  chrome.storage.local.set({ guide_steps: steps });
}

function deleteStep(stepId) {
  const idx = steps.findIndex((s) => s.id === stepId);
  if (idx === -1) return;
  steps.splice(idx, 1);

  if (selectedStepId === stepId) {
    selectedStepId = null;
    previewPlaceholder.style.display = 'flex';
    previewContent.style.display     = 'none';
  }

  persistSteps();
  renderSteps();
}

// ─── Export: Markdown ─────────────────────────────────────────────────────────

function exportMarkdown() {
  const title = getTitle();
  const lines  = [`# ${title}`, '', `*${steps.length} step${steps.length === 1 ? '' : 's'}*`, ''];

  steps.forEach((step, i) => {
    lines.push(`## Step ${i + 1}: ${step.description || '(no description)'}`);
    lines.push('');
    if (step.screenshot) {
      lines.push(`![Step ${i + 1}](${step.screenshot})`);
      lines.push('');
    }
    lines.push(`**Action:** ${step.action}`);
    if (step.element && step.element.label) {
      lines.push(`**Element:** ${step.element.label}`);
    }
    lines.push('');
    lines.push('---');
    lines.push('');
  });

  downloadFile('guide.md', lines.join('\n'), 'text/markdown');
}

// ─── Export: HTML ─────────────────────────────────────────────────────────────

function exportHTML() {
  const title  = getTitle();
  const escapeHtml = (str) =>
    String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const stepCards = steps.map((step, i) => {
    const validScreenshot = step.screenshot && step.screenshot.startsWith('data:image/') ? step.screenshot : null;
    const imgTag = validScreenshot
      ? `<img src="${validScreenshot}" alt="Step ${i + 1}" class="step-img" />`
      : '<div class="step-img-placeholder">No screenshot</div>';

    return `
    <div class="step-card">
      <div class="step-header">
        <span class="step-num">${i + 1}</span>
        <span class="step-desc">${escapeHtml(step.description)}</span>
        <span class="action-badge badge-${escapeHtml(step.action)}">${escapeHtml(step.action)}</span>
      </div>
      ${imgTag}
    </div>`;
  }).join('\n');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f7f7f7;
      color: #1a1a1a;
      padding: 32px 20px;
    }
    .guide-header { max-width: 800px; margin: 0 auto 32px; }
    .guide-title { font-size: 28px; font-weight: 800; margin-bottom: 4px; }
    .guide-meta { font-size: 13px; color: #666; }
    .steps { max-width: 800px; margin: 0 auto; display: flex; flex-direction: column; gap: 24px; }
    .step-card { background: #fff; border: 1px solid #e0e0e0; border-radius: 10px; overflow: hidden; box-shadow: 0 1px 4px rgba(0,0,0,0.06); }
    .step-header { padding: 14px 16px; display: flex; align-items: center; gap: 10px; border-bottom: 1px solid #f0f0f0; }
    .step-num { width: 28px; height: 28px; border-radius: 50%; background: #1a1a1a; color: #fff; font-size: 12px; font-weight: 800; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .step-desc { flex: 1; font-size: 15px; font-weight: 500; }
    .action-badge { font-size: 10px; font-weight: 700; text-transform: uppercase; padding: 3px 7px; border-radius: 4px; letter-spacing: 0.4px; }
    .badge-click    { background: #ebf4ff; color: #2b6cb0; }
    .badge-input    { background: #f0fff4; color: #276749; }
    .badge-scroll   { background: #fffff0; color: #744210; }
    .badge-navigate { background: #faf5ff; color: #553c9a; }
    .step-img { width: 100%; display: block; }
    .step-img-placeholder { padding: 32px; text-align: center; color: #aaa; font-size: 13px; background: #fafafa; }
    @media print {
      body { background: #fff; padding: 0; }
      .step-card { box-shadow: none; page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="guide-header">
    <h1 class="guide-title">${escapeHtml(title)}</h1>
    <p class="guide-meta">${steps.length} step${steps.length === 1 ? '' : 's'} &middot; Generated by open-demo</p>
  </div>
  <div class="steps">
    ${stepCards}
  </div>
</body>
</html>`;

  downloadFile('guide.html', html, 'text/html');
}

// ─── Export: PDF (via window.print) ───────────────────────────────────────────

function exportPDF() {
  const title = getTitle();

  // Build print-only content
  const escapeHtml = (str) =>
    String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

  const stepsHtml = steps.map((step, i) => {
    const validScreenshot = step.screenshot && step.screenshot.startsWith('data:image/') ? step.screenshot : null;
    const imgTag = validScreenshot
      ? `<img class="print-step-img" src="${validScreenshot}" alt="Step ${i + 1}" />`
      : '';
    return `
    <div class="print-step">
      <div class="print-step-header">
        <span class="print-step-num">${i + 1}</span>
        <span>${escapeHtml(step.description)}</span>
      </div>
      <p class="print-step-desc"><strong>Action:</strong> ${escapeHtml(step.action)}${step.element && step.element.label ? ` &mdash; <em>${escapeHtml(step.element.label)}</em>` : ''}</p>
      ${imgTag}
    </div>`;
  }).join('\n');

  printContent.innerHTML = `
    <h1 class="print-guide-title">${escapeHtml(title)}</h1>
    <p class="print-guide-meta">${steps.length} step${steps.length === 1 ? '' : 's'} &middot; Generated by open-demo &middot; ${new Date().toLocaleDateString()}</p>
    ${stepsHtml}
  `;

  window.print();
}

// ─── Event listeners ──────────────────────────────────────────────────────────

exportMdBtn.addEventListener('click', exportMarkdown);
exportHtmlBtn.addEventListener('click', exportHTML);
exportPdfBtn.addEventListener('click', exportPDF);

clearAllBtn.addEventListener('click', () => {
  if (steps.length === 0) return;
  if (!confirm(`Delete all ${steps.length} step${steps.length === 1 ? '' : 's'}? This cannot be undone.`)) return;
  steps = [];
  selectedStepId = null;
  previewPlaceholder.style.display = 'flex';
  previewContent.style.display     = 'none';
  persistSteps();
  renderSteps();
});

refreshBtn && refreshBtn.addEventListener('click', loadSteps);

guideTitleInput.addEventListener('change', () => {
  document.title = `open-demo — ${getTitle()}`;
});

// Listen for real-time step updates from background
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'STEPS_UPDATED') {
    steps = message.steps || [];
    renderSteps();
  }
});

// ─── Init ─────────────────────────────────────────────────────────────────────

loadSteps();
