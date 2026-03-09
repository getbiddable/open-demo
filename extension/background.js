// background.js — Service Worker for open-demo
// MV3 compatible: no DOM access, no window object

const STORAGE_KEY_STEPS = 'guide_steps';
const STORAGE_KEY_RECORDING = 'recording';

// ─── State ────────────────────────────────────────────────────────────────────

let isRecording = false;

// Restore state on service worker startup
chrome.storage.local.get([STORAGE_KEY_RECORDING], (result) => {
  isRecording = !!result[STORAGE_KEY_RECORDING];
});

// ─── Template-based description generator ────────────────────────────────────

function buildDescription(action, element, value, url, direction) {
  const label = (element && (element.label || element.tag)) || 'element';

  switch (action) {
    case 'click':
      return `Clicked ${label}`;
    case 'input': {
      const displayValue = value ? `"${value}"` : '(empty)';
      return `Typed ${displayValue} in ${label}`;
    }
    case 'scroll':
      return `Scrolled ${direction || 'down'} on page`;
    case 'navigate':
      return `Navigated to ${url || 'new page'}`;
    default:
      return `Performed ${action} on ${label}`;
  }
}

// ─── Screenshot capture ───────────────────────────────────────────────────────

async function captureScreenshot(tabId) {
  try {
    const tab = await chrome.tabs.get(tabId);
    const windowId = tab.windowId;
    const dataUrl = await chrome.tabs.captureVisibleTab(windowId, {
      format: 'jpeg',
      quality: 60,
    });
    return dataUrl;
  } catch (err) {
    console.warn('[open-demo] Screenshot capture failed:', err);
    return null;
  }
}

// ─── Step storage ─────────────────────────────────────────────────────────────

async function getSteps() {
  const result = await chrome.storage.local.get([STORAGE_KEY_STEPS]);
  return result[STORAGE_KEY_STEPS] || [];
}

async function saveSteps(steps) {
  await chrome.storage.local.set({ [STORAGE_KEY_STEPS]: steps });
}

async function appendStep(step) {
  const steps = await getSteps();
  steps.push(step);
  await saveSteps(steps);
  return steps;
}

// ─── Broadcast to sidebar / any listeners ────────────────────────────────────

function broadcastStepsUpdated(steps) {
  chrome.runtime.sendMessage({ type: 'STEPS_UPDATED', steps }).catch(() => {
    // No listeners open — safe to ignore
  });
}

// ─── Main message handler ─────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const { type } = message;

  if (type === 'START_RECORDING') {
    isRecording = true;
    chrome.storage.local.set({
      [STORAGE_KEY_RECORDING]: true,
      [STORAGE_KEY_STEPS]: [],
    });
    sendResponse({ ok: true });
    return false;
  }

  if (type === 'STOP_RECORDING') {
    isRecording = false;
    chrome.storage.local.set({ [STORAGE_KEY_RECORDING]: false });
    // Open editor in new tab
    chrome.tabs.create({ url: chrome.runtime.getURL('editor/editor.html') });
    sendResponse({ ok: true });
    return false;
  }

  if (type === 'GET_STATE') {
    getSteps().then((steps) => {
      sendResponse({ isRecording, stepCount: steps.length });
    });
    return true; // async
  }

  if (type === 'OPEN_EDITOR') {
    chrome.tabs.create({ url: chrome.runtime.getURL('editor/editor.html') });
    sendResponse({ ok: true });
    return false;
  }

  if (type === 'STEP_EVENT') {
    if (!isRecording) {
      sendResponse({ ok: false, reason: 'not recording' });
      return false;
    }

    const { data } = message;
    const tabId = sender.tab && sender.tab.id;

    // Async: capture screenshot, build step, save
    (async () => {
      const screenshot = tabId ? await captureScreenshot(tabId) : null;

      const description = buildDescription(
        data.action,
        data.element,
        data.value,
        data.url,
        data.direction
      );

      const step = {
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        action: data.action,
        element: data.element || {},
        value: data.value || null,
        url: data.url || null,
        direction: data.direction || null,
        screenshot: screenshot,
        description,
      };

      const steps = await appendStep(step);
      broadcastStepsUpdated(steps);
      sendResponse({ ok: true, stepCount: steps.length });
    })();

    return true; // async response
  }

  return false;
});
