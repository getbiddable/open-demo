// popup.js — open-demo popup logic

const recordBtn    = document.getElementById('recordBtn');
const editorBtn    = document.getElementById('editorBtn');
const statusDot    = document.getElementById('statusDot');
const statusLabel  = document.getElementById('statusLabel');
const stepCountEl  = document.getElementById('stepCount');
const sidebarLink  = document.getElementById('sidebarLink');

let currentlyRecording = false;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function updateUI(isRecording, stepCount) {
  currentlyRecording = isRecording;

  if (isRecording) {
    statusDot.classList.add('recording');
    statusLabel.classList.add('recording');
    statusLabel.textContent = 'Recording…';
    recordBtn.textContent = 'Stop Recording';
    recordBtn.classList.add('stop');
  } else {
    statusDot.classList.remove('recording');
    statusLabel.classList.remove('recording');
    statusLabel.textContent = 'Idle';
    recordBtn.textContent = 'Start Recording';
    recordBtn.classList.remove('stop');
  }

  const n = stepCount || 0;
  stepCountEl.textContent = `${n} step${n === 1 ? '' : 's'} captured`;
}

function getState() {
  chrome.runtime.sendMessage({ type: 'GET_STATE' }, (response) => {
    if (chrome.runtime.lastError) {
      console.warn('[open-demo popup] getState error:', chrome.runtime.lastError);
      return;
    }
    if (response) {
      updateUI(response.isRecording, response.stepCount);
    }
  });
}

// ─── Button handlers ──────────────────────────────────────────────────────────

recordBtn.addEventListener('click', () => {
  if (currentlyRecording) {
    // Stop recording: notify background, which will open editor
    chrome.runtime.sendMessage({ type: 'STOP_RECORDING' }, (response) => {
      if (chrome.runtime.lastError) return;
      updateUI(false, null);
      window.close();
    });
  } else {
    // Start recording
    chrome.runtime.sendMessage({ type: 'START_RECORDING' }, (response) => {
      if (chrome.runtime.lastError) return;
      updateUI(true, 0);
      window.close();
    });
  }
});

editorBtn.addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'OPEN_EDITOR' });
  window.close();
});

sidebarLink.addEventListener('click', (e) => {
  e.preventDefault();
  // Open the side panel via chrome.sidePanel API (available in MV3)
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0] && chrome.sidePanel) {
      chrome.sidePanel.open({ windowId: tabs[0].windowId }).catch(() => {
        // Fallback: open as tab
        chrome.tabs.create({ url: chrome.runtime.getURL('sidebar/sidebar.html') });
      });
    }
  });
  window.close();
});

// ─── Init ─────────────────────────────────────────────────────────────────────

getState();
