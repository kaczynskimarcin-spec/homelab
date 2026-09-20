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
const TASKS_OFFLINE_STORAGE_KEY = 'homeTaskItemsOfflineV1';
let taskFilter = 'all';
let taskItems = [];
let editingTaskId = null;
let tasksBackendAvailable = false;

function localDateISO(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseLocalDate(iso) {
  if (!iso) return null;
  const [year, month, day] = iso.split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

function addDaysISO(iso, days) {
  const date = parseLocalDate(iso) || new Date();
  date.setDate(date.getDate() + days);
  return localDateISO(date);
}

function todayISO() {
  return localDateISO(new Date());
}

function tomorrowISO() {
  return addDaysISO(todayISO(), 1);
}

function normalizeTask(task) {
  const normalized = { ...task };
  if (!Object.prototype.hasOwnProperty.call(normalized, 'dueDate')) {
    normalized.dueDate = normalized.bucket === 'today'
      ? todayISO()
      : normalized.bucket === 'upcoming'
        ? tomorrowISO()
        : null;
  }

  normalized.done = Object.prototype.hasOwnProperty.call(normalized, 'completed')
    ? Boolean(normalized.completed)
    : Boolean(normalized.done);
  normalized.completed = normalized.done;
  normalized.priority = String(normalized.priority || 'NORMAL').toLowerCase();
  if (!['low', 'normal', 'high'].includes(normalized.priority)) normalized.priority = 'normal';
  normalized.bucket = taskBucket(normalized);

  if (typeof normalized.createdAt === 'string') {
    normalized.createdAt = Date.parse(normalized.createdAt) || 0;
  }
  normalized.createdAt = Number(normalized.createdAt || 0);
  return normalized;
}

function taskToApiPayload(task) {
  return {
    title: task.title,
    completed: Boolean(task.done),
    dueDate: task.dueDate || null,
    priority: String(task.priority || 'normal').toUpperCase()
  };
}

function setTaskSyncState(mode) {
  const hint = document.getElementById('tasksDateHint');
  if (!hint) return;
  if (mode === 'loading') hint.textContent = 'Syncing with PostgreSQL…';
  else if (mode === 'live') hint.textContent = 'PostgreSQL synced · available on every device';
  else hint.textContent = 'Backend offline · local fallback';
}

function readOfflineTasks() {
  try {
    const current = JSON.parse(localStorage.getItem(TASKS_OFFLINE_STORAGE_KEY));
    if (Array.isArray(current)) return current.map(normalizeTask);
    const legacy = JSON.parse(localStorage.getItem(TASKS_STORAGE_KEY));
    if (Array.isArray(legacy)) return legacy.map(normalizeTask);
  } catch (_) {}
  return [];
}

function saveOfflineSnapshot() {
  localStorage.setItem(TASKS_OFFLINE_STORAGE_KEY, JSON.stringify(taskItems));
}

async function loadTaskItems() {
  const quickDate = document.getElementById('taskQuickDate');
  if (quickDate && !quickDate.value) quickDate.value = todayISO();
  setTaskSyncState('loading');

  try {
    const response = await fetch('/api/tasks', { cache: 'no-store' });
    if (!response.ok) throw new Error(`Tasks API ${response.status}`);
    const data = await response.json();
    taskItems = Array.isArray(data) ? data.map(normalizeTask) : [];
    tasksBackendAvailable = true;
    saveOfflineSnapshot();
    setTaskSyncState('live');
  } catch (error) {
    console.error('Tasks backend unavailable:', error);
    tasksBackendAvailable = false;
    taskItems = readOfflineTasks();
    setTaskSyncState('offline');
  }

  renderTaskWorkspace();
}

function taskBucket(task) {
  if (!task?.dueDate) return 'someday';
  return task.dueDate <= todayISO() ? 'today' : 'upcoming';
}

function bucketLabel(bucket) {
  return bucket === 'today' ? 'Today' : bucket === 'upcoming' ? 'Upcoming' : 'Someday';
}

function isOverdue(task) {
  return !task.done && Boolean(task.dueDate) && task.dueDate < todayISO();
}

function isDueToday(task) {
  return Boolean(task.dueDate) && task.dueDate === todayISO();
}

function isUpcoming(task) {
  return !task.done && Boolean(task.dueDate) && task.dueDate > todayISO();
}

function isWithinNextDays(task, days) {
  if (!isUpcoming(task)) return false;
  return task.dueDate <= addDaysISO(todayISO(), days);
}

function sortByDateThenCreated(a, b) {
  if (!a.dueDate && !b.dueDate) return (b.createdAt || 0) - (a.createdAt || 0);
  if (!a.dueDate) return 1;
  if (!b.dueDate) return -1;
  const diff = a.dueDate.localeCompare(b.dueDate);
  return diff || (b.createdAt || 0) - (a.createdAt || 0);
}

function formatTaskDate(iso, compact = false) {
  if (!iso) return 'No date';
  const today = todayISO();
  if (iso === today) return 'Today';
  if (iso === addDaysISO(today, 1)) return 'Tomorrow';
  const date = parseLocalDate(iso);
  if (!date) return iso;
  return new Intl.DateTimeFormat('en-GB', compact
    ? { day: 'numeric', month: 'short' }
    : { weekday: 'short', day: 'numeric', month: 'short' }
  ).format(date);
}

function dateTone(task) {
  if (isOverdue(task)) return 'overdue';
  if (isDueToday(task)) return 'today';
  return '';
}

function renderHomeTasks() {
  const list = document.getElementById('taskList');
  if (!list) return;
  const today = taskItems
    .filter((task) => !task.done && (isOverdue(task) || isDueToday(task)))
    .sort(sortByDateThenCreated)
    .slice(0, 6);

  list.innerHTML = today.length ? today.map((task) => `
    <label><input type="checkbox" data-home-task-id="${task.id}" ${task.done ? 'checked' : ''}/><span>${escapeHtml(task.title)}</span></label>
  `).join('') : '<div class="tasks-empty-home">No tasks for today.</div>';

  list.querySelectorAll('[data-home-task-id]').forEach((box) => {
    box.addEventListener('change', () => toggleTask(box.dataset.homeTaskId, box.checked));
  });

  const allToday = taskItems.filter((task) => isDueToday(task));
  const complete = allToday.filter((task) => task.done).length;
  const total = allToday.length;
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
  const today = taskItems.filter((task) => isDueToday(task));
  const todayDone = today.filter((task) => task.done).length;
  const nextWeek = taskItems.filter((task) => isWithinNextDays(task, 7)).length;
  const todayPercent = today.length ? Math.round((todayDone / today.length) * 100) : 0;

  document.getElementById('tasksTodayCount').textContent = String(today.length);
  document.getElementById('tasksWeekCount').textContent = String(nextWeek);
  document.getElementById('tasksOpenCount').textContent = String(open);
  document.getElementById('tasksDoneCount').textContent = String(done);
  document.getElementById('tasksFocusPercent').textContent = `${todayPercent}%`;
  document.getElementById('tasksFocusRing').style.background = `conic-gradient(#62d9ab ${Math.round(todayPercent * 3.6)}deg, rgba(58,143,111,.15) 0deg)`;
  document.getElementById('tasksFocusCopy').textContent = today.length
    ? `${todayDone} of ${today.length} tasks complete. ${Math.max(0, today.length - todayDone)} left for today.`
    : 'Nothing scheduled yet. Add what matters today.';

  let filtered = [...taskItems];
  if (taskFilter === 'done') filtered = filtered.filter((task) => task.done);
  else if (taskFilter === 'today') filtered = filtered.filter((task) => !task.done && (isOverdue(task) || isDueToday(task)));
  else if (taskFilter === 'upcoming') filtered = filtered.filter((task) => isUpcoming(task));
  else if (taskFilter === 'someday') filtered = filtered.filter((task) => !task.done && !task.dueDate);
  else filtered = filtered.filter((task) => !task.done);

  const groups = [];
  if (taskFilter === 'done') {
    const items = filtered.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    if (items.length) groups.push(renderTaskGroup('COMPLETED', items));
  } else {
    const overdue = filtered.filter(isOverdue).sort(sortByDateThenCreated);
    const dueToday = filtered.filter((task) => isDueToday(task) && !isOverdue(task)).sort(sortByDateThenCreated);
    const upcoming = filtered.filter(isUpcoming).sort(sortByDateThenCreated);
    const someday = filtered.filter((task) => !task.dueDate).sort(sortByDateThenCreated);
    if (overdue.length) groups.push(renderTaskGroup('OVERDUE', overdue, 'warn'));
    if (dueToday.length) groups.push(renderTaskGroup('TODAY', dueToday));
    if (upcoming.length) groups.push(renderTaskGroup('UPCOMING', upcoming));
    if (someday.length) groups.push(renderTaskGroup('SOMEDAY', someday));
  }

  sections.innerHTML = groups.join('') || '<div class="tasks-empty"><b>Clear mind.</b>No tasks in this view.</div>';
  bindTaskRows();
  renderUpcomingTasks();
}

function renderTaskGroup(title, items, tone = '') {
  return `<section class="task-group ${tone}"><div class="task-group-head"><h2>${title}</h2><span>${items.length}</span></div>${items.map(renderTaskItem).join('')}</section>`;
}

function renderTaskItem(task) {
  const tone = dateTone(task);
  const due = task.dueDate ? formatTaskDate(task.dueDate) : 'No date';
  return `<div class="task-item ${task.done ? 'completed' : ''} ${tone}" data-task-id="${task.id}">
    <input class="task-check" type="checkbox" ${task.done ? 'checked' : ''} aria-label="Complete task" />
    <div class="task-copy">
      <span class="task-title">${escapeHtml(task.title)}</span>
      <div class="task-meta"><span class="task-date ${tone}">${escapeHtml(due)}</span>${!task.dueDate ? '<span>Someday</span>' : ''}</div>
    </div>
    <span class="task-priority ${task.priority}">${task.priority}</span>
    <button class="task-edit" type="button" title="Edit task">•••</button>
    <button class="task-delete" type="button" title="Delete task">×</button>
  </div>`;
}

function findTaskById(id) {
  return taskItems.find((item) => String(item.id) === String(id));
}

function bindTaskRows() {
  document.querySelectorAll('.task-item').forEach((row) => {
    const id = row.dataset.taskId;
    row.querySelector('.task-check')?.addEventListener('change', (event) => toggleTask(id, event.target.checked));
    row.querySelector('.task-delete')?.addEventListener('click', () => deleteTask(id));
    row.querySelector('.task-edit')?.addEventListener('click', () => openTaskEditor(id));
    row.querySelector('.task-title')?.addEventListener('dblclick', () => openTaskEditor(id));
  });
}

async function addTaskFromComposer() {
  const input = document.getElementById('taskQuickInput');
  const title = input?.value.trim();
  if (!title) { input?.focus(); return; }
  const dueDate = document.getElementById('taskQuickDate')?.value || null;
  const priority = document.getElementById('taskQuickPriority')?.value || 'normal';
  const draft = normalizeTask({ title, dueDate, priority, done: false, createdAt: Date.now() });
  const addButton = document.getElementById('taskAddButton');

  if (!tasksBackendAvailable) {
    draft.id = createConversationId();
    taskItems.unshift(draft);
    saveOfflineSnapshot();
    renderTaskWorkspace();
    input.value = '';
    showToast('Task saved locally · backend offline');
    input.focus();
    return;
  }

  if (addButton) addButton.disabled = true;
  try {
    const response = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(taskToApiPayload(draft))
    });
    if (!response.ok) throw new Error(`Tasks API ${response.status}`);
    const saved = normalizeTask(await response.json());
    taskItems.unshift(saved);
    saveOfflineSnapshot();
    renderTaskWorkspace();
    input.value = '';
    showToast(dueDate ? `Task saved to PostgreSQL · ${formatTaskDate(dueDate)}` : 'Task saved to PostgreSQL · no date');
    input.focus();
  } catch (error) {
    console.error(error);
    showToast('Could not save task · check HomeLab API');
  } finally {
    if (addButton) addButton.disabled = false;
  }
}

async function persistTask(task) {
  if (!tasksBackendAvailable) {
    saveOfflineSnapshot();
    return normalizeTask(task);
  }
  const response = await fetch(`/api/tasks/${encodeURIComponent(task.id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(taskToApiPayload(task))
  });
  if (!response.ok) throw new Error(`Tasks API ${response.status}`);
  return normalizeTask(await response.json());
}

async function toggleTask(id, done) {
  const task = findTaskById(id);
  if (!task) return;
  const previous = task.done;
  task.done = Boolean(done);
  task.completed = task.done;
  renderTaskWorkspace();

  try {
    const saved = await persistTask(task);
    Object.assign(task, saved);
    saveOfflineSnapshot();
    renderTaskWorkspace();
  } catch (error) {
    console.error(error);
    task.done = previous;
    task.completed = previous;
    renderTaskWorkspace();
    showToast('Could not update task');
  }
}

async function deleteTask(id) {
  const index = taskItems.findIndex((item) => String(item.id) === String(id));
  if (index < 0) return;
  const [removed] = taskItems.splice(index, 1);
  renderTaskWorkspace();

  if (!tasksBackendAvailable) {
    saveOfflineSnapshot();
    showToast('Task removed locally');
    return;
  }

  try {
    const response = await fetch(`/api/tasks/${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (!response.ok) throw new Error(`Tasks API ${response.status}`);
    saveOfflineSnapshot();
    showToast('Task removed');
  } catch (error) {
    console.error(error);
    taskItems.splice(index, 0, removed);
    renderTaskWorkspace();
    showToast('Could not remove task');
  }
}

function openTaskEditor(id) {
  const task = findTaskById(id);
  const dialog = document.getElementById('taskEditDialog');
  if (!task || !dialog) return;
  editingTaskId = String(id);
  document.getElementById('taskEditTitle').value = task.title;
  document.getElementById('taskEditDate').value = task.dueDate || '';
  document.getElementById('taskEditPriority').value = task.priority || 'normal';
  dialog.showModal();
  setTimeout(() => document.getElementById('taskEditTitle')?.focus(), 50);
}

function closeTaskEditor() {
  const dialog = document.getElementById('taskEditDialog');
  if (dialog?.open) dialog.close();
  editingTaskId = null;
}

async function saveTaskEditor() {
  const task = findTaskById(editingTaskId);
  if (!task) return closeTaskEditor();
  const title = document.getElementById('taskEditTitle')?.value.trim();
  if (!title) return document.getElementById('taskEditTitle')?.focus();

  const previous = { ...task };
  task.title = title;
  task.dueDate = document.getElementById('taskEditDate')?.value || null;
  task.priority = document.getElementById('taskEditPriority')?.value || 'normal';
  task.bucket = taskBucket(task);

  try {
    const saved = await persistTask(task);
    Object.assign(task, saved);
    closeTaskEditor();
    saveOfflineSnapshot();
    renderTaskWorkspace();
    showToast(tasksBackendAvailable ? 'Task synced with PostgreSQL' : 'Task updated locally');
  } catch (error) {
    console.error(error);
    Object.assign(task, previous);
    renderTaskWorkspace();
    showToast('Could not update task');
  }
}

function deleteTaskFromEditor() {
  if (!editingTaskId) return;
  const id = editingTaskId;
  closeTaskEditor();
  deleteTask(id);
}

function renderUpcomingTasks() {
  const target = document.getElementById('tasksUpcomingList');
  if (!target) return;
  const upcoming = taskItems
    .filter((task) => !task.done && task.dueDate)
    .sort(sortByDateThenCreated)
    .slice(0, 5);

  target.innerHTML = upcoming.length ? upcoming.map((task) => {
    const tone = dateTone(task);
    return `<button class="tasks-upcoming-row ${tone}" type="button" data-upcoming-task-id="${task.id}">
      <span class="tasks-upcoming-date">${escapeHtml(formatTaskDate(task.dueDate, true))}</span>
      <span class="tasks-upcoming-copy"><b>${escapeHtml(task.title)}</b><small>${task.priority} priority</small></span>
      <span>›</span>
    </button>`;
  }).join('') : '<div class="tasks-priority-empty">Nothing dated yet. Your week is open.</div>';

  target.querySelectorAll('[data-upcoming-task-id]').forEach((button) => {
    button.addEventListener('click', () => openTaskEditor(button.dataset.upcomingTaskId));
  });
}

async function clearCompletedTasks() {
  const completed = taskItems.filter((task) => task.done);
  if (!completed.length) return showToast('No completed tasks to clear');

  if (!tasksBackendAvailable) {
    taskItems = taskItems.filter((task) => !task.done);
    saveOfflineSnapshot();
    renderTaskWorkspace();
    return showToast(`${completed.length} completed tasks cleared locally`);
  }

  try {
    await Promise.all(completed.map(async (task) => {
      const response = await fetch(`/api/tasks/${encodeURIComponent(task.id)}`, { method: 'DELETE' });
      if (!response.ok) throw new Error(`Delete ${task.id} failed`);
    }));
    await loadTaskItems();
    showToast(`${completed.length} completed tasks cleared`);
  } catch (error) {
    console.error(error);
    await loadTaskItems();
    showToast('Some tasks could not be cleared');
  }
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

  document.querySelectorAll('.nav-item, .mobile-nav-item').forEach((item) => {
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

document.querySelectorAll('.nav-item, .mobile-nav-item').forEach((button) => {
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
document.getElementById('taskEditSave')?.addEventListener('click', saveTaskEditor);
document.getElementById('taskEditDelete')?.addEventListener('click', deleteTaskFromEditor);
document.getElementById('taskEditDialog')?.addEventListener('close', () => { editingTaskId = null; });
document.getElementById('taskEditTitle')?.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') { event.preventDefault(); saveTaskEditor(); }
});
document.getElementById('tasksAskAi')?.addEventListener('click', () => {
  const openTasks = taskItems
    .filter((task) => !task.done)
    .sort(sortByDateThenCreated)
    .map((task) => `- ${task.title} (${task.dueDate ? formatTaskDate(task.dueDate) : 'no date'}, ${task.priority} priority)`)
    .join('\n');
  openView('AI');
  aiPagePrompt.value = `Help me plan and prioritize these tasks. Consider the due dates and flag anything overloaded or unrealistic:\n${openTasks || '- No open tasks yet'}`;
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
