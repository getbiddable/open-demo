// content.js — Injected into all pages
// Captures user interactions and forwards them to the background service worker.

(function () {
  'use strict';

  // Guard: only inject once
  if (window.__openDemoInjected) return;
  window.__openDemoInjected = true;

  let isActive = false;
  let lastScrollY = window.scrollY;
  let scrollDebounceTimer = null;

  // ─── Helpers ───────────────────────────────────────────────────────────────

  function getElementLabel(el) {
    if (!el) return '';

    // Explicit label via <label for="...">
    if (el.id) {
      const labelEl = document.querySelector(`label[for="${el.id}"]`);
      if (labelEl && labelEl.textContent.trim()) {
        return labelEl.textContent.trim();
      }
    }

    // aria-label
    if (el.getAttribute('aria-label')) {
      return el.getAttribute('aria-label').trim();
    }

    // placeholder
    if (el.placeholder) {
      return el.placeholder.trim();
    }

    // Button / link inner text
    const text = el.textContent ? el.textContent.trim() : '';
    if (text && text.length <= 80) {
      return text;
    }

    // value attribute (for input[type=submit|button])
    if (el.value && typeof el.value === 'string' && el.value.trim()) {
      return el.value.trim();
    }

    // title attribute
    if (el.title) {
      return el.title.trim();
    }

    return el.tagName ? el.tagName.toLowerCase() : 'element';
  }

  function getElementInfo(el) {
    if (!el || el === document || el === window) {
      return { tag: 'page', label: 'page', id: '', classes: '' };
    }
    return {
      tag: el.tagName ? el.tagName.toLowerCase() : 'unknown',
      label: getElementLabel(el),
      id: el.id || '',
      classes: el.className && typeof el.className === 'string'
        ? el.className.trim()
        : '',
    };
  }

  function sendStep(data) {
    if (!isActive) return;
    try {
      chrome.runtime.sendMessage({ type: 'STEP_EVENT', data }).catch((err) => {
        console.debug('[open-demo] sendStep error:', err);
      });
    } catch (err) {
      // Extension was reloaded — context is gone, stop capturing
      deactivate();
    }
  }

  // ─── Event handlers ────────────────────────────────────────────────────────

  function onClickCapture(e) {
    if (!isActive) return;
    const el = e.target;
    // Skip our own injected UI if any
    sendStep({
      action: 'click',
      element: getElementInfo(el),
    });
  }

  function onInputCapture(e) {
    if (!isActive) return;
    const el = e.target;
    const tag = el.tagName ? el.tagName.toLowerCase() : '';
    if (!['input', 'textarea', 'select'].includes(tag)) return;

    const value = (el.value || '').substring(0, 50);
    sendStep({
      action: 'input',
      element: getElementInfo(el),
      value,
    });
  }

  function onKeydownCapture(e) {
    if (!isActive) return;
    if (e.key !== 'Enter' && e.key !== 'Escape') return;
    const el = document.activeElement || e.target;
    sendStep({
      action: 'click',
      element: getElementInfo(el),
    });
  }

  function onScrollCapture() {
    if (!isActive) return;
    clearTimeout(scrollDebounceTimer);
    scrollDebounceTimer = setTimeout(() => {
      const currentScrollY = window.scrollY;
      const direction = currentScrollY >= lastScrollY ? 'down' : 'up';
      lastScrollY = currentScrollY;
      sendStep({
        action: 'scroll',
        direction,
      });
    }, 500);
  }

  function onNavigate() {
    if (!isActive) return;
    sendStep({
      action: 'navigate',
      url: location.href,
    });
  }

  // ─── Activation / deactivation ─────────────────────────────────────────────

  const CAPTURE_OPTS = { capture: true, passive: true };

  function activate() {
    if (isActive) return;
    isActive = true;
    console.log('[open-demo] content.js activated on', location.href);
    lastScrollY = window.scrollY;

    document.addEventListener('click', onClickCapture, CAPTURE_OPTS);
    document.addEventListener('input', onInputCapture, CAPTURE_OPTS);
    document.addEventListener('keydown', onKeydownCapture, CAPTURE_OPTS);
    window.addEventListener('scroll', onScrollCapture, CAPTURE_OPTS);
    window.addEventListener('popstate', onNavigate, CAPTURE_OPTS);
    window.addEventListener('hashchange', onNavigate, CAPTURE_OPTS);
  }

  function deactivate() {
    if (!isActive) return;
    isActive = false;
    clearTimeout(scrollDebounceTimer);

    document.removeEventListener('click', onClickCapture, CAPTURE_OPTS);
    document.removeEventListener('input', onInputCapture, CAPTURE_OPTS);
    document.removeEventListener('keydown', onKeydownCapture, CAPTURE_OPTS);
    window.removeEventListener('scroll', onScrollCapture, CAPTURE_OPTS);
    window.removeEventListener('popstate', onNavigate, CAPTURE_OPTS);
    window.removeEventListener('hashchange', onNavigate, CAPTURE_OPTS);
  }

  // ─── Bootstrap: check current recording state ──────────────────────────────

  chrome.storage.local.get(['recording'], (result) => {
    if (chrome.runtime.lastError) {
      console.warn('[open-demo] Failed to read recording state:', chrome.runtime.lastError.message);
      return;
    }
    if (result.recording) {
      activate();
    }
  });

  // ─── Listen for runtime messages ───────────────────────────────────────────

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === 'START_RECORDING') {
      activate();
      sendResponse({ ok: true });
    } else if (message.type === 'STOP_RECORDING') {
      deactivate();
      sendResponse({ ok: true });
    }
    return false;
  });
})();
