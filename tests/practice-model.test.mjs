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

test('the practice contract covers all seven lessons exactly once', () => {
  assert.equal(CONCEPTS.length, 7);
  assert.deepEqual(CONCEPTS.map(concept => concept.number), [1, 2, 3, 4, 5, 6, 7]);
  assert.equal(new Set(CONCEPTS.map(concept => concept.id)).size, 7);
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
  assert.equal(Object.keys(progress).length, 7);
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

test('the programme is seven consecutive two-week periods', () => {
  const schedule = buildSchedule('2026-08-10');

  assert.equal(schedule.length, 7);
  assert.deepEqual(
    { start: schedule[0].start, end: schedule[0].end, weeks: [schedule[0].weekStart, schedule[0].weekEnd] },
    { start: '2026-08-10', end: '2026-08-23', weeks: [1, 2] },
  );
  assert.deepEqual(
    { start: schedule[6].start, end: schedule[6].end, weeks: [schedule[6].weekStart, schedule[6].weekEnd] },
    { start: '2026-11-02', end: '2026-11-15', weeks: [13, 14] },
  );
  assert.throws(() => buildSchedule('2026-02-31'), /invalid/);
});

test('summary separates publication from actual self-rated mastery', () => {
  let progress = normaliseProgress({});
  progress = recordRating(progress, 'c1', 'can-teach');
  progress = recordRating(progress, 'c2', 'nearly');

  assert.deepEqual(progressSummary(progress), {
    unseen: 5,
    'not-yet': 0,
    nearly: 1,
    'can-teach': 1,
    attempts: 2,
    mastered: 1,
    total: 7,
  });
});

test('the page and model keep the same seven concept identities', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const ids = [...html.matchAll(/data-concept-id="(c\d)"/g)].map(match => match[1]);

  assert.deepEqual(ids, CONCEPTS.map(concept => concept.id));
  assert.match(html, /Practice out loud/);
  assert.match(html, /14-week programme/);
  assert.doesNotMatch(html, /7\/7 drafted/);
  assert.doesNotMatch(html, /\son(?:click|input)=/);
});
