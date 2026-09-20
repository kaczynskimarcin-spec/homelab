const DESIGN_W = 1586;
const DESIGN_H = 992;

const artboard = document.getElementById('artboard');
const toast = document.getElementById('toast');
const search = document.getElementById('search');
const searchPanel = document.getElementById('searchPanel');
const searchResults = document.getElementById('searchResults');
const aiPrompt = document.getElementById('aiPrompt');
const sendPrompt = document.getElementById('sendPrompt');
const webToggle = document.getElementById('webToggle');
const aiResponse = document.getElementById('aiResponse');
const aiStatus = document.getElementById('aiStatus');
const aiResponseText = document.getElementById('aiResponseText');
const lastUserPrompt = document.getElementById('lastUserPrompt');
const memoryCount = document.getElementById('memoryCount');
const runtimeStatus = document.getElementById('runtimeStatus');
const healthScore = document.getElementById('healthScore');
const statusDb = document.getElementById('statusDb');
const statusMemory = document.getElementById('statusMemory');
const statusOllama = document.getElementById('statusOllama');
const statusSearch = document.getElementById('statusSearch');
const clockDate = document.getElementById('clockDate');
const clockTime = document.getElementById('clockTime');

let toastTimer;
let webEnabled = false;
let verifiedServices = new Set(['api', 'docker']);

function fitArtboard() {
  const scale = Math.min(window.innerWidth / DESIGN_W, window.innerHeight / DESIGN_H);
  artboard.style.transform = `scale(${scale})`;
}

function showToast(message) {
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.add('show');
  toastTimer = setTimeout(() => toast.classList.remove('show'), 1800);
}

function createConversationId() {
  if (crypto.randomUUID) return crypto.randomUUID();

  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, '0'));
  return [
    hex.slice(0, 4).join(''),
    hex.slice(4, 6).join(''),
    hex.slice(6, 8).join(''),
    hex.slice(8, 10).join(''),
    hex.slice(10, 16).join('')
  ].join('-');
}

const conversationId = createConversationId();

function updateHealthScore() {
  healthScore.textContent = `${verifiedServices.size}/6`;
}

function markVerified(name) {
  verifiedServices.add(name);
  updateHealthScore();
}

function updateClock() {
  const now = new Date();
  const date = new Intl.DateTimeFormat('en-GB', {
    weekday: 'short', day: '2-digit', month: 'short', year: 'numeric'
  }).format(now);
  const time = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
  }).format(now);

  clockDate.textContent = date;
  clockTime.textContent = time;
}

async function loadMemoryState() {
  try {
    const response = await fetch('/api/memory');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const memories = await response.json();
    memoryCount.textContent = `${memories.length} ${memories.length === 1 ? 'memory' : 'memories'}`;
    statusDb.textContent = 'Online';
    statusMemory.textContent = 'Online';
    markVerified('db');
    markVerified('memory');
  } catch (error) {
    memoryCount.textContent = 'memory unavailable';
    statusDb.textContent = 'Unknown';
    statusMemory.textContent = 'Unknown';
  }
}

async function submitSearch() {
  const value = search.value.trim();
  if (!value) return;

  searchPanel.hidden = false;
  searchResults.textContent = 'Searching…';

  try {
    const response = await fetch(`/api/search?q=${encodeURIComponent(value)}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    searchResults.textContent = await response.text();
    statusSearch.textContent = 'Online';
    markVerified('search');
  } catch (error) {
    searchResults.textContent = `Search failed: ${error.message}`;
    statusSearch.textContent = 'Error';
  }
}

async function submitPrompt() {
  const value = aiPrompt.value.trim();
  if (!value || sendPrompt.disabled) {
    aiPrompt.focus();
    return;
  }

  const backendMessage = webEnabled ? `web: ${value}` : value;

  aiResponse.hidden = false;
  lastUserPrompt.textContent = value;
  aiResponseText.textContent = 'Thinking…';
  aiStatus.textContent = webEnabled ? 'WEB + LOCAL' : 'LOCAL';
  runtimeStatus.textContent = 'Thinking';
  sendPrompt.disabled = true;

  try {
    const response = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: backendMessage,
        conversationId
      })
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(body || `HTTP ${response.status}`);
    }

    const data = await response.json();
    aiResponseText.textContent = data.response ?? 'No response.';
    aiStatus.textContent = 'READY';
    runtimeStatus.textContent = 'Ready';
    statusOllama.textContent = 'Online';
    markVerified('ollama');
    if (webEnabled) {
      statusSearch.textContent = 'Online';
      markVerified('search');
    }
    aiPrompt.value = '';
  } catch (error) {
    aiResponseText.textContent = `HOME AI error: ${error.message}`;
    aiStatus.textContent = 'ERROR';
    runtimeStatus.textContent = 'Error';
  } finally {
    sendPrompt.disabled = false;
    aiPrompt.focus();
  }
}

window.addEventListener('resize', fitArtboard);
fitArtboard();
updateClock();
setInterval(updateClock, 1000);
loadMemoryState();
updateHealthScore();

document.querySelectorAll('[data-action]').forEach((element) => {
  element.addEventListener('click', () => showToast(element.dataset.action));
});

webToggle.addEventListener('click', () => {
  webEnabled = !webEnabled;
  webToggle.setAttribute('aria-pressed', String(webEnabled));
  showToast(webEnabled ? 'WEB mode enabled' : 'WEB mode disabled');
});

search.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') submitSearch();
  if (event.key === 'Escape') {
    search.value = '';
    search.blur();
    searchPanel.hidden = true;
  }
});

aiPrompt.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') submitPrompt();
  if (event.key === 'Escape') {
    aiPrompt.value = '';
    aiPrompt.blur();
    aiResponse.hidden = true;
  }
});

sendPrompt.addEventListener('click', submitPrompt);

document.addEventListener('keydown', (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault();
    search.focus();
    search.select();
  }
});
