// background.js — Service Worker for open-demo
// MV3 compatible: no DOM access, no window object

const STORAGE_KEY_STEPS = 'guide_steps';
const STORAGE_KEY_RECORDING = 'recording';

// ─── State ────────────────────────────────────────────────────────────────────

// NOTE: Do not cache isRecording in memory — service workers restart and lose state.
// Always read from chrome.storage.local for recording state checks.

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

// ─── Screenshot annotation ────────────────────────────────────────────────────

async function annotateClick(dataUrl, x, y) {
  try {
    const res  = await fetch(dataUrl);
    const blob = await res.blob();
    const bitmap = await createImageBitmap(blob);

    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bitmap, 0, 0);

    const radius = Math.round(bitmap.width * 0.022); // ~2% of width
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, 2 * Math.PI);
    ctx.fillStyle = 'rgba(220, 38, 38, 0.25)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(220, 38, 38, 0.95)';
    ctx.lineWidth = Math.max(2, Math.round(bitmap.width * 0.004));
    ctx.stroke();

    const out = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.7 });
    const buf = await out.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let binary = '';
    for (let i = 0; i < bytes.length; i += 8192) {
      binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
    }
    return 'data:image/jpeg;base64,' + btoa(binary);
  } catch (err) {
    console.warn('[open-demo] Annotation failed:', err.message);
    return dataUrl; // fall back to unannotated screenshot
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

async function broadcastToTabs(message) {
  const tabs = await chrome.tabs.query({ url: ['http://*/*', 'https://*/*'] });
  for (const tab of tabs) {
    chrome.tabs.sendMessage(tab.id, message).catch(() => {
      // Tab may not have content script (e.g. chrome:// pages) — ignore
    });
  }
}

function broadcastStepsUpdated(steps) {
  chrome.runtime.sendMessage({ type: 'STEPS_UPDATED', steps }).catch(() => {
    // No listeners open — safe to ignore
  });
}

// ─── Main message handler ─────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const { type } = message;

  if (type === 'START_RECORDING') {
    (async () => {
      await chrome.storage.local.set({
        [STORAGE_KEY_RECORDING]: true,
        [STORAGE_KEY_STEPS]: [],
      });
      await broadcastToTabs({ type: 'START_RECORDING' });
      sendResponse({ ok: true });
    })().catch((err) => {
      console.error('[open-demo] START_RECORDING error:', err);
      sendResponse({ ok: false });
    });
    return true; // async response
  }

  if (type === 'STOP_RECORDING') {
    (async () => {
      await chrome.storage.local.set({ [STORAGE_KEY_RECORDING]: false });
      await broadcastToTabs({ type: 'STOP_RECORDING' });
      chrome.tabs.create({ url: chrome.runtime.getURL('editor/editor.html') });
      sendResponse({ ok: true });
    })().catch((err) => {
      console.error('[open-demo] STOP_RECORDING error:', err);
      sendResponse({ ok: false });
    });
    return true; // async response
  }

  if (type === 'GET_STATE') {
    (async () => {
      const [steps, { [STORAGE_KEY_RECORDING]: recording }] = await Promise.all([
        getSteps(),
        chrome.storage.local.get([STORAGE_KEY_RECORDING]),
      ]);
      sendResponse({ isRecording: !!recording, stepCount: steps.length });
    })();
    return true; // async
  }

  if (type === 'OPEN_EDITOR') {
    chrome.tabs.create({ url: chrome.runtime.getURL('editor/editor.html') });
    sendResponse({ ok: true });
    return false;
  }

  if (type === 'STEP_EVENT') {
    const { data } = message;
    const tabId = sender.tab && sender.tab.id;

    // Async: check recording state from storage (SW may have restarted),
    // capture screenshot, build step, save.
    (async () => {
      const { [STORAGE_KEY_RECORDING]: recording } = await chrome.storage.local.get([STORAGE_KEY_RECORDING]);
      if (!recording) {
        sendResponse({ ok: false, reason: 'not recording' });
        return;
      }

      let screenshot = tabId ? await captureScreenshot(tabId) : null;
      if (screenshot && data.action === 'click' && data.clickX != null && data.clickY != null) {
        screenshot = await annotateClick(screenshot, data.clickX, data.clickY);
      }

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
        clickX: data.clickX || null,
        clickY: data.clickY || null,
        screenshot: screenshot,
        description,
      };

      const steps = await appendStep(step);
      broadcastStepsUpdated(steps);
      sendResponse({ ok: true, stepCount: steps.length });
    })().catch((err) => {
      console.error('[open-demo] STEP_EVENT error:', err);
      sendResponse({ ok: false, reason: err.message });
    });

    return true; // async response
  }

  return false;
});
