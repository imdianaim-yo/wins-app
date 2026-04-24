// app.js — Main controller. Wires up all UI interactions.

// ── Greeting helpers ──

const PROMPTS = [
  "What's worth bragging about today?",
  "What did you ship today?",
  "What did you pull off today?",
  "What did you make happen today?",
  "What are today's wins?",
  "What's worth celebrating from today?",
  "What did you knock out today?",
  "What did you move forward today?",
];

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function formatDateFull(date) {
  return date.toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  });
}

function dailyPrompt() {
  // Pick a prompt deterministically by day so it stays stable on reload
  const dayIndex = new Date().getDate() % PROMPTS.length;
  return PROMPTS[dayIndex];
}

// ── DOM refs ──

const $ = id => document.getElementById(id);

const elGreeting          = $('greeting');
const elTodayDate         = $('today-date');
const elDailyPrompt       = $('daily-prompt');
const elViewToday         = $('view-today');
const elViewTimeline      = $('view-timeline');
const elStateEmpty        = $('state-empty');
const elStateParsing      = $('state-parsing');
const elStateReview       = $('state-review');
const elStateSaved        = $('state-saved');
const elTextInput         = $('text-input');
const elTranscriptLive    = $('transcript-live');
const elActionsRow        = $('actions-row');
const elBtnRecord         = $('btn-record');
const elListAccomplishments = $('list-accomplishments');
const elListLearnings     = $('list-learnings');
const elTimelineList      = $('timeline-list');
const elTimelineEmpty     = $('timeline-empty');
const elModalExport       = $('modal-export');
const elExportFrom        = $('export-from');
const elExportTo          = $('export-to');
const elApiKeyBanner      = $('api-key-banner');
const elApiKeyInput       = $('api-key-input');
const elSavedAccCount     = $('saved-accomplishments-count');
const elSavedLeaCount     = $('saved-learnings-count');

// ── State ──

let currentParsed = { accomplishments: [], learnings: [] };
let recognition   = null;
let isRecording   = false;

// ── Init ──

async function init() {
  elGreeting.textContent    = getGreeting();
  elTodayDate.textContent   = formatDateFull(new Date());
  elDailyPrompt.textContent = dailyPrompt();

  // Pre-fill export date range to last 90 days
  const today  = todayString();
  const ago90  = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  elExportFrom.value = ago90;
  elExportTo.value   = today;

  // Check if today already has an entry
  const existing = await getTodayEntry();
  if (existing) {
    showSavedState(existing);
  }

  // Show API key banner if no key saved
  if (!getApiKey()) {
    elApiKeyBanner.classList.remove('hidden');
  }

  bindEvents();
}

// ── View switching ──

function showView(view) {
  elViewToday.classList.toggle('active', view === 'today');
  elViewToday.classList.toggle('hidden', view !== 'today');
  elViewTimeline.classList.toggle('active', view === 'timeline');
  elViewTimeline.classList.toggle('hidden', view !== 'timeline');
}

// ── Entry states ──

function showState(state) {
  [elStateEmpty, elStateParsing, elStateReview, elStateSaved]
    .forEach(el => el.classList.add('hidden'));
  state.classList.remove('hidden');
}

function showSavedState(entry) {
  showState(elStateSaved);
  const accCount = entry.accomplishments?.length || 0;
  const leaCount = entry.learnings?.length || 0;
  elSavedAccCount.textContent = `${accCount} accomplishment${accCount !== 1 ? 's' : ''}`;
  elSavedLeaCount.textContent = `${leaCount} learning${leaCount !== 1 ? 's' : ''}`;
  if (accCount === 0) elSavedAccCount.classList.add('hidden');
  if (leaCount === 0) elSavedLeaCount.classList.add('hidden');
}

// ── Voice recording ──

function startRecording() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    alert('Your browser doesn\'t support voice input. Try Chrome or Edge, or type your brain dump instead.');
    return;
  }

  recognition = new SR();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = 'en-US';

  let finalTranscript = '';

  recognition.onresult = event => {
    let interim = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const t = event.results[i].transcript;
      if (event.results[i].isFinal) {
        finalTranscript += t + ' ';
      } else {
        interim = t;
      }
    }
    elTranscriptLive.textContent = interim ? `"${interim}"` : '';
    elTextInput.value = finalTranscript + interim;
    updateActionsVisibility();
  };

  recognition.onerror = e => {
    console.warn('Speech error:', e.error);
    stopRecording();
    if (e.error === 'not-allowed') {
      alert('Microphone access was denied. Please allow microphone access and try again.');
    }
  };

  recognition.onend = () => {
    if (isRecording) recognition.start(); // keep going until user stops
  };

  recognition.start();
  isRecording = true;
  elBtnRecord.classList.add('recording');
  elTextInput.classList.add('expanded');
  updateActionsVisibility();
}

function stopRecording() {
  isRecording = false;
  recognition?.stop();
  recognition = null;
  elBtnRecord.classList.remove('recognizing');
  elBtnRecord.classList.remove('recording');
  elTranscriptLive.textContent = '';
  updateActionsVisibility();
}

function updateActionsVisibility() {
  const hasText = elTextInput.value.trim().length > 0;
  elActionsRow.classList.toggle('hidden', !hasText);
}

// ── Parsing ──

async function parse() {
  const text = elTextInput.value.trim();
  if (!text) return alert('Please record or type something first.');

  const apiKey = getApiKey();
  if (!apiKey) {
    elApiKeyBanner.classList.remove('hidden');
    elApiKeyInput.focus();
    return;
  }

  showState(elStateParsing);

  try {
    const result = await parseDump(text);
    currentParsed = result;

    elListAccomplishments.innerHTML = result.accomplishments.length
      ? result.accomplishments.map(a => `<li>${escapeHtml(a)}</li>`).join('')
      : '<li style="color: var(--text-dim); font-style: italic;">None found</li>';

    elListLearnings.innerHTML = result.learnings.length
      ? result.learnings.map(l => `<li>${escapeHtml(l)}</li>`).join('')
      : '<li style="color: var(--text-dim); font-style: italic;">None found</li>';

    showState(elStateReview);
  } catch (err) {
    showState(elStateEmpty);
    if (err.message === 'NO_KEY') {
      elApiKeyBanner.classList.remove('hidden');
    } else if (err.message === 'EMPTY') {
      alert('Please add some text first.');
    } else {
      alert(`Parsing failed: ${err.message}`);
    }
  }
}

// ── Save ──

async function saveCurrentEntry() {
  try {
    await saveEntry({
      date: todayString(),
      rawDump: elTextInput.value.trim(),
      accomplishments: currentParsed.accomplishments,
      learnings: currentParsed.learnings,
    });
    const entry = await getTodayEntry();
    showSavedState(entry);
  } catch (err) {
    alert(`Couldn't save: ${err.message}`);
  }
}

// ── Timeline ──

async function loadTimeline() {
  showView('timeline');
  const entries = await getAllEntries();

  if (!entries.length) {
    elTimelineList.innerHTML = '';
    elTimelineEmpty.classList.remove('hidden');
    return;
  }

  elTimelineEmpty.classList.add('hidden');
  elTimelineList.innerHTML = entries.map(entry => `
    <div class="timeline-entry">
      <div class="timeline-entry-date">${formatDateLong(entry.date)}</div>
      <div class="timeline-chips">
        ${entry.accomplishments?.length ? `<span class="count-chip accomplishments-chip">${entry.accomplishments.length} accomplishment${entry.accomplishments.length !== 1 ? 's' : ''}</span>` : ''}
        ${entry.learnings?.length ? `<span class="count-chip learnings-chip">${entry.learnings.length} learning${entry.learnings.length !== 1 ? 's' : ''}</span>` : ''}
      </div>
      ${entry.accomplishments?.length ? `
        <div class="timeline-section">
          <div class="timeline-section-label acc">Accomplishments</div>
          <ul class="timeline-items">
            ${entry.accomplishments.map(a => `<li>${escapeHtml(a)}</li>`).join('')}
          </ul>
        </div>` : ''}
      ${entry.learnings?.length ? `
        <div class="timeline-section">
          <div class="timeline-section-label lea">Learnings</div>
          <ul class="timeline-items">
            ${entry.learnings.map(l => `<li>${escapeHtml(l)}</li>`).join('')}
          </ul>
        </div>` : ''}
    </div>
  `).join('');
}

function formatDateLong(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });
}

// ── Events ──

function bindEvents() {
  // Nav
  $('btn-timeline').addEventListener('click', loadTimeline);
  $('btn-export').addEventListener('click', () => elModalExport.classList.remove('hidden'));
  $('btn-calendar').addEventListener('click', () => {
    createReminder();
  });

  // Back
  $('btn-back-from-timeline').addEventListener('click', () => showView('today'));

  // Record (toggle)
  elBtnRecord.addEventListener('click', () => {
    if (isRecording) stopRecording(); else startRecording();
  });

  // Text input: show parse button when there's text; keep expanded while focused or filled
  elTextInput.addEventListener('input', updateActionsVisibility);
  elTextInput.addEventListener('focus', () => elTextInput.classList.add('expanded'));
  elTextInput.addEventListener('blur', () => {
    if (!elTextInput.value.trim()) elTextInput.classList.remove('expanded');
  });

  // Theme toggle
  $('btn-theme').addEventListener('click', toggleTheme);

  // Parse
  $('btn-parse').addEventListener('click', parse);

  // Review
  $('btn-edit').addEventListener('click', () => showState(elStateEmpty));
  $('btn-save').addEventListener('click', saveCurrentEntry);

  // New entry after saved
  $('btn-new-entry').addEventListener('click', () => {
    elTextInput.value = '';
    elTextInput.classList.remove('expanded');
    currentParsed = { accomplishments: [], learnings: [] };
    updateActionsVisibility();
    showState(elStateEmpty);
  });

  // API key
  $('btn-save-key').addEventListener('click', () => {
    const key = elApiKeyInput.value.trim();
    if (!key.startsWith('sk-ant-')) {
      alert('That doesn\'t look like a valid Anthropic API key. It should start with sk-ant-');
      return;
    }
    setApiKey(key);
    elApiKeyBanner.classList.add('hidden');
    elApiKeyInput.value = '';
  });

  // Export modal
  $('btn-close-export').addEventListener('click', () => elModalExport.classList.add('hidden'));
  $('modal-export').querySelector('.modal-backdrop').addEventListener('click', () => elModalExport.classList.add('hidden'));

  $('btn-export-md').addEventListener('click', async () => {
    await exportMarkdown(elExportFrom.value, elExportTo.value);
    elModalExport.classList.add('hidden');
  });

  $('btn-export-csv').addEventListener('click', async () => {
    await exportCSV(elExportFrom.value, elExportTo.value);
    elModalExport.classList.add('hidden');
  });
}

// ── Utility ──

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('wins_theme', next);
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Start ──

init();
