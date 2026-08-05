import {
  CONCEPTS,
  RATING_LABELS,
  buildSchedule,
  chooseNextConcept,
  normaliseProgress,
  progressSummary,
  recordRating,
} from './practice-model.js';

const STORAGE_KEY = 'grandma-test-practice-v1';
const views = ['learn', 'practice', 'plan'];
let currentConceptId = null;
let persistenceAvailable = true;

function validProgrammeStart(value) {
  if (typeof value !== 'string') return null;
  try {
    buildSchedule(value);
    return value;
  } catch {
    return null;
  }
}

function loadState() {
  let stored;
  try {
    stored = localStorage.getItem(STORAGE_KEY) || '{}';
  } catch {
    persistenceAvailable = false;
    return { progress: normaliseProgress({}), programmeStart: null };
  }

  try {
    const parsed = JSON.parse(stored);
    return {
      progress: normaliseProgress(parsed.progress),
      programmeStart: validProgrammeStart(parsed.programmeStart),
    };
  } catch {
    return { progress: normaliseProgress({}), programmeStart: null };
  }
}

let state = loadState();

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    persistenceAvailable = true;
    return true;
  } catch {
    persistenceAvailable = false;
    return false;
  }
}

function localIsoDay() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function formatDay(isoDate) {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${isoDate}T00:00:00Z`));
}

function setView(name) {
  if (!views.includes(name)) return;
  document.querySelectorAll('.view-tab').forEach(button => {
    const active = button.dataset.view === name;
    button.classList.toggle('active', active);
    button.setAttribute('aria-selected', String(active));
  });
  document.querySelectorAll('.view').forEach(view => {
    view.hidden = view.id !== `${name}-view`;
  });
}

function renderMastery() {
  const summary = progressSummary(state.progress);
  const percentage = (summary.mastered / summary.total) * 100;
  document.getElementById('masteryBar').style.width = `${percentage}%`;
  document.getElementById('masteryBar').textContent = `${summary.mastered}/${summary.total}`;
  document.getElementById('masteryText').textContent = `${summary.mastered}/7 can teach · ${summary.attempts} practice attempt${summary.attempts === 1 ? '' : 's'}`;
}

function renderPersistenceNotice() {
  document.getElementById('persistenceNotice').hidden = persistenceAvailable;
}

function renderPracticeMeta() {
  if (!currentConceptId) return;
  const concept = CONCEPTS.find(item => item.id === currentConceptId);
  const entry = state.progress[currentConceptId];
  document.getElementById('practiceMeta').textContent = `Concept ${concept.number} of 7 · ${RATING_LABELS[entry.rating]}`;
}

function setPracticeConcept(conceptId) {
  const concept = CONCEPTS.find(item => item.id === conceptId) ?? chooseNextConcept(state.progress);
  currentConceptId = concept.id;

  renderPracticeMeta();
  document.getElementById('practiceTitle').textContent = concept.title;
  document.getElementById('practicePrompt').textContent = concept.prompt;
  document.getElementById('practiceCriteria').innerHTML = concept.criteria
    .map(criterion => `<li>${criterion}</li>`)
    .join('');
  document.getElementById('practiceBenchmark').textContent = concept.benchmark;
  document.getElementById('practiceReveal').hidden = true;
  document.getElementById('revealAnswer').hidden = false;
  document.getElementById('ratingControls').hidden = true;
  document.getElementById('nextPrompt').hidden = true;
  document.getElementById('practiceFeedback').textContent = 'Say the answer out loud before revealing the benchmark.';
}

function renderProgressList() {
  document.getElementById('conceptProgress').innerHTML = CONCEPTS.map(concept => {
    const entry = state.progress[concept.id];
    const last = entry.lastPractised
      ? new Date(entry.lastPractised).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
      : 'Never';
    return `<button type="button" class="progress-row" data-practice-id="${concept.id}">
      <span><strong>${concept.number}. ${concept.title}</strong><small>${entry.attempts} attempt${entry.attempts === 1 ? '' : 's'} · ${last}</small></span>
      <span class="rating rating-${entry.rating}">${RATING_LABELS[entry.rating]}</span>
    </button>`;
  }).join('');
}

function renderSchedule() {
  const input = document.getElementById('programmeStart');
  const start = validProgrammeStart(input.value) ?? localIsoDay();
  const schedule = buildSchedule(start);
  const today = localIsoDay();
  const stored = state.programmeStart === start;

  document.getElementById('programmeStatus').textContent = stored
    ? `Programme active · ${formatDay(schedule[0].start)} to ${formatDay(schedule.at(-1).end)}`
    : `Preview · ${formatDay(schedule[0].start)} to ${formatDay(schedule.at(-1).end)}`;
  document.getElementById('scheduleList').innerHTML = schedule.map(period => {
    const entry = state.progress[period.id];
    const current = today >= period.start && today <= period.end;
    return `<div class="schedule-row ${current ? 'current' : ''}">
      <div class="schedule-weeks">Weeks ${period.weekStart}–${period.weekEnd}</div>
      <div><strong>${period.title}</strong><small>${formatDay(period.start)} – ${formatDay(period.end)}</small></div>
      <span class="rating rating-${entry.rating}">${RATING_LABELS[entry.rating]}</span>
    </div>`;
  }).join('');
}

function renderAll() {
  renderMastery();
  renderPersistenceNotice();
  renderPracticeMeta();
  renderProgressList();
  renderSchedule();
}

document.querySelectorAll('.view-tab').forEach(button => {
  button.addEventListener('click', () => setView(button.dataset.view));
});

document.querySelectorAll('.lesson-toggle').forEach(button => {
  button.addEventListener('click', () => {
    const card = button.closest('.concept-card');
    const willOpen = !card.classList.contains('open');
    document.querySelectorAll('.concept-card.open').forEach(openCard => {
      openCard.classList.remove('open');
      openCard.querySelector('.lesson-toggle').setAttribute('aria-expanded', 'false');
      openCard.querySelector('.concept-body').hidden = true;
    });
    if (willOpen) {
      card.classList.add('open');
      button.setAttribute('aria-expanded', 'true');
      card.querySelector('.concept-body').hidden = false;
    }
  });
});

document.querySelectorAll('.toc a').forEach(link => {
  link.addEventListener('click', event => {
    event.preventDefault();
    const card = document.querySelector(link.getAttribute('href'));
    setView('learn');
    if (!card.classList.contains('open')) {
      card.querySelector('.lesson-toggle').click();
    }
    card.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
});

document.getElementById('startPractice').addEventListener('click', () => {
  setPracticeConcept(chooseNextConcept(state.progress).id);
  setView('practice');
});

document.getElementById('revealAnswer').addEventListener('click', () => {
  document.getElementById('practiceReveal').hidden = false;
  document.getElementById('revealAnswer').hidden = true;
  document.getElementById('ratingControls').hidden = false;
  document.getElementById('practiceFeedback').textContent = 'Compare the structure, not the exact wording. Then rate honestly.';
});

document.querySelectorAll('[data-rating]').forEach(button => {
  button.addEventListener('click', () => {
    state.progress = recordRating(state.progress, currentConceptId, button.dataset.rating);
    saveState();
    renderAll();
    document.getElementById('practiceFeedback').textContent = `Saved: ${RATING_LABELS[button.dataset.rating]}.`;
    document.getElementById('ratingControls').hidden = true;
    document.getElementById('nextPrompt').hidden = false;
  });
});

document.getElementById('nextPrompt').addEventListener('click', () => {
  setPracticeConcept(chooseNextConcept(state.progress, currentConceptId).id);
});

document.getElementById('differentPrompt').addEventListener('click', () => {
  setPracticeConcept(chooseNextConcept(state.progress, currentConceptId).id);
});

document.getElementById('conceptProgress').addEventListener('click', event => {
  const row = event.target.closest('[data-practice-id]');
  if (!row) return;
  setPracticeConcept(row.dataset.practiceId);
  document.getElementById('practiceCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
});

document.getElementById('programmeStart').addEventListener('input', renderSchedule);
document.getElementById('saveProgramme').addEventListener('click', () => {
  const input = document.getElementById('programmeStart');
  const start = validProgrammeStart(input.value);
  if (!start) return;
  state.programmeStart = start;
  saveState();
  renderPersistenceNotice();
  renderSchedule();
});

document.getElementById('resetProgress').addEventListener('click', () => {
  if (!confirm('Reset all practice ratings, attempts and the programme start date?')) return;
  try {
    localStorage.removeItem(STORAGE_KEY);
    persistenceAvailable = true;
  } catch {
    persistenceAvailable = false;
  }
  state = { progress: normaliseProgress({}), programmeStart: null };
  document.getElementById('programmeStart').value = localIsoDay();
  setPracticeConcept(chooseNextConcept(state.progress).id);
  renderAll();
});

document.getElementById('programmeStart').value = state.programmeStart ?? localIsoDay();
setPracticeConcept(chooseNextConcept(state.progress).id);
renderAll();
setView('learn');
