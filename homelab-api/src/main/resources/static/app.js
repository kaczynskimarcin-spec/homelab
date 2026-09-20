const toast = document.getElementById('toast');
const search = document.getElementById('search');
const aiPrompt = document.getElementById('aiPrompt');
const sendPrompt = document.getElementById('sendPrompt');
const webToggle = document.getElementById('webToggle');
const aiOrb = document.getElementById('aiOrb');
const aiResponse = document.getElementById('aiResponse');
const aiResponseBody = document.getElementById('aiResponseBody');
const searchResults = document.getElementById('searchResults');
const searchResultsBody = document.getElementById('searchResultsBody');
const eventList = document.getElementById('eventList');

let toastTimer;
let webEnabled = false;
const serviceState = { api: false, postgres: false, ollama: false, searxng: false };

function createConversationId() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0'));
  return [hex.slice(0,4).join(''), hex.slice(4,6).join(''), hex.slice(6,8).join(''), hex.slice(8,10).join(''), hex.slice(10,16).join('')].join('-');
}

const conversationId = createConversationId();

function showToast(message) {
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.add('show');
  toastTimer = setTimeout(() => toast.classList.remove('show'), 1800);
}

function updateClock() {
  const now = new Date();
  const dateFmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Warsaw', weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
  });
  const timeFmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Warsaw', hour: '2-digit', minute: '2-digit', hour12: false
  });
  const hourFmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Warsaw', hour: '2-digit', hour12: false
  });

  document.getElementById('topDate').textContent = dateFmt.format(now);
  document.getElementById('topTime').textContent = timeFmt.format(now);
  const hour = Number(hourFmt.format(now));
  document.getElementById('greeting').textContent = hour < 12 ? 'Good morning.' : hour < 18 ? 'Good afternoon.' : 'Good evening.';
}

function setService(name, online, label) {
  serviceState[name] = online;
  document.querySelectorAll(`[data-service="${name}"]`).forEach((dot) => dot.classList.toggle('live', online));
  const ids = {
    api: ['statusApi', 'serviceApiText'],
    postgres: ['statusPostgres', 'servicePostgresText'],
    ollama: ['statusOllama', 'serviceOllamaText'],
    searxng: ['statusSearxng', 'serviceSearchText']
  }[name] || [];

  ids.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.textContent = label || (online ? 'Running' : 'Standby');
  });

  if (name === 'ollama') {
    document.getElementById('runtimeStatus').textContent = label || (online ? 'Connected' : 'Standby');
  }
  updateHealth();
}

function updateHealth() {
  const total = Object.keys(serviceState).length;
  const online = Object.values(serviceState).filter(Boolean).length;
  const healthRing = document.getElementById('healthRing');
  document.getElementById('healthCount').textContent = `${online}/${total}`;
  document.getElementById('topHealthText').textContent = online === total ? 'All verified systems operational' : `${online} of ${total} systems verified`;
  const degrees = Math.round((online / total) * 360);
  healthRing.style.background = `conic-gradient(var(--green) ${degrees}deg, rgba(66,160,108,.18) ${degrees}deg)`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[char]));
}

const events = [];
function addEvent(text, type = 'success') {
  events.unshift({ text, type, time: Date.now() });
  events.splice(6);
  renderEvents();
}

function timeAgo(ts) {
  const delta = Math.max(0, Date.now() - ts);
  if (delta < 60_000) return 'now';
  if (delta < 3_600_000) return `${Math.floor(delta / 60_000)} min ago`;
  return `${Math.floor(delta / 3_600_000)} h ago`;
}

function renderEvents() {
  if (!events.length) {
    eventList.innerHTML = '<div class="event-row info"><span>now</span><i class="status-dot live"></i><strong>Dashboard session started</strong><b>Info</b></div>';
    return;
  }
  eventList.innerHTML = events.map((event) => `
    <div class="event-row ${event.type}">
      <span>${timeAgo(event.time)}</span>
      <i class="status-dot live"></i>
      <strong>${escapeHtml(event.text)}</strong>
      <b>${event.type === 'success' ? 'Success' : event.type === 'warn' ? 'Warn' : 'Info'}</b>
    </div>
  `).join('');
}

async function loadMemory() {
  try {
    const response = await fetch('/api/memory', { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const memories = await response.json();
    setService('api', true, 'Running');
    setService('postgres', true, 'Running');

    const count = Array.isArray(memories) ? memories.length : 0;
    document.getElementById('memoryCount').textContent = `${count} ${count === 1 ? 'memory' : 'memories'}`;
    if (count) {
      const latest = memories[memories.length - 1];
      document.getElementById('focusCopy').textContent = latest.content;
    }
    addEvent(`Memory API verified · ${count} stored`, 'success');
  } catch (error) {
    setService('api', false, 'Offline');
    setService('postgres', false, 'Unknown');
    document.getElementById('memoryCount').textContent = 'Memory unavailable';
    addEvent('Memory API unavailable', 'warn');
  }
}

function updateTasks() {
  const boxes = [...document.querySelectorAll('#taskList input[type="checkbox"]')];
  const complete = boxes.filter((box) => box.checked).length;
  const total = boxes.length;
  const percent = Math.round((complete / total) * 100);
  document.getElementById('taskSummary').textContent = `${complete} of ${total}`;
  document.getElementById('taskPercent').textContent = `${percent}%`;
  document.getElementById('taskProgress').style.width = `${percent}%`;
  localStorage.setItem('homeTasks', JSON.stringify(boxes.map((box) => box.checked)));
}

function restoreTasks() {
  const boxes = [...document.querySelectorAll('#taskList input[type="checkbox"]')];
  try {
    const saved = JSON.parse(localStorage.getItem('homeTasks'));
    if (Array.isArray(saved) && saved.length === boxes.length) {
      boxes.forEach((box, index) => { box.checked = Boolean(saved[index]); });
    }
  } catch (_) {}
  boxes.forEach((box) => box.addEventListener('change', updateTasks));
  updateTasks();
}

async function submitSearch() {
  const value = search.value.trim();
  if (!value) return;

  searchResultsBody.textContent = 'Searching…';
  searchResults.classList.add('show');

  try {
    const response = await fetch(`/api/search?q=${encodeURIComponent(value)}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const text = await response.text();
    searchResultsBody.textContent = text;
    setService('searxng', true, 'Running');
    addEvent(`Web search completed · ${value}`, 'success');
  } catch (error) {
    searchResultsBody.textContent = `Search unavailable\n${error.message}`;
    setService('searxng', false, 'Unavailable');
    addEvent('SearXNG request failed', 'warn');
  }
}

async function submitPrompt() {
  const raw = aiPrompt.value.trim();
  if (!raw || sendPrompt.disabled) return;

  const outgoing = webEnabled && !/^web:/i.test(raw) ? `web: ${raw}` : raw;
  aiPrompt.value = '';
  sendPrompt.disabled = true;
  aiOrb.classList.add('thinking');
  document.getElementById('runtimeLabel').textContent = 'Thinking';
  document.getElementById('runtimeMetric').textContent = webEnabled ? 'web + local' : 'local';
  aiResponseBody.textContent = 'Thinking…';
  aiResponse.classList.add('show');

  try {
    const response = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: outgoing, conversationId })
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    aiResponseBody.textContent = data.response || 'No response.';
    setService('api', true, 'Running');
    setService('ollama', true, 'Connected');
    if (webEnabled) setService('searxng', true, 'Running');
    addEvent(webEnabled ? 'Home AI answered with web context' : 'Home AI answered locally', 'success');
  } catch (error) {
    aiResponseBody.textContent = `HOME AI unavailable\n${error.message}`;
    setService('ollama', false, 'Unavailable');
    addEvent('Home AI request failed', 'warn');
  } finally {
    sendPrompt.disabled = false;
    aiOrb.classList.remove('thinking');
    document.getElementById('runtimeLabel').textContent = 'Idle';
    document.getElementById('runtimeMetric').textContent = 'local';
  }
}

webToggle.addEventListener('click', () => {
  webEnabled = !webEnabled;
  webToggle.classList.toggle('active', webEnabled);
  webToggle.setAttribute('aria-pressed', String(webEnabled));
  showToast(webEnabled ? 'WEB enabled for next prompts' : 'WEB disabled · local mode');
});

search.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') submitSearch();
  if (event.key === 'Escape') {
    search.value = '';
    search.blur();
    searchResults.classList.remove('show');
  }
});

aiPrompt.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') submitPrompt();
  if (event.key === 'Escape') aiPrompt.blur();
});

sendPrompt.addEventListener('click', submitPrompt);
document.getElementById('closeAnswer').addEventListener('click', () => aiResponse.classList.remove('show'));
document.getElementById('closeSearch').addEventListener('click', () => searchResults.classList.remove('show'));
document.getElementById('clearEvents').addEventListener('click', () => { events.length = 0; renderEvents(); });

document.querySelectorAll('.nav-item').forEach((button) => {
  button.addEventListener('click', () => {
    document.querySelectorAll('.nav-item').forEach((item) => item.classList.remove('active'));
    button.classList.add('active');
    showToast(`${button.dataset.view} module · UI shell ready`);
  });
});

document.querySelectorAll('[data-service-action]').forEach((button) => {
  button.addEventListener('click', () => {
    const key = button.dataset.serviceAction;
    showToast(`${button.querySelector('b').textContent}: ${serviceState[key] ? 'verified online' : 'not verified this session'}`);
  });
});

document.addEventListener('keydown', (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault();
    search.focus();
    search.select();
  }
});

setInterval(updateClock, 15_000);
setInterval(renderEvents, 30_000);
updateClock();
restoreTasks();
renderEvents();
loadMemory();
