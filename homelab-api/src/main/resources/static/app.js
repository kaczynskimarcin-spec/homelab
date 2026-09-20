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

const aiPagePrompt = document.getElementById('aiPagePrompt');
const aiPageSend = document.getElementById('aiPageSend');
const aiPageWebToggle = document.getElementById('aiPageWebToggle');
const aiPageMessages = document.getElementById('aiPageMessages');
const aiChatModeLabel = document.getElementById('aiChatModeLabel');
const aiPagePrivacyNote = document.getElementById('aiPagePrivacyNote');

let toastTimer;
let webEnabled = false;
let aiPageWebEnabled = false;
let conversationId = createConversationId();
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
    const runtimeStatus = document.getElementById('runtimeStatus');
    if (runtimeStatus) runtimeStatus.textContent = label || (online ? 'Connected' : 'Standby');
  }
  document.querySelectorAll(`[data-system-service-label="${name}"]`).forEach((el) => {
    el.textContent = label || (online ? 'Running' : 'Standby');
  });
  updateHealth();
  updateSystemWorkspace();
}

function updateHealth() {
  const total = Object.keys(serviceState).length;
  const online = Object.values(serviceState).filter(Boolean).length;
  const healthRing = document.getElementById('healthRing');
  const healthCount = document.getElementById('healthCount');
  if (healthCount) healthCount.textContent = `${online}/${total}`;
  document.getElementById('topHealthText').textContent = online === total ? 'All verified systems operational' : `${online} of ${total} systems verified`;
  if (healthRing) {
    const degrees = Math.round((online / total) * 360);
    healthRing.style.background = `conic-gradient(var(--green) ${degrees}deg, rgba(66,160,108,.18) ${degrees}deg)`;
  }
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
  const systemEventList = document.getElementById('systemEventList');
  const visibleEvents = events.length ? events : [{ text: 'Dashboard session started', type: 'info', time: Date.now() }];

  if (eventList) {
    eventList.innerHTML = visibleEvents.map((event) => `
      <div class="event-row ${event.type}">
        <span>${timeAgo(event.time)}</span>
        <i class="status-dot ${event.type === 'warn' ? '' : 'live'}"></i>
        <strong>${escapeHtml(event.text)}</strong>
        <b>${event.type === 'success' ? 'Success' : event.type === 'warn' ? 'Warn' : 'Info'}</b>
      </div>
    `).join('');
  }

  if (systemEventList) {
    systemEventList.innerHTML = visibleEvents.slice(0, 4).map((event) => `
      <div>
        <i class="status-dot ${event.type === 'warn' ? '' : 'live'}"></i>
        <p><b>${escapeHtml(event.text)}</b><small>${event.type === 'warn' ? 'Needs attention' : 'Synced from HomeLab overview'}</small></p>
        <time>${timeAgo(event.time)}</time>
      </div>
    `).join('');
  }
}

async function loadMemory() {
  try {
    const response = await fetch('/api/memory', { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const memories = await response.json();
    setService('api', true, 'Running');
    setService('postgres', true, 'Running');

    const count = Array.isArray(memories) ? memories.length : 0;
    const memoryCount = document.getElementById('memoryCount');
    if (memoryCount) memoryCount.textContent = `${count} ${count === 1 ? 'memory' : 'memories'}`;
    const inspectorCount = document.getElementById('aiInspectorMemoryCount');
    if (inspectorCount) inspectorCount.textContent = String(count);
    const inspectorHeader = document.getElementById('aiInspectorMemoryHeader');
    if (inspectorHeader) inspectorHeader.textContent = `${count} stored`;

    if (count) {
      const latest = memories[memories.length - 1];
      const focusCopy = document.getElementById('focusCopy');
      if (focusCopy) focusCopy.textContent = latest.content;
      const latestMemory = document.getElementById('aiInspectorLatestMemory');
      if (latestMemory) latestMemory.textContent = latest.content;
      const journeyLatestMemory = document.getElementById('journeyLatestMemory');
      if (journeyLatestMemory) journeyLatestMemory.textContent = latest.content;
    } else {
      const latestMemory = document.getElementById('aiInspectorLatestMemory');
      if (latestMemory) latestMemory.textContent = 'No long-term memories stored yet.';
      const journeyLatestMemory = document.getElementById('journeyLatestMemory');
      if (journeyLatestMemory) journeyLatestMemory.textContent = 'No long-term memories stored yet.';
    }
    const journeyMemoryCount = document.getElementById('journeyMemoryCount');
    if (journeyMemoryCount) journeyMemoryCount.textContent = `${count} ${count === 1 ? 'thread' : 'threads'}`;
    addEvent(`Memory API verified · ${count} stored`, 'success');
  } catch (error) {
    setService('api', false, 'Offline');
    setService('postgres', false, 'Unknown');
    const memoryCount = document.getElementById('memoryCount');
    if (memoryCount) memoryCount.textContent = 'Memory unavailable';
    const inspectorHeader = document.getElementById('aiInspectorMemoryHeader');
    if (inspectorHeader) inspectorHeader.textContent = 'Unavailable';
    const latestMemory = document.getElementById('aiInspectorLatestMemory');
    if (latestMemory) latestMemory.textContent = 'Memory API unavailable.';
    addEvent('Memory API unavailable', 'warn');
  }
}

const TASKS_STORAGE_KEY = 'homeTaskItemsV2';
let taskFilter = 'all';
let taskItems = [];

function seedTasks() {
  return [
    { id: createConversationId(), title: 'Review Home AI memory', bucket: 'today', priority: 'normal', done: true, createdAt: Date.now() - 6000 },
    { id: createConversationId(), title: 'Study Java — Spring Boot', bucket: 'today', priority: 'normal', done: true, createdAt: Date.now() - 5000 },
    { id: createConversationId(), title: 'Check HomeLab services', bucket: 'today', priority: 'normal', done: true, createdAt: Date.now() - 4000 },
    { id: createConversationId(), title: 'Add tasks I need to remember', bucket: 'today', priority: 'high', done: false, createdAt: Date.now() - 3000 },
    { id: createConversationId(), title: 'Design readPage tool', bucket: 'upcoming', priority: 'normal', done: false, createdAt: Date.now() - 2000 },
    { id: createConversationId(), title: 'Plan next dashboard module', bucket: 'upcoming', priority: 'low', done: false, createdAt: Date.now() - 1000 }
  ];
}

function loadTaskItems() {
  try {
    const saved = JSON.parse(localStorage.getItem(TASKS_STORAGE_KEY));
    taskItems = Array.isArray(saved) ? saved : seedTasks();
  } catch (_) {
    taskItems = seedTasks();
  }
  saveTaskItems(false);
  renderTaskWorkspace();
}

function saveTaskItems(render = true) {
  localStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(taskItems));
  if (render) renderTaskWorkspace();
}

function bucketLabel(bucket) {
  return bucket === 'today' ? 'Today' : bucket === 'upcoming' ? 'Upcoming' : 'Someday';
}

function renderHomeTasks() {
  const list = document.getElementById('taskList');
  if (!list) return;
  const today = taskItems.filter((task) => task.bucket === 'today').slice(0, 6);
  list.innerHTML = today.length ? today.map((task) => `
    <label><input type="checkbox" data-home-task-id="${task.id}" ${task.done ? 'checked' : ''}/><span>${escapeHtml(task.title)}</span></label>
  `).join('') : '<div class="tasks-empty-home">No tasks for today.</div>';
  list.querySelectorAll('[data-home-task-id]').forEach((box) => {
    box.addEventListener('change', () => toggleTask(box.dataset.homeTaskId, box.checked));
  });

  const complete = today.filter((task) => task.done).length;
  const total = today.length;
  const percent = total ? Math.round((complete / total) * 100) : 0;
  document.getElementById('taskSummary').textContent = `${complete} of ${total}`;
  document.getElementById('taskPercent').textContent = `${percent}%`;
  document.getElementById('taskProgress').style.width = `${percent}%`;
}

function renderTaskWorkspace() {
  renderHomeTasks();
  const sections = document.getElementById('tasksSections');
  if (!sections) return;

  const open = taskItems.filter((task) => !task.done).length;
  const done = taskItems.filter((task) => task.done).length;
  const today = taskItems.filter((task) => task.bucket === 'today');
  const todayDone = today.filter((task) => task.done).length;
  const todayPercent = today.length ? Math.round((todayDone / today.length) * 100) : 0;
  document.getElementById('tasksTodayCount').textContent = String(today.length);
  document.getElementById('tasksOpenCount').textContent = String(open);
  document.getElementById('tasksDoneCount').textContent = String(done);
  document.getElementById('tasksFocusPercent').textContent = `${todayPercent}%`;
  document.getElementById('tasksFocusRing').style.background = `conic-gradient(#62d9ab ${Math.round(todayPercent * 3.6)}deg, rgba(58,143,111,.15) 0deg)`;
  document.getElementById('tasksFocusCopy').textContent = today.length
    ? `${todayDone} of ${today.length} tasks complete. ${Math.max(0, today.length - todayDone)} left for today.`
    : 'Nothing scheduled yet. Add what matters today.';

  let filtered = [...taskItems];
  if (taskFilter === 'done') filtered = filtered.filter((task) => task.done);
  else if (taskFilter !== 'all') filtered = filtered.filter((task) => task.bucket === taskFilter && !task.done);
  else filtered = filtered.filter((task) => !task.done);

  const buckets = taskFilter === 'done' ? ['done'] : ['today', 'upcoming', 'someday'];
  const groups = buckets.map((bucket) => {
    const items = bucket === 'done' ? filtered : filtered.filter((task) => task.bucket === bucket);
    if (!items.length) return '';
    const title = bucket === 'done' ? 'COMPLETED' : bucketLabel(bucket).toUpperCase();
    return `<section class="task-group"><div class="task-group-head"><h2>${title}</h2><span>${items.length}</span></div>${items.map(renderTaskItem).join('')}</section>`;
  }).join('');

  sections.innerHTML = groups || '<div class="tasks-empty"><b>Clear mind.</b>No tasks in this view.</div>';
  bindTaskRows();
  renderPriorityTasks();
}

function renderTaskItem(task) {
  return `<div class="task-item ${task.done ? 'completed' : ''}" data-task-id="${task.id}">
    <input class="task-check" type="checkbox" ${task.done ? 'checked' : ''} aria-label="Complete task" />
    <div class="task-copy"><span class="task-title">${escapeHtml(task.title)}</span><div class="task-meta"><span>${bucketLabel(task.bucket)}</span></div></div>
    <span class="task-priority ${task.priority}">${task.priority}</span>
    <button class="task-move" type="button" title="Move task">↻</button>
    <button class="task-delete" type="button" title="Delete task">×</button>
  </div>`;
}

function bindTaskRows() {
  document.querySelectorAll('.task-item').forEach((row) => {
    const id = row.dataset.taskId;
    row.querySelector('.task-check')?.addEventListener('change', (event) => toggleTask(id, event.target.checked));
    row.querySelector('.task-delete')?.addEventListener('click', () => deleteTask(id));
    row.querySelector('.task-move')?.addEventListener('click', () => cycleTaskBucket(id));
    row.querySelector('.task-title')?.addEventListener('dblclick', () => editTask(id));
  });
}

function addTaskFromComposer() {
  const input = document.getElementById('taskQuickInput');
  const title = input?.value.trim();
  if (!title) { input?.focus(); return; }
  taskItems.unshift({
    id: createConversationId(), title,
    bucket: document.getElementById('taskQuickBucket').value,
    priority: document.getElementById('taskQuickPriority').value,
    done: false, createdAt: Date.now()
  });
  input.value = '';
  saveTaskItems();
  showToast('Task added');
  input.focus();
}

function toggleTask(id, done) {
  const task = taskItems.find((item) => item.id === id);
  if (!task) return;
  task.done = Boolean(done);
  saveTaskItems();
}

function deleteTask(id) {
  taskItems = taskItems.filter((item) => item.id !== id);
  saveTaskItems();
  showToast('Task removed');
}

function cycleTaskBucket(id) {
  const task = taskItems.find((item) => item.id === id);
  if (!task) return;
  const order = ['today', 'upcoming', 'someday'];
  task.bucket = order[(order.indexOf(task.bucket) + 1) % order.length];
  saveTaskItems();
  showToast(`Moved to ${bucketLabel(task.bucket)}`);
}

function editTask(id) {
  const task = taskItems.find((item) => item.id === id);
  if (!task) return;
  const next = prompt('Edit task', task.title);
  if (next === null) return;
  const clean = next.trim();
  if (!clean) return;
  task.title = clean;
  saveTaskItems();
}

function renderPriorityTasks() {
  const target = document.getElementById('tasksPriorityList');
  if (!target) return;
  const high = taskItems.filter((task) => !task.done && task.priority === 'high').slice(0, 5);
  target.innerHTML = high.length ? high.map((task) => `<div class="tasks-priority-row"><i></i><span>${escapeHtml(task.title)}</span><small>${bucketLabel(task.bucket)}</small></div>`).join('') : '<div class="tasks-priority-empty">No high-priority tasks. Nice.</div>';
}

function clearCompletedTasks() {
  const before = taskItems.length;
  taskItems = taskItems.filter((task) => !task.done);
  saveTaskItems();
  showToast(`${before - taskItems.length} completed tasks cleared`);
}

async function submitSearch() {
  const value = search.value.trim();
  if (!value) return;

  const normalized = value.toLowerCase();
  const commandMap = new Map([
    ['/home', 'Home'], ['home', 'Home'],
    ['/ai', 'AI'], ['ai', 'AI'],
    ['/tasks', 'Tasks'], ['tasks', 'Tasks'],
    ['/homelab', 'HomeLab'], ['homelab', 'HomeLab'], ['/system', 'HomeLab'], ['system', 'HomeLab'],
    ['/journey', 'Journey'], ['journey', 'Journey']
  ]);

  if (commandMap.has(normalized)) {
    openView(commandMap.get(normalized));
    search.value = '';
    search.blur();
    showToast(`Opened ${commandMap.get(normalized)}`);
    return;
  }

  if (normalized.startsWith('/ask ')) {
    const prompt = value.slice(5).trim();
    openView('AI');
    aiPagePrompt.value = prompt;
    autosizeAiTextarea();
    setTimeout(() => aiPagePrompt.focus(), 80);
    search.value = '';
    return;
  }

  const webQuery = normalized.startsWith('/web ') ? value.slice(5).trim() : value;
  searchResultsBody.textContent = 'Searching…';
  searchResults.classList.add('show');

  try {
    const response = await fetch(`/api/search?q=${encodeURIComponent(webQuery)}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const text = await response.text();
    searchResultsBody.textContent = text;
    setService('searxng', true, 'Running');
    addEvent(`Web search completed · ${webQuery}`, 'success');
  } catch (error) {
    searchResultsBody.textContent = `Search unavailable\n${error.message}`;
    setService('searxng', false, 'Unavailable');
    addEvent('SearXNG request failed', 'warn');
  }
}

async function requestHomeAi(raw, useWeb) {
  const outgoing = useWeb && !/^web:/i.test(raw) ? `web: ${raw}` : raw;
  const response = await fetch('/api/ai/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: outgoing, conversationId })
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = await response.json();
  return data.response || 'No response.';
}

async function submitPrompt() {
  const raw = aiPrompt.value.trim();
  if (!raw || sendPrompt.disabled) return;

  aiPrompt.value = '';
  sendPrompt.disabled = true;
  aiOrb.classList.add('thinking');
  document.getElementById('runtimeLabel').textContent = 'Thinking';
  document.getElementById('runtimeMetric').textContent = webEnabled ? 'web + local' : 'local';
  aiResponseBody.textContent = 'Thinking…';
  aiResponse.classList.add('show');

  try {
    const answer = await requestHomeAi(raw, webEnabled);
    aiResponseBody.textContent = answer;
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

function addAiPageMessage(role, text, options = {}) {
  const article = document.createElement('article');
  article.className = `ai-message ${role}${options.thinking ? ' thinking' : ''}${options.error ? ' error' : ''}`;
  const who = role === 'user' ? 'YOU' : 'HOME AI';
  const badge = role === 'user' ? 'YOU' : options.web ? 'WEB + LOCAL' : 'LOCAL';
  article.innerHTML = `
    <div class="ai-message-meta"><span>${who}</span><small>${badge}</small></div>
    <div class="ai-message-bubble"></div>
  `;
  article.querySelector('.ai-message-bubble').textContent = text;
  aiPageMessages.appendChild(article);
  aiPageMessages.scrollTop = aiPageMessages.scrollHeight;
  return article;
}

function autosizeAiTextarea() {
  aiPagePrompt.style.height = 'auto';
  aiPagePrompt.style.height = `${Math.min(aiPagePrompt.scrollHeight, 110)}px`;
}

function updateAiPageWebState(enabled) {
  aiPageWebEnabled = enabled;
  aiPageWebToggle.classList.toggle('active', enabled);
  aiPageWebToggle.setAttribute('aria-pressed', String(enabled));
  aiChatModeLabel.textContent = enabled ? 'Web + local · memory enabled' : 'Local · memory enabled';
  aiPagePrivacyNote.textContent = enabled ? 'WEB enabled · query leaves HomeLab' : 'Private · local by default';
}

async function submitAiPagePrompt() {
  const raw = aiPagePrompt.value.trim();
  if (!raw || aiPageSend.disabled) return;

  addAiPageMessage('user', raw);
  aiPagePrompt.value = '';
  autosizeAiTextarea();
  aiPageSend.disabled = true;
  const thinking = addAiPageMessage('assistant', 'Thinking…', { thinking: true, web: aiPageWebEnabled });

  try {
    const explicitWeb = /^web:/i.test(raw);
    const useWeb = aiPageWebEnabled || explicitWeb;
    const answer = await requestHomeAi(raw, useWeb);
    thinking.remove();
    addAiPageMessage('assistant', answer, { web: useWeb });
    setService('api', true, 'Running');
    setService('ollama', true, 'Connected');
    if (useWeb) setService('searxng', true, 'Running');
    addEvent(useWeb ? 'AI workspace answered with web context' : 'AI workspace answered locally', 'success');
  } catch (error) {
    thinking.remove();
    addAiPageMessage('assistant', `HOME AI unavailable\n${error.message}`, { error: true });
    setService('ollama', false, 'Unavailable');
    addEvent('Home AI workspace request failed', 'warn');
  } finally {
    aiPageSend.disabled = false;
    aiPagePrompt.focus();
  }
}

function clearAiPageChat(showWelcome = true) {
  aiPageMessages.innerHTML = '';
  if (showWelcome) {
    addAiPageMessage('assistant', 'New workspace ready. What do you want to work on?');
  }
}

function updateSystemWorkspace() {
  const count = Object.values(serviceState).filter(Boolean).length;
  const total = Object.keys(serviceState).length;
  const header = document.getElementById('systemVerifiedHeader');
  const ringCount = document.getElementById('systemVerifiedCount');
  const verified = document.getElementById('systemVerifiedLegend');
  const standby = document.getElementById('systemStandbyLegend');
  const ring = document.getElementById('systemRing');
  if (header) header.textContent = `${count} / ${total}`;
  if (ringCount) ringCount.textContent = `${count}/${total}`;
  if (verified) verified.textContent = String(count);
  if (standby) standby.textContent = String(total - count);
  if (ring) {
    const degrees = Math.round((count / total) * 360);
    ring.style.background = `conic-gradient(#58e2a0 ${degrees}deg, rgba(52,137,99,.18) ${degrees}deg)`;
  }
  renderEvents();
}

const systemServiceDetails = {
  api: { name: 'Spring Boot API', icon: 'S', status: 'Running', rows: [['Port','8080'],['Java','21'],['Memory','Connected'],['Role','Backend API']] },
  postgres: { name: 'PostgreSQL', icon: 'P', status: 'Running', rows: [['Port','5432'],['Database','homelab'],['Storage','Persistent'],['Role','Database']] },
  ollama: { name: 'Ollama', icon: '◌', status: 'Standby', rows: [['Endpoint','192.168.56.1:11434'],['GPU','RTX 2060'],['Model','Qwen 3.5 4B'],['Scope','Host-only']] },
  searxng: { name: 'SearXNG', icon: '⌕', status: 'Standby', rows: [['Port','8888 → 8080'],['API','JSON enabled'],['Network','postgres_default'],['Role','Web search']] }
};

function selectSystemService(key, open = true) {
  const info = systemServiceDetails[key];
  if (!info) return;
  const online = Boolean(serviceState[key]);
  const name = document.getElementById('selectedServiceName');
  const icon = document.getElementById('selectedServiceIcon');
  const status = document.getElementById('selectedServiceStatus');
  const dot = document.getElementById('selectedServiceDot');
  const details = document.getElementById('selectedServiceDetails');
  if (name) name.textContent = info.name;
  if (icon) icon.textContent = info.icon;
  if (status) status.textContent = online ? 'Verified online' : 'Not verified this session';
  if (dot) dot.classList.toggle('live', online);
  if (details) details.innerHTML = info.rows.map(([label,value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join('');
  if (open) openView('HomeLab');
}

document.querySelectorAll('[data-system-tab]').forEach((button) => {
  button.addEventListener('click', () => showToast(`${button.dataset.systemTab} view · next system iteration`));
});

document.querySelectorAll('[data-system-action]').forEach((button) => {
  button.addEventListener('click', () => showToast(`${button.dataset.systemAction} · system tool coming next`));
});

function openView(viewName) {
  let normalized = String(viewName || '').toLowerCase();
  if (normalized === 'system') normalized = 'homelab';
  const available = normalized === 'home' || normalized === 'ai' || normalized === 'tasks' || normalized === 'homelab' || normalized === 'journey';
  if (!available) {
    showToast(`${viewName} · next module to design`);
    return;
  }

  document.querySelectorAll('.app-view').forEach((view) => view.classList.remove('active'));
  const target = document.getElementById(`view-${normalized}`);
  if (target) target.classList.add('active');

  document.querySelectorAll('.nav-item').forEach((item) => {
    item.classList.toggle('active', item.dataset.view?.toLowerCase() === normalized);
  });

  history.replaceState(null, '', normalized === 'home' ? location.pathname : `${location.pathname}#${normalized}`);
  if (normalized === 'ai') setTimeout(() => aiPagePrompt.focus(), 80);
  if (normalized === 'homelab') updateSystemWorkspace();
  if (normalized === 'tasks') setTimeout(() => document.getElementById('taskQuickInput')?.focus(), 60);
}

webToggle.addEventListener('click', () => {
  webEnabled = !webEnabled;
  webToggle.classList.toggle('active', webEnabled);
  webToggle.setAttribute('aria-pressed', String(webEnabled));
  showToast(webEnabled ? 'WEB enabled for next prompts' : 'WEB disabled · local mode');
});

aiPageWebToggle.addEventListener('click', () => updateAiPageWebState(!aiPageWebEnabled));
aiPageSend.addEventListener('click', submitAiPagePrompt);
aiPagePrompt.addEventListener('input', autosizeAiTextarea);
aiPagePrompt.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    submitAiPagePrompt();
  }
});

document.querySelectorAll('.ai-quick-chip').forEach((button) => {
  button.addEventListener('click', () => {
    const prompt = button.dataset.aiPrompt || '';
    if (/^web:/i.test(prompt)) updateAiPageWebState(true);
    aiPagePrompt.value = prompt.replace(/^web:\s*/i, '');
    autosizeAiTextarea();
    aiPagePrompt.focus();
  });
});

document.getElementById('aiNewChat').addEventListener('click', () => {
  conversationId = createConversationId();
  clearAiPageChat(true);
  showToast('New AI conversation started');
});
document.getElementById('aiClearChat').addEventListener('click', () => clearAiPageChat(true));

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
aiOrb.addEventListener('click', () => openView('AI'));
aiOrb.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    openView('AI');
  }
});

document.getElementById('closeAnswer').addEventListener('click', () => aiResponse.classList.remove('show'));
document.getElementById('closeSearch').addEventListener('click', () => searchResults.classList.remove('show'));
document.getElementById('clearEvents').addEventListener('click', () => { events.length = 0; renderEvents(); });

document.querySelectorAll('.nav-item').forEach((button) => {
  button.addEventListener('click', () => openView(button.dataset.view));
});

document.querySelectorAll('[data-service-action]').forEach((button) => {
  button.addEventListener('click', () => {
    const key = button.dataset.serviceAction;
    selectSystemService(key, true);
  });
});


document.querySelectorAll('[data-open-homelab]').forEach((element) => {
  element.addEventListener('click', (event) => {
    if (event.target.closest('[data-service-action]')) return;
    openView('HomeLab');
  });
  element.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openView('HomeLab');
    }
  });
});

document.querySelectorAll('.journey-reflect').forEach((button) => {
  button.addEventListener('click', () => {
    const prompt = button.dataset.journeyPrompt || 'Help me reflect on this moment.';
    openView('AI');
    aiPagePrompt.value = prompt;
    autosizeAiTextarea();
    setTimeout(() => aiPagePrompt.focus(), 90);
  });
});

document.querySelectorAll('[data-journey-chapter]').forEach((button) => {
  button.addEventListener('click', () => {
    showToast(`${button.dataset.journeyChapter} chapter · timeline filtering comes next`);
  });
});

document.querySelectorAll('.journey-filters button').forEach((button) => {
  button.addEventListener('click', () => {
    document.querySelectorAll('.journey-filters button').forEach((item) => item.classList.remove('active'));
    button.classList.add('active');
    showToast(`${button.textContent.trim()} journey filter selected`);
  });
});

document.getElementById('journeyAddMoment')?.addEventListener('click', () => {
  showToast('Add Moment composer · next Journey iteration');
});


document.getElementById('taskAddButton')?.addEventListener('click', addTaskFromComposer);
document.getElementById('taskQuickInput')?.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') addTaskFromComposer();
});
document.querySelectorAll('[data-task-filter]').forEach((button) => {
  button.addEventListener('click', () => {
    taskFilter = button.dataset.taskFilter;
    document.querySelectorAll('[data-task-filter]').forEach((item) => item.classList.toggle('active', item === button));
    renderTaskWorkspace();
  });
});
document.getElementById('clearCompletedTasks')?.addEventListener('click', clearCompletedTasks);
document.getElementById('tasksAskAi')?.addEventListener('click', () => {
  const openTasks = taskItems.filter((task) => !task.done).map((task) => `- ${task.title} (${bucketLabel(task.bucket)}, ${task.priority})`).join('\n');
  openView('AI');
  aiPagePrompt.value = `Help me plan and prioritize these tasks:\n${openTasks || '- No open tasks yet'}`;
  autosizeAiTextarea();
  setTimeout(() => aiPagePrompt.focus(), 80);
});

document.addEventListener('keydown', (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault();
    search.focus();
    search.select();
  }
  if (event.key === 'Escape' && document.getElementById('view-ai').classList.contains('active')) {
    openView('Home');
  }
});

setInterval(updateClock, 15_000);
setInterval(renderEvents, 30_000);
updateClock();
loadTaskItems();
renderEvents();
loadMemory();
updateAiPageWebState(false);

const hashView = location.hash.toLowerCase();
const initialView = hashView === '#ai' ? 'AI' : hashView === '#tasks' ? 'Tasks' : (hashView === '#homelab' || hashView === '#system') ? 'HomeLab' : hashView === '#journey' ? 'Journey' : 'Home';
openView(initialView);
