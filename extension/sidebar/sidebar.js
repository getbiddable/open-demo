// sidebar.js — open-demo live preview sidebar

const stepsList    = document.getElementById('stepsList');
const emptyState   = document.getElementById('emptyState');
const statusDot    = document.getElementById('statusDot');
const statusLabel  = document.getElementById('statusLabel');
const stepCounter  = document.getElementById('stepCounter');
const openEditorBtn = document.getElementById('openEditorBtn');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getBadgeClass(action) {
  const map = {
    click:    'badge-click',
    input:    'badge-input',
    scroll:   'badge-scroll',
    navigate: 'badge-navigate',
  };
  return map[action] || 'badge-click';
}

function createStepCard(step, index) {
  const card = document.createElement('div');
  card.className = 'step-card';
  card.dataset.stepId = step.id;

  // Thumbnail
  if (step.screenshot) {
    const img = document.createElement('img');
    img.className = 'step-thumbnail';
    img.src = step.screenshot;
    img.alt = `Step ${index + 1} screenshot`;
    img.loading = 'lazy';
    card.appendChild(img);
  } else {
    const placeholder = document.createElement('div');
    placeholder.className = 'step-thumbnail-placeholder';
    placeholder.textContent = '📷';
    card.appendChild(placeholder);
  }

  // Info
  const info = document.createElement('div');
  info.className = 'step-info';

  // Meta row
  const meta = document.createElement('div');
  meta.className = 'step-meta';

  const stepNum = document.createElement('span');
  stepNum.className = 'step-num';
  stepNum.textContent = `#${index + 1}`;

  const badge = document.createElement('span');
  badge.className = `action-badge ${getBadgeClass(step.action)}`;
  badge.textContent = step.action;

  meta.appendChild(stepNum);
  meta.appendChild(badge);

  // Description
  const desc = document.createElement('p');
  desc.className = 'step-description';
  desc.textContent = step.description || '(no description)';

  info.appendChild(meta);
  info.appendChild(desc);
  card.appendChild(info);

  return card;
}

function renderSteps(steps) {
  // Remove all existing step cards (keep emptyState)
  Array.from(stepsList.children).forEach((child) => {
    if (child !== emptyState) child.remove();
  });

  if (!steps || steps.length === 0) {
    emptyState.style.display = 'flex';
    stepCounter.textContent = '';
    return;
  }

  emptyState.style.display = 'none';
  steps.forEach((step, i) => {
    stepsList.appendChild(createStepCard(step, i));
  });

  // Auto-scroll to bottom to show latest step
  stepsList.scrollTop = stepsList.scrollHeight;

  const n = steps.length;
  stepCounter.textContent = `${n} step${n === 1 ? '' : 's'}`;
}

function updateStatus(isRecording) {
  if (isRecording) {
    statusDot.classList.add('recording');
    statusLabel.classList.add('recording');
    statusLabel.textContent = 'Recording…';
  } else {
    statusDot.classList.remove('recording');
    statusLabel.classList.remove('recording');
    statusLabel.textContent = 'Not recording';
  }
}

// ─── Load initial state ───────────────────────────────────────────────────────

function loadState() {
  chrome.storage.local.get(['guide_steps', 'recording'], (result) => {
    renderSteps(result.guide_steps || []);
    updateStatus(!!result.recording);
  });
}

// ─── Listen for real-time updates ────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'STEPS_UPDATED') {
    renderSteps(message.steps || []);
  } else if (message.type === 'START_RECORDING') {
    updateStatus(true);
  } else if (message.type === 'STOP_RECORDING') {
    updateStatus(false);
  }
});

// ─── Open editor button ───────────────────────────────────────────────────────

openEditorBtn.addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'OPEN_EDITOR' });
});

// ─── Init ─────────────────────────────────────────────────────────────────────

loadState();
