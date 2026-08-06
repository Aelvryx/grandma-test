import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  CONCEPTS,
  buildSchedule,
  chooseNextConcept,
  normaliseProgress,
  progressSummary,
  recordRating,
} from '../practice-model.js';

test('the practice contract covers all eight lessons exactly once', () => {
  assert.equal(CONCEPTS.length, 8);
  assert.deepEqual(CONCEPTS.map(concept => concept.number), [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.equal(new Set(CONCEPTS.map(concept => concept.id)).size, 8);
  for (const concept of CONCEPTS) {
    assert.ok(concept.prompt.length > 50);
    assert.equal(concept.criteria.length, 3);
    assert.ok(concept.benchmark.length > 80);
  }
});

test('invalid stored state becomes a complete safe progress record', () => {
  const progress = normaliseProgress({
    c1: { rating: 'nonsense', attempts: -4, lastPractised: 'not-a-date' },
    c2: { rating: 'nearly', attempts: 2.9, lastPractised: '2026-08-06T00:00:00.000Z' },
    c3: { attempts: 'Infinity' },
    c4: { attempts: 1e309 },
    c5: { attempts: Number.MAX_SAFE_INTEGER + 1 },
  });

  assert.deepEqual(progress.c1, { rating: 'unseen', attempts: 0, lastPractised: null });
  assert.deepEqual(progress.c2, {
    rating: 'nearly',
    attempts: 2,
    lastPractised: '2026-08-06T00:00:00.000Z',
  });
  assert.equal(progress.c3.attempts, 0);
  assert.equal(progress.c4.attempts, 0);
  assert.equal(progress.c5.attempts, 0);
  assert.equal(Object.keys(progress).length, 8);
});

test('a seven-lesson progress record gains the new lesson without losing mastery', () => {
  const oldProgress = Object.fromEntries(CONCEPTS.slice(0, 7).map(concept => [
    concept.id,
    { rating: 'can-teach', attempts: concept.number, lastPractised: `2026-08-${String(concept.number).padStart(2, '0')}T00:00:00.000Z` },
  ]));

  const progress = normaliseProgress(oldProgress);

  assert.equal(progress.c1.rating, 'can-teach');
  assert.equal(progress.c7.attempts, 7);
  assert.deepEqual(progress.c8, { rating: 'unseen', attempts: 0, lastPractised: null });
});

test('rating a concept increments attempts without mutating the previous state', () => {
  const before = normaliseProgress({});
  const after = recordRating(before, 'c1', 'can-teach', '2026-08-06T00:15:00.000Z');

  assert.equal(before.c1.rating, 'unseen');
  assert.deepEqual(after.c1, {
    rating: 'can-teach',
    attempts: 1,
    lastPractised: '2026-08-06T00:15:00.000Z',
  });
});

test('next practice selects the weakest and then the stalest concept', () => {
  let progress = normaliseProgress({});
  assert.equal(chooseNextConcept(progress).id, 'c1');
  progress = recordRating(progress, 'c1', 'can-teach', '2026-08-06T00:00:00.000Z');
  assert.equal(chooseNextConcept(progress).id, 'c2');

  for (const concept of CONCEPTS.slice(1)) {
    progress = recordRating(progress, concept.id, 'can-teach', `2026-08-${String(concept.number + 5).padStart(2, '0')}T00:00:00.000Z`);
  }
  assert.equal(chooseNextConcept(progress).id, 'c1');
});

test('the programme is eight consecutive two-week periods', () => {
  const schedule = buildSchedule('2026-08-10');

  assert.equal(schedule.length, 8);
  assert.deepEqual(
    { start: schedule[0].start, end: schedule[0].end, weeks: [schedule[0].weekStart, schedule[0].weekEnd] },
    { start: '2026-08-10', end: '2026-08-23', weeks: [1, 2] },
  );
  assert.deepEqual(
    { start: schedule[7].start, end: schedule[7].end, weeks: [schedule[7].weekStart, schedule[7].weekEnd] },
    { start: '2026-11-16', end: '2026-11-29', weeks: [15, 16] },
  );
  assert.throws(() => buildSchedule('2026-02-31'), /invalid/);
});

test('summary separates publication from actual self-rated mastery', () => {
  let progress = normaliseProgress({});
  progress = recordRating(progress, 'c1', 'can-teach');
  progress = recordRating(progress, 'c2', 'nearly');

  assert.deepEqual(progressSummary(progress), {
    unseen: 6,
    'not-yet': 0,
    nearly: 1,
    'can-teach': 1,
    attempts: 2,
    mastered: 1,
    total: 8,
  });
});

test('the page and model keep the same eight concept identities', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const app = await readFile(new URL('../app.js', import.meta.url), 'utf8');
  const ids = [...html.matchAll(/data-concept-id="(c\d)"/g)].map(match => match[1]);

  assert.deepEqual(ids, CONCEPTS.map(concept => concept.id));
  assert.match(html, /Practice out loud/);
  assert.match(html, /16-week programme/);
  assert.doesNotMatch(html, /8\/8 drafted/);
  assert.doesNotMatch(html, /\son(?:click|input)=/);
  assert.ok(app.includes('`${summary.mastered}/${summary.total} can teach'));
  assert.ok(app.includes('`Concept ${concept.number} of ${CONCEPTS.length} ·'));
  assert.doesNotMatch(app, /(?:of |\/)7/);
});
