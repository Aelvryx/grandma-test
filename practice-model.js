export const RATING_ORDER = Object.freeze({
  unseen: 0,
  'not-yet': 1,
  nearly: 2,
  'can-teach': 3,
});

export const RATING_LABELS = Object.freeze({
  unseen: 'Not practised',
  'not-yet': 'Not yet',
  nearly: 'Nearly there',
  'can-teach': 'Can teach',
});

export const CONCEPTS = Object.freeze([
  {
    id: 'c1',
    number: 1,
    title: 'Surplus Value',
    prompt: 'Without blaming greed or a uniquely bad boss, explain where capitalist profit comes from.',
    criteria: [
      'Labour creates new value beyond the inputs used.',
      'The wage is less than the new value the worker creates.',
      'Ownership of the means of production lets the owner keep the gap.',
    ],
    benchmark: 'Surplus value is the difference between what workers produce and what they are paid, and it is the source of capitalist profit.',
  },
  {
    id: 'c2',
    number: 2,
    title: 'Dialectical Materialism',
    prompt: 'Why are capitalism’s enormous wealth and enormous poverty connected rather than separate accidents?',
    criteria: [
      'Reality is a changing process, not a fixed snapshot.',
      'Internal contradictions drive change.',
      'Material conditions shape ideas, while ideas can feed back into material life.',
    ],
    benchmark: 'Reality is made of connected processes driven by contradictions, with the material organisation of life as the foundation and ideas acting back upon it.',
  },
  {
    id: 'c3',
    number: 3,
    title: 'Commodity Fetishism',
    prompt: 'How does a price tag make a relationship between people look like a property of a thing?',
    criteria: [
      'Human labour and social relations disappear from view.',
      'Value appears to belong naturally to the commodity itself.',
      'The hidden relationship makes exploitation harder to see.',
    ],
    benchmark: 'Commodity fetishism hides the people and labour behind exchange, so social relationships appear as natural relationships between priced things.',
  },
  {
    id: 'c4',
    number: 4,
    title: 'Base and Superstructure',
    prompt: 'Why can a progressive law leave the underlying social order intact—and why do politics and ideas still matter?',
    criteria: [
      'The base is production, ownership and class relations.',
      'Law, politics and culture are shaped by that base.',
      'The relationship is dialectical: organised political power can change ownership.',
    ],
    benchmark: 'The economic base shapes law, politics and culture, but the superstructure can act back on the base, so durable change ultimately has to transform material ownership and power.',
  },
  {
    id: 'c5',
    number: 5,
    title: 'Primitive Accumulation',
    prompt: 'Where did the first capital and the propertyless working class come from before ordinary market exchange could produce either?',
    criteria: [
      'Common land and resources were enclosed or seized by force.',
      'Colonialism and slavery accumulated wealth for early capital.',
      'Dispossession created workers compelled to sell their labour.',
    ],
    benchmark: 'Primitive accumulation is the violent separation of people from shared land and resources that created both concentrated capital and a working class forced to sell its labour.',
  },
  {
    id: 'c6',
    number: 6,
    title: 'Labour Theory of Value',
    prompt: 'Why can supply and demand explain price movement without explaining why a Ferrari and a bicycle have radically different price baselines?',
    criteria: [
      'Value is anchored in socially necessary labour time, not any individual effort.',
      'Technology and average productivity determine what labour is socially necessary.',
      'Supply and demand move prices around that value rather than creating the baseline from nothing.',
    ],
    benchmark: 'Commodity value is regulated by the socially necessary labour time required to reproduce it, while supply and demand explain short-run movement around that centre of gravity.',
  },
  {
    id: 'c7',
    number: 7,
    title: 'Imperialism',
    prompt: 'Why does mature capitalism export capital and divide the world instead of simply selling more goods at home?',
    criteria: [
      'Competition concentrates into monopoly and finance capital.',
      'Surplus capital seeks new markets, resources and cheaper labour abroad.',
      'States and monopolies divide territory and transfer value from periphery to centre.',
    ],
    benchmark: 'Imperialism is the monopoly stage of capitalism in which finance capital must expand abroad, exporting capital and organising the world to transfer value from the periphery to the centre.',
  },
]);

function validDate(value) {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

export function normaliseProgress(raw) {
  const source = raw && typeof raw === 'object' ? raw : {};
  return Object.fromEntries(CONCEPTS.map(concept => {
    const entry = source[concept.id] && typeof source[concept.id] === 'object'
      ? source[concept.id]
      : {};
    const rating = Object.hasOwn(RATING_ORDER, entry.rating)
      ? entry.rating
      : 'unseen';
    return [concept.id, {
      rating,
      attempts: Math.max(0, Math.floor(Number(entry.attempts) || 0)),
      lastPractised: validDate(entry.lastPractised) ? entry.lastPractised : null,
    }];
  }));
}

export function recordRating(progress, conceptId, rating, practisedAt = new Date().toISOString()) {
  if (!CONCEPTS.some(concept => concept.id === conceptId)) {
    throw new Error(`Unknown concept: ${conceptId}`);
  }
  if (!Object.hasOwn(RATING_ORDER, rating) || rating === 'unseen') {
    throw new Error(`Invalid practice rating: ${rating}`);
  }

  const current = normaliseProgress(progress);
  return {
    ...current,
    [conceptId]: {
      rating,
      attempts: current[conceptId].attempts + 1,
      lastPractised: practisedAt,
    },
  };
}

export function chooseNextConcept(progress, excludeId = null) {
  const current = normaliseProgress(progress);
  const candidates = CONCEPTS.filter(concept => concept.id !== excludeId);
  return [...candidates].sort((left, right) => {
    const leftEntry = current[left.id];
    const rightEntry = current[right.id];
    const ratingDifference = RATING_ORDER[leftEntry.rating] - RATING_ORDER[rightEntry.rating];
    if (ratingDifference !== 0) return ratingDifference;

    const leftTime = leftEntry.lastPractised ? Date.parse(leftEntry.lastPractised) : 0;
    const rightTime = rightEntry.lastPractised ? Date.parse(rightEntry.lastPractised) : 0;
    if (leftTime !== rightTime) return leftTime - rightTime;
    return left.number - right.number;
  })[0] ?? CONCEPTS[0];
}

function isoDay(date) {
  return date.toISOString().slice(0, 10);
}

export function buildSchedule(startDate) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate ?? '')) {
    throw new Error('Programme start must be an ISO date');
  }
  const start = new Date(`${startDate}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || isoDay(start) !== startDate) {
    throw new Error('Programme start is invalid');
  }

  return CONCEPTS.map((concept, index) => {
    const periodStart = new Date(start);
    periodStart.setUTCDate(periodStart.getUTCDate() + (index * 14));
    const periodEnd = new Date(periodStart);
    periodEnd.setUTCDate(periodEnd.getUTCDate() + 13);
    return {
      ...concept,
      start: isoDay(periodStart),
      end: isoDay(periodEnd),
      weekStart: (index * 2) + 1,
      weekEnd: (index * 2) + 2,
    };
  });
}

export function progressSummary(progress) {
  const current = normaliseProgress(progress);
  const counts = Object.values(current).reduce((summary, entry) => {
    summary[entry.rating] += 1;
    summary.attempts += entry.attempts;
    return summary;
  }, { unseen: 0, 'not-yet': 0, nearly: 0, 'can-teach': 0, attempts: 0 });

  return {
    ...counts,
    mastered: counts['can-teach'],
    total: CONCEPTS.length,
  };
}
