// Your roadmap — the board after onboarding (direction B, round 1).
// The map zooms in three fixed stops (Whole road · Level · Tile) and fits the space it has; the road ahead is laid
// out in time (a ruler of years beside it, slabs as long as the step lasts); one press opens a tile in the card and
// the card's buttons act; the steps ahead are dark but named. Phone: a vertical road first, the map one tap away.
// `scene` draws each board of the round: course · city · first · swapping · swapped · added · read · cost · career · empty · loading.
// All figures are mock.
const BADGES = {
  offerings: { k: 'Several offerings', v: '3 intakes', exp: 'February, July and November 2027. Same course and trade-offs, so they share one tile.', icon: 'layers' },
  ielts: { k: 'Condition', v: 'IELTS 6.5 by March', exp: 'Entry needs 6.5 overall. You have 7.0, so it’s met.', icon: 'alert' },
  fork: { k: 'Fork ahead', v: 'at the 485', exp: 'After the 485 there are two ways to PR.', icon: 'split' },
  over: { k: 'Condition', v: 'Over budget by AUD 3.5k', exp: 'Your budget is AUD 30k a year for fees, roughly. This course is AUD 33.5k a year.', icon: 'alert' },
  maths: { k: 'Condition', v: 'Maths unit in year 1', exp: 'UWA asks business graduates to take one statistics bridging unit.', icon: 'alert' }
};
// Years along the road: Feb 2027 sits at gx 10; one year is 1.6 grid units.
const YEAR0 = 2027 + 1 / 12, GX0 = 10, YU = 1.6;
const gxAt = (y) => GX0 + (y - YEAR0) * YU;
// Sample "legible" (prop sample="legible"): every tile says what it is (a kind word, and an icon on its top face),
// labels hang on a short line to their tile, the key shows on first visit, trade-offs read in plain words,
// and the two ways to PR leave the 485 as a fork, both heading forward. Off, the board is unchanged.
const circ = (cx, cy, r) => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;
const ICO = {
  you: ['M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2', circ(12, 7, 4)],
  flag: ['M4 22V4a1 1 0 0 1 .4-.8A6 6 0 0 1 8 2c3 0 5 2 7.333 2q2 0 3.067-.8A1 1 0 0 1 20 4v10a1 1 0 0 1-.4.8A6 6 0 0 1 16 16c-3 0-5-2-8-2a6 6 0 0 0-4 1.528'],
  globe: [circ(12, 12, 10), 'M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20', 'M2 12h20'],
  city: ['M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z', 'M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2', 'M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2', 'M10 6h4', 'M10 10h4', 'M10 14h4', 'M10 18h4'],
  course: ['M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z', 'M22 10v6', 'M6 12.5V16a6 3 0 0 0 12 0v-3.5'],
  visa: ['M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z', 'M14 2v4a2 2 0 0 0 2 2h4', 'm9 15 2 2 4-4'],
  study: ['M12 7v14', 'M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z'],
  work: ['M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16', 'M4 6h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z'],
  fork: ['M16 3h5v5', 'M8 3H3v5', 'M12 22v-8.3a4 4 0 0 0-1.172-2.872L3 3', 'm15 9 6-6'],
  more: ['M5 12h14', 'M12 5v14']
};
// what a tile is, in a word, and its icon
const lgKind = (t) => {
  const id = t.id;
  if (id === 'a') return ['You', 'you'];
  if (id === 'pr' || id === 's191') return ['Point B', 'flag'];
  if (id === 'au') return ['Country', 'globe'];
  if (id === 'dest') return ['Not picked yet', 'globe'];
  if (id === 'jn') return ['Fork', 'fork'];
  if (t.kind === 'stack') return ['Not looked at', 'more'];
  if (t.kind === 'place') return [t.state === 'alt' ? 'Other city' : 'City', 'city'];
  if (t.kind === 'course') return [t.state === 'alt' ? 'Other course' : 'Course', 'course'];
  if (id === 'ms') return ['Study', 'study'];
  if (id === 'g485') return ['Work visa', 'work'];
  return ['Visa', 'visa'];
};
// trade-offs in plain words: "Good for" and "Less good for", on their own lines
const plain = (x) => !x ? x : x.replace(/▲ Strong on what you weight most: /g, 'Good for what matters most to you: ').replace(/▲ Strong on /g, 'Good for: ').replace(/▼ Costs you on: /g, 'Less good for: ').replace(/(: |, |and )(Career|Cost|Location|Work|Time|Place)\b/g, (m0, a, w) => a + w.toLowerCase()).replace(/ · Less good/g, '\nLess good');
// kind: point · place · course · step · stack · slab. state: lit · here · alt · next · fog · seen (looked at, dim)
// lab: label position per zoom stop (road · level · tile)
const BASE = [
  { id: 'a', kind: 'point', gx: 0, gy: 0, state: 'lit', kicker: 'You', name: 'Point A', short: 'Point A', sub: 'Business degree · 72% · IELTS 7.0 · AUD 36.5k a year for fees.', lab: { road: 'above', level: 'above', tile: 'none' } },
  { id: 'au', kind: 'place', gx: 2.4, gy: 0, state: 'lit', name: 'Australia', short: 'Australia · 19 cities', sub: '19 cities to choose from.', lab: { road: 'none', level: 'none', tile: 'none' } },
  { id: 'perth', kind: 'place', gx: 4.8, gy: 0, state: 'lit', name: 'Perth', short: 'Perth · 15 courses', sub: 'Curtin Bentley: about 25 min from Anjali in Cannington', lab: { road: 'above', level: 'above', tile: 'above' } },
  { id: 'adl', kind: 'place', gx: 4.8, gy: 2.6, state: 'alt', name: 'Adelaide', sub: 'Nepali community: moderate · 3½-hour flight from Anjali', why: '▲ Strong on Cost, PR · ▼ Costs you on: Career', level: 'city', lab: { road: 'none', level: 'left', tile: 'none' } },
  { id: 'cstack', kind: 'stack', gx: 4.8, gy: 5.2, state: 'alt', name: '17 more cities', sub: '4 match well', level: 'city', lab: { road: 'none', level: 'below', tile: 'none' } },
  { id: 'cyber', kind: 'course', gx: 7.2, gy: 0, state: 'here', name: 'Cyber Security', short: 'Cyber Security', sub: 'ECU · Perth', why: '▲ Strong on PR, Career · ▼ Costs you on: Location', badges: ['offerings', 'ielts', 'fork'], level: 'course', lab: { road: 'below', level: 'below', tile: 'below' } },
  { id: 'ds', kind: 'course', gx: 7.2, gy: -2.6, state: 'alt', name: 'Data Science', sub: 'UWA · Perth', why: '▲ Strong on Career · ▼ Costs you on: Cost, PR', badges: ['maths'], level: 'course', lab: { road: 'none', level: 'right', tile: 'none' } },
  { id: 'kstack', kind: 'stack', gx: 7.2, gy: -5.2, state: 'alt', name: '13 more in Perth', sub: '3 match well', level: 'course', lab: { road: 'none', level: 'above', tile: 'none' } },
  { id: 's500', kind: 'step', gx: 9.0, gy: 0, state: 'next', name: 'Student visa · 500', short: 'Student visa', when: 'Late 2026', lab: { road: 'none', level: 'right', tile: 'right' } },
  { id: 'ms', kind: 'slab', gx: GX0, gx1: gxAt(2029) - 0.15, gy: 0, state: 'fog', name: 'Master’s · Cyber Security', short: 'Master’s', when: 'Feb 2027 – Dec 2028', lab: { road: 'below', level: 'below', tile: 'none' } },
  { id: 'g485', kind: 'slab', gx: gxAt(2029), gx1: gxAt(2031) - 0.15, gy: 0, state: 'fog', name: 'Graduate visa · 485', short: '485', when: 'From 2029', lab: { road: 'below', level: 'none', tile: 'none' } },
  { id: 's190', kind: 'step', gx: gxAt(2031) + 0.35, gy: 0, state: 'fog', name: '190 · state nomination', short: '190', when: '2031', lab: { road: 'above', level: 'none', tile: 'none' } },
  { id: 'pr', kind: 'point', gx: gxAt(2032), gy: 0, state: 'fog', kicker: 'Point B', name: 'Permanent residency', short: 'Permanent residency', when: '2032', lab: { road: 'right', level: 'none', tile: 'none' } },
  { id: 's491', kind: 'slab', gx: gxAt(2031) + 0.35, gx1: gxAt(2034) - 0.15, gy: 1.9, w: 0.3, state: 'fog', name: '491 · regional', short: '491 · regional', when: '2031 – 2034', branch: true, lab: { road: 'below', level: 'none', tile: 'none' } },
  { id: 's191', kind: 'point', gx: gxAt(2034) + 0.3, gy: 1.9, sz: 0.46, state: 'fog', name: '191 · permanent', short: '191 · permanent', when: '2034', branch: true, lab: { road: 'below', level: 'none', tile: 'none' } }
];
const SIZE = { point: 0.6, place: 0.72, course: 0.72, step: 0.42, stack: 0.66, slab: 0.42, fork: 0.22 };
const DEPTH = { point: 0.34, place: 0.26, course: 0.26, step: 0.16, stack: 0.14, slab: 0.16, fork: 0.1 };
const WEIGHTS = [['Cost', 2], ['Time', 1], ['Work', 2], ['PR', 3], ['Place', 1], ['Career', 3]];
const STOPS = ['road', 'level', 'tile'];
const STOP_NAME = { road: 'Whole road', level: 'Level', tile: 'Tile' };
const FUTURES = [['course', 'Built around staying'], ['cost', 'Built around cost'], ['career', 'Built around career']];
const LOOK = { kicker: 'Look ahead · the duck stays · Route step', primary: 'Open route detail at this step' };
// a pressed tile's card (one press opens it; the buttons act)
const CARD = {
  a: { kicker: 'Point A · You', sub: 'Where you start', guide: 'Business degree · 72% · IELTS 7.0 · AUD 36.5k a year for fees.', because: 'Where you start' },
  au: { kicker: 'Visited · Destination', sub: '19 cities to choose from.', because: 'The country you picked', primary: 'Go to Australia' },
  perth: { kicker: 'Visited · City', sub: 'Western Australia', g: '▲ Strong on PR, Work', c: '▼ Costs you on: Location', guide: 'A capital that counts as regional: extra points and the longest post-study stay. Curtin Bentley: about 25 min from Anjali in Cannington · ECU Joondalup: about 50 min.', because: 'The city you picked', primary: 'Go to Perth' },
  adl: { kicker: 'Not visited · City', sub: 'South Australia', g: '▲ Strong on Cost, PR', c: '▼ Costs you on: Career', guide: 'Nepali community: moderate. A 3½-hour flight from Anjali in Perth.', because: 'The next closest fit: swap it onto your roadmap', primary: 'Swap onto your roadmap' },
  cstack: { kicker: 'Stack · City', sub: '4 match well', guide: 'The other cities in Australia.', because: 'Every city you haven’t looked at yet', primary: 'Show 17 more cities' },
  cyber: { kicker: 'Visited · Course', sub: 'ECU · Perth', g: '▲ Strong on PR, Career', c: '▼ Costs you on: Location', guide: 'ECU Joondalup: about 50 min from Anjali in Cannington.', because: 'The course you were on', primary: 'Swap onto your roadmap' },
  ds: { kicker: 'Not visited · Course', sub: 'UWA · Perth', g: '▲ Strong on Career', c: '▼ Costs you on: Cost, PR', guide: 'Strong demand in WA, but a bigger step from business. The road ahead re-routes through UWA.', because: 'The next closest fit: swap it onto your roadmap', primary: 'Swap onto your roadmap' },
  kstack: { kicker: 'Stack · Course', sub: '3 match well', guide: 'The other courses in Perth. Some aren’t reachable yet; the list says why.', because: 'Every course in Perth you haven’t looked at yet', primary: 'Show 13 more courses' },
  s500: Object.assign({ sub: 'Late 2026', guide: 'Lodge once the offer and health cover are in hand.', because: 'The next step on your roadmap' }, LOOK),
  ms: Object.assign({ sub: 'Feb 2027 – Dec 2028', guide: 'Feb 2027 – Dec 2028, with an industry capstone.', because: 'The course you’re on', lesson: true }, LOOK),
  g485: Object.assign({ sub: 'From 2029', guide: 'Up to five years of work rights.', because: 'It follows the Master’s' }, LOOK),
  s190: Object.assign({ sub: '2031', guide: 'WA nominates you on your regional work years.', because: 'One of 2 ways to PR from the 485' }, LOOK),
  pr: Object.assign({ sub: 'Point B · 2032', guide: 'Point B for this road.', because: 'Where this road ends' }, LOOK),
  s491: Object.assign({ sub: '2031 – 2034', guide: 'Five-year provisional visa.', because: 'One of 2 ways to PR from the 485' }, LOOK),
  s191: Object.assign({ sub: '2034', guide: 'Permanent after three years of regional income.', because: 'It follows the 491' }, LOOK),
  is: { kicker: 'Added · from your stack · Course', sub: 'Curtin · Perth', guide: 'On your board, beside your roadmap.', because: 'You put it on your board', primary: 'Swap onto your roadmap' }
};
// where she is: the card (desktop) and the card inside the road (phone)
const HERE = {
  cyber: { kicker: 'You are here · Course', name: 'Cyber Security', sub: 'ECU · Perth', g: '▲ Strong on what you weight most: PR, Career', c: '▼ Costs you on: Cost (only AUD 3k spare) and Location (far from the east-coast job market).', guide: 'ECU Joondalup: about 50 min from Anjali in Cannington.', badges: ['offerings', 'ielts', 'fork'], because: 'The course you’re on', course: true, primary: 'Look ahead: Student visa · 500', secondary: 'Open route detail', sibsK: 'Also in Perth' },
  ds: { kicker: 'You are here · Course', name: 'Data Science', sub: 'UWA · Perth', g: '▲ Strong on Career', c: '▼ Costs you on: Cost, PR', guide: 'Strong demand in WA, but a bigger step from business. The road ahead re-routes through UWA.', badges: ['maths'], because: 'The course you’re on', course: true, primary: 'Look ahead: Student visa · 500', secondary: 'Open route detail', sibsK: 'Also in Perth' },
  perth: { kicker: 'You are here · City', name: 'Perth', sub: 'Western Australia', g: '▲ Strong on PR, Work', c: '▼ Costs you on: Location', guide: 'A capital that counts as regional: extra points and the longest post-study stay. Curtin Bentley: about 25 min from Anjali in Cannington · ECU Joondalup: about 50 min.', badges: [], because: 'The city you picked', primary: 'Walk to Cyber Security', sibsK: 'Also in Australia' },
  'cyber-cost': { kicker: 'You are here · Course', name: 'Cyber Security', sub: 'UniSA · Adelaide', g: '▲ Strong on Cost, PR', c: '▼ Costs you on: Career', guide: 'An illustrative road, drawn in the same shape as yours.', badges: [], because: 'Built around cost', course: true, primary: 'Look ahead: Student visa · 500', secondary: 'Open route detail', sibsK: '' },
  'cyber-career': { kicker: 'You are here · Course', name: 'Cyber Security', sub: 'UTS · Sydney', g: '▲ Strong on Career', c: '▼ Costs you on: Cost', guide: 'An illustrative road, drawn in the same shape as yours.', badges: [], because: 'Built around career', course: true, primary: 'Look ahead: Student visa · 500', secondary: 'Open route detail', sibsK: '' },
  au: { kicker: 'You are here · Destination', name: 'Australia', sub: '19 cities to choose from.', guide: '', badges: [], because: 'The country you picked', primary: 'Go to Perth', sibsK: '' },
  a: { kicker: 'You are here · Point A', name: 'Point A', sub: 'Business degree · 72% · IELTS 7.0 · AUD 36.5k a year for fees.', guide: 'Your roadmap starts here. Pick a destination to draw the rest.', badges: [], because: 'Where you start', primary: 'Pick a destination', sibsK: '' }
};
const STACK = [
  { name: 'Information Systems', sub: 'Curtin · Perth', tag: 'Match well' },
  { name: 'Business Analytics', sub: 'ECU · Perth', tag: 'Match well' },
  { name: 'Computer Science', sub: 'Murdoch · Perth', tag: 'Match well' },
  { name: 'Accounting', sub: 'Curtin · Perth', tag: '' },
  { name: 'Master of Nursing', sub: 'Curtin · Needs a health bachelor’s', tag: 'Not yet reachable', blocked: true }
];
const KEY_PRESS = [['Place tile', 'Opens it. Go here from the card.'], ['Stack', 'Opens it. Show more from the card.'], ['Route step', 'Look ahead. The duck stays put.'], ['Control', 'Does what its label says, always in the same place.']];
const KEY_LIGHT = [['lit', 'Visited · lit'], ['alt', 'Not visited · dim'], ['fog', 'Unexplored · dark, named'], ['hatch', 'Not yet reachable · hatched'], ['dot', 'Dotted outline · data unknown or out of date']];
const OVERVIEW = ['Australia · 19 cities · 3 looked at', 'Perth · 15 courses · 3 looked at', 'Cyber Security · 3 intakes · walked', 'Permanent residency · 2 ways from the 485'];
// Point A is built from her answers: each one can be changed from here
// Your answers: every onboarding answer, opened over the live board. Mock effects (Priya).
// eff(v) → { lines: [what would move, in words], prev: { tileId: 'what changes' } } ; none → nothing on the road changes
const NONE = { lines: ['Nothing on your roadmap changes.'], prev: {} };
const ANS = [
  { n: '00', name: 'Your comic character', rows: [{ id: 'character', q: 'Your comic character', a: 'female', opts: [['male', 'Male'], ['female', 'Female'], ['none', 'Prefer not to say']], why: 'It decides how your comic character looks. It never changes your roadmap.', eff: () => NONE }] },
  { n: '01', name: 'Facts about you', rows: [
    { id: 'location', q: 'Where are you right now?', a: 'Nepal' },
    { id: 'budget', q: 'Your budget per year', sub: 'Amount', a: '36', opts: [['24', 'AUD 24k'], ['30', 'AUD 30k'], ['36', 'AUD 36k'], ['42', 'AUD 42k'], ['unsure', 'Not sure']], why: 'It decides which cities stay open on each route. A rough number is fine.', tail: ' · fees only · roughly',
      eff: (v) => ({ '24': { lines: ['Perth is marked as a stretch on your budget.', 'Cyber Security goes AUD 9.5k a year over it.'], prev: { perth: 'A stretch on your budget', cyber: 'AUD 9.5k a year over budget' } },
        '30': { lines: ['Perth is marked as a stretch on your budget.', 'Cyber Security goes AUD 3.5k a year over it.'], prev: { perth: 'A stretch on your budget', cyber: 'AUD 3.5k a year over budget' } },
        '42': { lines: ['Nothing on your roadmap moves. Sydney and Melbourne are no longer a stretch.'], prev: {} },
        'unsure': { lines: ['I’ll assume AUD 30k, roughly, and show it as a chip you can change.', 'Perth is marked as a stretch on your budget.'], prev: { perth: 'A stretch on your budget (assumed AUD 30k)' } } })[v] || NONE },
    { id: 'timing', q: 'Timing', a: 'Earliest Feb 2027 · latest Jul 2027 · up to 2 years' },
    { id: 'coming', q: 'Anyone coming with you?', a: 'No one' },
    { id: 'qual', q: 'Last qualification', a: 'Bachelor’s · 72%' },
    { id: 'english', q: 'English test', a: '70', opts: [['65', 'IELTS 6.5'], ['70', 'IELTS 7.0'], ['75', 'IELTS 7.5 or more'], ['none', 'Not taken yet']], why: 'It decides whether a route needs an English course or a pathway first.',
      eff: (v) => v === 'none' ? { lines: ['Cyber Security’s entry condition is no longer met: it asks for IELTS 6.5 by March.'], prev: { cyber: 'Needs IELTS 6.5 by March' } } : { lines: ['Nothing on your roadmap changes. Cyber Security asks for 6.5, so it’s still met.'], prev: {} } }
  ] },
  { n: '02', name: 'What you’d study', rows: [
    { id: 'know', q: 'Do you know what you want to study?', a: 'Something particular · Cyber security' },
    { id: 'level', q: 'Study level', a: 'Master’s' },
    { id: 'learn', q: 'How you like to learn', a: 'Hands-on with placements' },
    { id: 'length', q: 'Course length you’d prefer', a: 'Fine with longer if it opens more' }
  ] },
  { n: '03', name: 'Where and how you’d live', rows: [
    { id: 'dest', q: 'Destination', a: 'Australia' },
    { id: 'place', q: 'Kind of place', a: 'City' },
    { id: 'community', q: 'Does a community of similar culture, or relatives nearby, matter?', a: 'Yes' },
    { id: 'person', q: 'Who, and where?', a: 'Anjali, cousin · Cannington, Perth', personal: true },
    { id: 'climate', q: 'Climate (optional)', a: '', open: 'Skipped', opts: [['mild', 'Mild'], ['warm', 'Warm'], ['nopref', 'No preference']], why: 'Noted for later. Climate doesn’t change your board in this preview.', eff: () => NONE }
  ] },
  { n: '04', name: 'After you graduate', rows: [
    { id: 'stay', q: 'Would you want to stay after?', a: 'Yes' },
    { id: 'focus', q: 'Career-focused or academic?', a: 'Career-focused' },
    { id: 'earn', q: 'Do you need to earn while studying?', a: 'Yes' },
    { id: 'settle', q: 'Settle long-term, or come home eventually? (optional)', a: '', open: 'Skipped' }
  ] },
  { n: '05', name: 'Your attention', rows: [{ id: 'coins', q: 'Your ten coins', a: '', open: '10 coins to spend' }] }
];
const ANS_ROW = {}; ANS.forEach(g => g.rows.forEach(r => { ANS_ROW[r.id] = r; }));
const ansLabel = (r, v) => { if (!r.opts) return r.a; const o = r.opts.find(x => x[0] === v); return o ? o[1] + (r.tail && v !== 'unsure' ? r.tail : '') : ''; };
const A_FACTS = [['Where are you right now?', 'Nepal'], ['Your budget per year', 'AUD 36k a year, fees only, roughly'], ['Your qualifications and scores', 'Bachelor’s · 72% · IELTS 7.0'], ['Timing', 'Earliest Feb 2027 · latest Jul 2027']];
// changing one answer from the board: Your budget per year · Amount (mock effects)
const AMOUNTS = [['24', 'AUD 24k'], ['30', 'AUD 30k'], ['36', 'AUD 36k'], ['42', 'AUD 42k'], ['unsure', 'Not sure']];
const BUDGET_IF = { '24': 'Perth is marked as a stretch; Cyber Security goes AUD 9.5k a year over your budget.', '30': 'Perth is marked as a stretch; Cyber Security goes AUD 3.5k a year over your budget.', '42': 'Nothing on your roadmap moves.', 'unsure': 'I’ll assume AUD 30k, roughly: Perth is marked as a stretch.' };
const TOASTS = {
  budget: { text: 'Budget changed. Cyber Security now goes AUD 3.5k a year over it.', undo: true },
  nochange: { text: 'Saved. Nothing on your roadmap changes.', undo: false },
  swap: { text: 'Data Science is on your roadmap now. The road ahead re-routed through it.', undo: true },
  add: { text: 'Information Systems is on your board, beside your roadmap. Data Science folded into the stack.', undo: true },
  read: { text: 'Lesson read. The Master’s years now show as looked at.', undo: false },
  walk: { text: 'Walked to Perth', undo: true },
  walkc: { text: 'Walked to Cyber Security', undo: true },
  walkau: { text: 'Back at Australia', undo: true },
  back: { text: 'Back a step', undo: true },
  swapback: { text: 'Cyber Security is on your roadmap again. The road ahead re-routed through it.', undo: true },
  later: { text: 'Route detail comes in a later round.', undo: false },
  notdrawn: { text: 'Not drawn in this prototype. Try Data Science, or the 13 more in Perth.', undo: false },
  next: { text: 'Ask and Compare come in a later round.', undo: false }
};

// Arrival from "You're all set": the pond carries the duck across. Times in ms.
// morph 0–550 (the blue panel widens into the map, the end screen's words fade, the pond drifts to the map's centre);
// float until the road is ready (simulated 1500); tiles settle in road order (0.6s each, 70ms apart);
// the duck steps out of the water onto Australia; then the card fills and the hint starts.
// Arrival, round 2: a full-screen loader first. Three steps tick as the work behind each one finishes
// (here simulated; in the product each waits for its real event, and shows for at least 0.7s):
// reading her answers · drawing her first road · opening it. Then the loader fades over the board,
// the tiles settle in road order and the duck steps off the water onto Australia.
const ARR = { L1: 1300, L2: 2800, L3: 3900, FADE: 500, LOAD: 4100, STAG: 70, RISE: 600, HOP0: 5000, HOP1: 5450, END: 5750, PHOP0: 4700, PHOP1: 5150, PROWS: 5100 };
const LOAD_STEPS = ['Reading your answers', 'Drawing your first roadmap', 'Opening your roadmap'];
const FRAME_T = { read: 600, draw: 2000, open: 3400, reveal: 4650, land: 5300, slow: 2000, error: 2000 };
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const easeOut = (x) => 1 - Math.pow(1 - x, 3);

// Each board of the round is a scene: who is where, and what is lit.
function buildScene(scene, lg) {
  const W = BASE.map(t => Object.assign({}, t, { lab: Object.assign({}, t.lab) }));
  const by = (id) => W.find(t => t.id === id);
  const set = (id, o) => Object.assign(by(id), o);
  const drop = (id) => { const i = W.findIndex(t => t.id === id); if (i >= 0) W.splice(i, 1); };
  let m = { here: 'cyber', lit: ['a', 'au', 'perth', 'cyber'], next: ['cyber', 's500'], ahead: ['s500', 'ms', 'g485', 's190', 'pr'], fork: true, cityLine: ['perth', 'adl', 'cstack'], courseLine: ['cyber', 'ds', 'kstack'], open: 'course', levelIds: ['perth', 'adl', 'cstack', 'cyber', 'ds', 'kstack', 's500'], road: ['a', 'au', 'perth', 'cyber', 's500', 'ms', 'g485'], courseId: 'cyber', illustrative: false };
  if (scene === 'city') {
    set('perth', { state: 'here', lab: { road: 'above', level: 'below', tile: 'below' } });
    set('cyber', { state: 'next', lab: { road: 'below', level: 'right', tile: 'right' } });
    set('ds', { lab: { road: 'none', level: 'none', tile: 'none' } }); set('kstack', { lab: { road: 'none', level: 'none', tile: 'none' } });
    set('s500', { state: 'fog', lab: { road: 'none', level: 'none', tile: 'none' } });
    set('ms', { lab: { road: 'below', level: 'none', tile: 'none' } });
    Object.assign(m, { here: 'perth', lit: ['a', 'au', 'perth'], next: ['perth', 'cyber'], ahead: ['cyber', 's500', 'ms', 'g485', 's190', 'pr'], open: 'city', levelIds: ['au', 'perth', 'adl', 'cstack', 'cyber'] });
  }
  if (scene === 'first') {
    set('au', { state: 'here', lab: { road: 'below', level: 'below', tile: 'below' } });
    set('perth', { state: 'next', lab: { road: 'above', level: 'right', tile: 'right' } });
    ['adl', 'cstack', 'ds', 'kstack'].forEach(id => set(id, { lab: { road: 'none', level: 'none', tile: 'none' } }));
    set('cyber', { state: 'alt', lab: { road: 'none', level: 'none', tile: 'none' } });
    set('s500', { state: 'fog', lab: { road: 'none', level: 'none', tile: 'none' } });
    set('ms', { lab: { road: 'below', level: 'none', tile: 'none' } });
    Object.assign(m, { here: 'au', lit: ['a', 'au'], next: ['au', 'perth'], ahead: ['perth', 'cyber', 's500', 'ms', 'g485', 's190', 'pr'], open: null, levelIds: ['a', 'au', 'perth', 'adl', 'cstack'] });
  }
  if (scene === 'swapping') {
    // mid-move: the two tiles pass each other on a short arc; the duck rides the tile arriving on the road
    set('ds', { gx: 8.3, gy: -1.3, state: 'here', lab: { road: 'none', level: 'below', tile: 'right' } });
    set('cyber', { gx: 6.1, gy: -1.3, state: 'lit', lab: { road: 'none', level: 'above', tile: 'left' }, kicker: 'Visited' });
    set('ms', { name: 'Master’s · Data Science' });
    Object.assign(m, { here: 'ds', lit: ['a', 'au', 'perth'], next: null, courseLine: ['kstack'], arc: true, road: ['a', 'au', 'perth', 'ds', 's500', 'ms', 'g485'] });
  }
  if (scene === 'swapped') {
    set('ds', { gx: 7.2, gy: 0, state: 'here', lab: { road: 'below', level: 'below', tile: 'below' } });
    set('cyber', { gx: 7.2, gy: -2.6, state: 'lit', kicker: 'Visited', lab: { road: 'none', level: 'right', tile: 'none' } });
    set('ms', { name: 'Master’s · Data Science' });
    Object.assign(m, { here: 'ds', lit: ['a', 'au', 'perth', 'ds'], next: ['ds', 's500'], courseLine: ['ds', 'cyber', 'kstack'], courseId: 'ds', road: ['a', 'au', 'perth', 'ds', 's500', 'ms', 'g485'] });
  }
  if (scene === 'added') {
    drop('ds');
    W.push({ id: 'is', kind: 'course', gx: 7.2, gy: -2.6, state: 'alt', name: 'Information Systems', sub: 'Curtin · Perth', kicker: 'Added · from your stack', level: 'course', lab: { road: 'none', level: 'right', tile: 'none' } });
    Object.assign(m, { courseLine: ['cyber', 'is', 'kstack'], levelIds: ['perth', 'adl', 'cstack', 'cyber', 'is', 'kstack', 's500'] });
  }
  if (scene === 'budget-preview') {
    // the change isn't saved: what would move shows as dashed outlines, with "If you save"
    set('perth', { prev: 'A stretch on your budget' });
    set('cyber', { prev: 'AUD 3.5k a year over budget' });
  }
  if (scene === 'budget-saved') {
    set('a', { sub: 'Business degree · 72% · IELTS 7.0 · AUD 30k a year for fees.' });
    set('perth', { kicker: 'A stretch on your budget' });
    set('cyber', { why: '▲ Strong on PR, Career · ▼ Costs you on: Cost (AUD 3.5k a year over budget)', badges: ['over', 'offerings', 'ielts', 'fork'] });
    m.budgetSaved = true;
  }
  if (scene === 'read') { set('ms', { state: 'seen' }); set('g485', { state: 'seen', lab: { road: 'below', level: 'right', tile: 'none' } }); }
  if (scene === 'cost' || scene === 'career') {
    // illustrative futures: the same shape, a different road. No alternatives drawn.
    ['adl', 'cstack', 'ds', 'kstack', 's190', 's491', 's191'].forEach(drop);
    const cost = scene === 'cost';
    set('perth', { name: cost ? 'Adelaide' : 'Sydney', short: cost ? 'Adelaide' : 'Sydney', sub: cost ? 'South Australia' : 'New South Wales' });
    set('cyber', { sub: cost ? 'UniSA · Adelaide' : 'UTS · Sydney', badges: [] , why: cost ? '▲ Strong on Cost, PR · ▼ Costs you on: Career' : '▲ Strong on Career · ▼ Costs you on: Cost' });
    if (cost) {
      set('g485', { id: 'g491', name: '491 · regional', short: '491 · regional', when: '2029 – 2032', gx1: gxAt(2032) - 0.15 });
      set('pr', { name: '191 · permanent', short: '191 · permanent', gx: gxAt(2032) + 0.4, when: '2032' });
    } else {
      set('pr', { name: 'Employer sponsorship', short: 'Employer sponsorship', gx: gxAt(2031) + 0.4, kicker: 'Point B', when: '2031' });
    }
    Object.assign(m, { ahead: ['s500', 'ms', cost ? 'g491' : 'g485', 'pr'], fork: false, cityLine: [], courseLine: [], open: null, levelIds: ['au', 'perth', 'cyber', 's500'], road: ['a', 'au', 'perth', 'cyber', 's500', 'ms', cost ? 'g491' : 'g485', 'pr'], illustrative: true });
  }
  if (scene === 'empty') {
    W.splice(0, W.length, Object.assign({}, BASE[0], { state: 'here', lab: { road: 'left', level: 'left', tile: 'left' } }),
      { id: 'dest', kind: 'place', gx: 2.4, gy: 0, state: 'unknown', name: 'Destination', lab: { road: 'below', level: 'below', tile: 'below' } });
    Object.assign(m, { here: 'a', lit: ['a'], next: ['a', 'dest'], ahead: [], fork: false, cityLine: [], courseLine: [], open: null, levelIds: ['a', 'dest'], road: ['a'], noRuler: true });
  }
  if (scene === 'loading') { W.splice(0, W.length); Object.assign(m, { here: null, lit: [], next: null, ahead: [], fork: false, cityLine: [], courseLine: [], levelIds: [], road: [], noRuler: true }); }
  if (lg) {
    // every tile on her road is named at Level; names only, the card has the rest
    if (scene === 'first') set('perth', { lab: { road: 'above', level: 'above', tile: 'above' } });
    if (by('au') && by('au').lab.level === 'none') set('au', { lab: { road: 'above', level: 'above', tile: 'above' } });
    // Adelaide's name sits over Adelaide, not beside the stack
    if (by('adl') && by('adl').lab.level === 'left') set('adl', { lab: { road: 'none', level: 'above', tile: 'none' } });
    if (m.fork && by('s491') && by('g485')) {
      // the fork: a junction after the 485, then two lanes that both run forward.
      // The 190 lane carries on straight; the 491 lane bears away on the far side, so neither looks like a step back.
      const J = by('g485').gx1 + 0.35;
      W.push({ id: 'jn', kind: 'fork', gx: J, gy: 0, state: 'fog', name: '2 ways to PR', short: '2 ways to PR', lab: { road: 'none', level: 'above', tile: 'above' } });
      set('s190', { gx: J + 1.3, lab: { road: 'above', level: 'above', tile: 'above' } });
      set('pr', { gx: J + 2.7, lab: { road: 'below', level: 'below', tile: 'below' } });
      set('s491', { gx: J + 1.0, gy: -1.25, gx1: 20.9, gy1: -2.1, w: 0.26, lab: { road: 'above', level: 'above', tile: 'above' } });
      set('s191', { gx: 21.45, gy: -2.24, lab: { road: 'below', level: 'below', tile: 'below' } });
      ['ms', 'g485'].forEach(id => { const t = by(id); if (t) t.lab = Object.assign({}, t.lab, { road: t.lab.road === 'none' ? 'none' : 'above' }); });
      const i = m.ahead.indexOf('g485'); if (i >= 0) m.ahead = m.ahead.slice(0, i + 1).concat(['jn'], m.ahead.slice(i + 1));
      m.lgFork = true;
    }
  }
  return { W, m };
}

class Component extends DCLogic {
  constructor(props) {
    super(props);
    const z = props.zoom ?? 'level';
    this.state = { mw: 0, mh: 0, rw: 0, rs: 1, stop: STOPS.includes(z) ? z : 'level', cam: null, hover: null, selected: props.selected || null, open: {}, view: props.view ?? 'road', viewMenu: props.panel === 'key', panel: props.panel || null, toast: props.toast || null, ans: props.panel === 'answers', ansOpen: props.ansOpen || null, pending: props.pending ? JSON.parse(props.pending) : {}, ansAsk: !!props.ansAsk, ansDone: props.ansDone || null, ansVals: props.ansVals ? JSON.parse(props.ansVals) : {}, scene: props.scene || 'course', pick: props.scene === 'budget-preview' ? '30' : '36', menuOpen: !!props.menu, filter: 0, away: null, status: '' };
    // the legible board is the board now; sample="classic" draws the earlier one, for reference only
    this.lg = props.sample !== 'classic';
    // a new roadmap: a copy of another, opened with its answers ready to change
    if (props.draft) { this.state.panel = 'answers'; this.state.view = 'map'; }
    // the key shows on her first visit (and wherever a board asks for it), until she closes it
    this.state.lgKey = this.lg && !props.keyOff && (!!props.keyOn || props.panel === 'key' || (props.scene || 'course') === 'first');
    if (this.state.panel === 'key') { this.state.panel = null; this.state.viewMenu = false; }
    this.sc = buildScene(this.state.scene, this.lg);
    // arrival: live (arrive) or one frozen frame of it (frame)
    // an empty frame (the editor's default) means no frozen frame
    const fr = props.frame ? FRAME_T[props.frame] : undefined;
    this.state.t = typeof fr === 'number' ? fr : (props.arrive ? 0 : null);
  }
  play() {
    const done = () => {
      this.setState({ t: null, status: 'Your roadmap is ready' });
      setTimeout(() => { if (this.cardH && this.cardH.focus) this.cardH.focus({ preventScroll: true }); }, 0);
    };
    if (this.arrRaf) cancelAnimationFrame(this.arrRaf);
    this.setState({ status: LOAD_STEPS[0], loadErr: false });
    // reduced motion: the steps still tick as the work finishes, nothing moves; then the board in its final state
    const red = this.reduced();
    const t0 = performance.now();
    let said = 0;
    const tick = (now) => {
      const t = now - t0;
      if (t >= ARR.END || (red && t >= ARR.L3)) return done();
      // say each step once, for screen readers
      const k = t >= ARR.L2 ? 2 : t >= ARR.L1 ? 1 : 0;
      this.setState(k !== said ? { t, status: LOAD_STEPS[k] } : { t });
      said = k;
      this.arrRaf = requestAnimationFrame(tick);
    };
    this.arrRaf = requestAnimationFrame(tick);
  }
  componentDidMount() {
    this.watchOS();
    this.measure();
    try { this.ro = new ResizeObserver(() => this.measure()); if (this.rootEl) this.ro.observe(this.rootEl); } catch (e) {}
    this.scrollToHere();
    if (this.props.arrive && !this.props.frame) this.play();
  }
  componentWillUnmount() {
    if (this.arrRaf) cancelAnimationFrame(this.arrRaf);
    this.unwatchOS();
    try { if (this.ro) this.ro.disconnect(); } catch (e) {}
    if (this.raf) cancelAnimationFrame(this.raf);
    this.bindMap(null);
  }
  componentDidUpdate() {
    if (this.mapEl && this.ro && this.observed !== this.mapEl) { try { this.ro.observe(this.mapEl); } catch (e) {} this.observed = this.mapEl; this.measure(); }
    if (this.state.view !== this.lastView) { this.lastView = this.state.view; this.scrollToHere(); }
    if (this.state.scene !== this.lastScene) { this.lastScene = this.state.scene; this.sc = buildScene(this.state.scene, this.lg); }
  }
  scrollToHere() {
    // land on what changed: the added tile, the steps just read, otherwise where she is
    setTimeout(() => {
      const l = this.listEl; if (!l) return;
      const sc = this.state.scene;
      if (this.props.futures) { l.scrollTop = 0; return; }
      const r = (sc === 'read' && l.querySelector('.rb-row.s-seen')) || (sc === 'added' && l.querySelector('.rb-here .rb-sibs')) || this.hereRow;
      if (r) l.scrollTop = Math.max(0, l.scrollTop + r.getBoundingClientRect().top - l.getBoundingClientRect().top - (sc === 'read' || sc === 'added' ? 140 : 88));
      const n = this.hereRow && this.hereRow.querySelector('.rb-node'), root = this.rootEl;
      if (n && root) { const nb = n.getBoundingClientRect(), rb = root.getBoundingClientRect(); this.setState({ hnx: Math.round(nb.left - rb.left), hny: Math.round(nb.top - rb.top), hnw: Math.round(nb.width) }); }
    }, 0);
  }
  measure() {
    const m = this.mapEl, r = this.rootEl;
    if (!r) return;
    const fs = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    const mw = m ? Math.round(m.clientWidth) : 0, mh = m ? Math.round(m.clientHeight) : 0, rw = Math.round(r.clientWidth);
    const rb = r.getBoundingClientRect(), mb = m ? m.getBoundingClientRect() : rb;
    const ml = Math.round(mb.left - rb.left), mt = Math.round(mb.top - rb.top), rh = Math.round(r.clientHeight);
    const s = this.state;
    if (mw !== s.mw || mh !== s.mh || rw !== s.rw || fs / 16 !== s.rs || ml !== s.ml || mt !== s.mt || rh !== s.rh) {
      // the map fits the space it has: on any resize the camera re-fits the current stop
      const nd = { mw, mh, rw, rs: fs / 16, ml, mt, rh };
      this.setState(Object.assign({}, nd, { cam: this.target(s.stop, null, nd) }));
    }
  }
/*THEME_MENU*/
  // ── Camera ──
  mode(rw) { const w = rw ?? this.state.rw; return w >= 1024 ? 'wide' : w >= 576 ? 'mid' : 'phone'; }
  P(gx, gy) { return [gx - gy, (gx + gy) / 2]; }
  frame(stop, focus) {
    const { W, m } = this.sc;
    const P = (a, b) => this.P(a, b);
    const pts = [];
    const add = (t, pad) => {
      if (!t) return;
      if (t.kind === 'slab') { const w = (t.w || SIZE.slab) + pad, g1 = t.gy1 ?? t.gy; [[t.gx - pad, t.gy - w], [t.gx1 + pad, g1 - w], [t.gx1 + pad, g1 + w], [t.gx - pad, t.gy + w]].forEach(c => pts.push(P(c[0], c[1]))); }
      else { const hx = (t.sz || SIZE[t.kind]) + pad; [[-hx, -hx], [hx, -hx], [hx, hx], [-hx, hx]].forEach(c => pts.push(P(t.gx + c[0], t.gy + c[1]))); }
    };
    const by = (id) => W.find(t => t.id === id);
    if (!W.length) return { x0: -2, x1: 2, y0: -1, y1: 1 };
    const st = this.state || {};
    if (st.panel === 'answers' && this.mode(st.rw) === 'phone' && stop !== 'road') {
      // phone, answers open: the small map above the sheet frames only what would change, or where she is
      const ids = [];
      Object.keys(st.pending || {}).forEach(id => { const r = ANS_ROW[id]; if (r && r.eff) Object.keys(r.eff(st.pending[id]).prev).forEach(t => ids.push(t)); });
      (ids.length ? ids : [m.here]).forEach(id => add(by(id), 0.7));
    }
    else if (stop === 'road') { W.forEach(t => add(t, 0.2)); if (!m.noRuler) pts.push(P(gxAt(2034.6), this.lg ? 2.4 : -1.5)); }
    else if (stop === 'level' && (!focus || m.levelIds.includes(focus) || focus === m.here)) { m.levelIds.forEach(id => add(by(id), 0.5)); if (m.levelIds.includes('s500')) add(by('ms'), 0); }
    else if (stop === 'level') add(by(focus), 3);
    else { const f = by(focus || m.here) || W[0]; add(f, f.kind === 'slab' ? 0.8 : 1.5); }
    if (!pts.length) return { x0: -2, x1: 2, y0: -1, y1: 1 };
    const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
    return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
  }
  target(stop, focus, dims) {
    const s = dims || this.state, rs = s.rs || 1, mw = s.mw || 1, mh = s.mh || 1, mode = this.mode(s.rw);
    const f = this.frame(stop, focus || this.focusId());
    const R = 16 * rs;
    const pad = mode === 'wide' ? { l: 2 * R, r: 2 * R, t: 5.5 * R, b: 6 * R } : mode === 'mid' ? { l: 1.5 * R, r: 1.5 * R, t: 5 * R, b: 5 * R } : { l: 1 * R, r: 1 * R, t: 6 * R, b: 9.5 * R };
    // phone with her answers open: the sheet covers the lower part, so the road fits above it
    if (mode === 'phone' && this.lg && this.state && this.state.lgKey && this.state.panel !== 'answers') pad.t += 5 * R;
    if (mode === 'phone' && this.state && this.state.panel === 'answers') { pad.t = 3.25 * R; pad.b = mh * 0.62 + 1.5 * R; pad.l = 2 * R; pad.r = 2 * R; }
    const cap = { road: 46, level: mode === 'phone' ? 30 : 50, tile: mode === 'phone' ? 64 : 104 }[stop] * rs;
    const aw = Math.max(40, mw - pad.l - pad.r), ah = Math.max(40, mh - pad.t - pad.b);
    const u = Math.min(aw / (f.x1 - f.x0), ah / (f.y1 - f.y0), cap);
    const ox = pad.l + (aw - (f.x1 - f.x0) * u) / 2 - f.x0 * u;
    const oy = pad.t + (ah - (f.y1 - f.y0) * u) / 2 - f.y0 * u;
    return { u, ox, oy };
  }
  focusId() { const s = this.state, W = this.sc.W; return s.selected && W.find(t => t.id === s.selected) ? s.selected : this.sc.m.here; }
  reduced() { try { return !(this.props.motion ?? true) || window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } }
  goStop(stop, focus) {
    if (!STOPS.includes(stop)) return;
    const to = this.target(stop, focus);
    this.setState({ stop, status: 'Zoom: ' + STOP_NAME[stop], panel: stop === 'road' ? 'overview' : (this.state.panel === 'overview' ? null : this.state.panel) });
    this.animTo(to);
  }
  step(dir) { const i = STOPS.indexOf(this.state.stop) + dir; if (i >= 0 && i < STOPS.length) this.goStop(STOPS[i]); }
  animTo(to) {
    const from = this.state.cam;
    if (this.raf) cancelAnimationFrame(this.raf);
    if (!from || this.reduced()) return this.setState({ cam: to });
    const t0 = performance.now(), D = 550;
    const ease = (x) => 1 - Math.pow(1 - x, 3);
    const tick = (now) => {
      const k = ease(Math.min(1, (now - t0) / D));
      // zoom in log space so the scale change feels even
      const u = Math.exp(Math.log(from.u) + (Math.log(to.u) - Math.log(from.u)) * k);
      this.setState({ cam: { u, ox: from.ox + (to.ox - from.ox) * k, oy: from.oy + (to.oy - from.oy) * k } });
      if (k < 1) this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }
  // wheel and trackpad pinch step between stops; drag pans; two fingers pinch
  bindMap(el) {
    if (this.mapBound && this.mapBound !== el) {
      const o = this.mapBound, h = this.mapH;
      o.removeEventListener('wheel', h.wheel); o.removeEventListener('pointerdown', h.down); o.removeEventListener('pointermove', h.move);
      o.removeEventListener('pointerup', h.up); o.removeEventListener('pointercancel', h.up); o.removeEventListener('click', h.click, true);
      this.mapBound = null;
    }
    this.mapEl = el;
    if (!el || this.mapBound === el) return;
    const ptrs = new Map();
    let acc = 0, accT = 0, drag = null, pinch0 = 0, swallow = false;
    const h = {
      wheel: (e) => {
        e.preventDefault();
        const now = performance.now();
        if (now - accT > 400) acc = 0;
        accT = now; acc += e.deltaY * (e.ctrlKey ? 4 : 1);
        if (Math.abs(acc) > 90 && !this.wheelLock) { this.step(acc < 0 ? 1 : -1); acc = 0; this.wheelLock = true; setTimeout(() => { this.wheelLock = false; }, 450); }
      },
      down: (e) => {
        if (e.target.closest && e.target.closest('.rd-mbtn,.rb-zoom,.rd-plaque,.rd-fog,.rb-menu,.rb-futures,.rb-peek,.rb-toast,.rb-keypop')) return;
        ptrs.set(e.pointerId, [e.clientX, e.clientY]);
        if (ptrs.size === 1) drag = { x: e.clientX, y: e.clientY, cam: this.state.cam, moved: false, id: e.pointerId };
        if (ptrs.size === 2) { const v = [...ptrs.values()]; pinch0 = Math.hypot(v[0][0] - v[1][0], v[0][1] - v[1][1]); drag = null; }
      },
      move: (e) => {
        if (!ptrs.has(e.pointerId)) return;
        ptrs.set(e.pointerId, [e.clientX, e.clientY]);
        if (ptrs.size === 2 && pinch0) {
          const v = [...ptrs.values()], d = Math.hypot(v[0][0] - v[1][0], v[0][1] - v[1][1]);
          if (d / pinch0 > 1.3) { this.step(1); pinch0 = d; } else if (d / pinch0 < 0.77) { this.step(-1); pinch0 = d; }
          return;
        }
        if (!drag || !drag.cam) return;
        const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
        if (!drag.moved && Math.hypot(dx, dy) < 6) return;
        if (!drag.moved) { drag.moved = true; try { el.setPointerCapture(drag.id); } catch (err) {} el.classList.add('is-dragging'); }
        this.setState({ cam: this.clampCam({ u: drag.cam.u, ox: drag.cam.ox + dx, oy: drag.cam.oy + dy }) });
      },
      up: (e) => {
        ptrs.delete(e.pointerId);
        if (ptrs.size < 2) pinch0 = 0;
        if (drag && drag.moved) swallow = true;
        if (ptrs.size === 0) { drag = null; el.classList.remove('is-dragging'); }
      },
      click: (e) => { if (swallow) { swallow = false; e.stopPropagation(); e.preventDefault(); } }
    };
    el.addEventListener('wheel', h.wheel, { passive: false });
    el.addEventListener('pointerdown', h.down); el.addEventListener('pointermove', h.move);
    el.addEventListener('pointerup', h.up); el.addEventListener('pointercancel', h.up);
    el.addEventListener('click', h.click, true);
    this.mapBound = el; this.mapH = h;
  }
  clampCam(c) {
    const f = this.frame('road'), s = this.state, m = 80;
    const x0 = f.x0 * c.u, x1 = f.x1 * c.u, y0 = f.y0 * c.u, y1 = f.y1 * c.u;
    return { u: c.u, ox: Math.min(s.mw - m - x0, Math.max(m - x1, c.ox)), oy: Math.min(s.mh - m - y0, Math.max(m - y1, c.oy)) };
  }
  // ── Pressing: a press opens the tile in the card; the card's buttons act ──
  press(t) {
    const s = this.state, here = t.id === this.sc.m.here;
    if (t.state === 'unknown') return;
    // while her answers are open the map is a preview: pan and zoom, but tiles wait
    if (s.panel === 'answers') return this.setState({ status: 'Close your answers to open a tile.' });
    // Point A is built from her answers: pressing it opens them
    if (t.id === 'a') return this.openAnswers('location');
    if (s.stop === 'road') { this.setState({ selected: here ? null : t.id, panel: null, status: t.name + ' open in the card.' }); return this.goStop('level', t.id); }
    if (here) return this.setState({ selected: null, panel: null, status: 'Back to where you are: ' + t.name });
    this.setState({ selected: t.id, panel: null, status: t.name + ' open in the card.' });
    setTimeout(() => { if (this.cardH && this.cardH.focus) this.cardH.focus({ preventScroll: true }); }, 0);
  }
  openAnswers(row) {
    const ph = this.mode() === 'phone';
    this.setState({ panel: 'answers', selected: null, toast: null, ansOpen: row || null, ansAsk: false, viewMenu: false, menuOpen: false, view: ph ? 'map' : this.state.view, status: 'Your answers' });
    // the camera re-fits once the panel or sheet takes its space
    setTimeout(() => this.setState({ cam: this.target(this.state.stop) }), 0);
  }
  closeAnswers(force) {
    const n = Object.keys(this.state.pending).length;
    if (this.props.draft) {
      // a draft only ends two ways: created, or cancelled (asking first when something changed)
      if (n && !force) return this.setState({ ansAsk: true, status: 'Discard this new roadmap?' });
      return this.props.onCancelDraft ? this.props.onCancelDraft() : this.setState({ ansAsk: false, pending: {}, status: 'New roadmap discarded' });
    }
    if (n && !force) return this.setState({ ansAsk: true, status: 'Discard ' + n + (n > 1 ? ' changes?' : ' change?') });
    this.sc = buildScene(this.state.scene, this.lg);
    this.setState({ panel: null, pending: {}, ansOpen: null, ansAsk: false, status: n ? 'Discarded. Your roadmap stays as it is.' : '' });
    setTimeout(() => this.setState({ cam: this.target(this.state.stop) }), 0);
  }
  saveAnswers() {
    if (this.props.draft) {
      const ids = Object.keys(this.state.pending);
      if (!ids.length) return this.setState({ status: 'Change at least one answer first.' });
      const diffs = ids.map(id => { const r = ANS_ROW[id]; return (r.sub ? r.q : r.q) + ': ' + ansLabel(r, this.state.pending[id]); });
      return this.props.onCreate ? this.props.onCreate(diffs) : this.setState({ status: 'Created' });
    }
    const p = this.state.pending, budget = p.budget && p.budget !== '36' && p.budget !== '42';
    const vals = Object.assign({}, this.state.ansVals, p);
    const sc = budget ? 'budget-saved' : this.state.scene;
    this.sc = buildScene(sc, this.lg);
    this.setState({ ansVals: vals, pending: {}, ansOpen: null, ansDone: Object.keys(p).join(','), scene: sc, undoTo: budget ? this.state.scene : null, toast: budget ? 'budget' : 'nochange', status: budget ? 'Budget changed.' : 'Saved. Nothing on your roadmap changes.' });
  }
  // ── the prototype: every button on the board does what it says (mock) ──
  go(scene, o) {
    this.sc = buildScene(scene, this.lg);
    this.setState(Object.assign({ scene, selected: null, panel: null }, o || {}));
    setTimeout(() => this.setState({ cam: this.target(this.state.stop) }), 0);
  }
  act(id) {
    const s = this.state, m = this.sc.m, prev = s.scene;
    const t = id ? this.sc.W.find(x => x.id === id) : null;
    if (!t) {
      // where she is: the card's main button
      if (m.here === 'cyber' || m.here === 'ds') return this.setState({ selected: 's500', status: 'Look ahead: Student visa · 500' });
      if (m.here === 'perth') return this.go('course', { toast: 'walkc', undoTo: prev });
      if (m.here === 'au') return this.go('city', { toast: 'walk', undoTo: prev });
      return this.setState({ toast: 'later' });
    }
    if (t.id === 'au') return this.go('first', { toast: 'walkau', undoTo: prev });
    if (t.id === 'perth') return this.go('city', { toast: 'walk', undoTo: prev });
    if (t.id === 'cyber' && t.state === 'next') return this.go('course', { toast: 'walkc', undoTo: prev });
    if (t.id === 'ds' && m.here === 'cyber') {
      // the swap: the two tiles pass on an arc, then the road re-routes
      this.go('swapping', { undoTo: prev, toast: null });
      clearTimeout(this.swT); this.swT = setTimeout(() => this.go('swapped', { toast: 'swap', undoTo: prev }), this.reduced() ? 0 : 900);
      return;
    }
    if (t.id === 'cyber' && m.here === 'ds') return this.go('course', { toast: 'swapback', undoTo: prev });
    if (t.id === 'kstack') return this.setState({ panel: 'stack', selected: null, status: '13 more in Perth' });
    return this.setState({ toast: t.state === 'fog' || t.state === 'seen' || t.id === 's500' ? 'later' : 'notdrawn' });
  }
  goBack() {
    const m = this.sc.m, prev = this.state.scene;
    if (m.here === 'cyber' || m.here === 'ds') return this.go('city', { toast: 'back', undoTo: prev });
    if (m.here === 'perth') return this.go('first', { toast: 'back', undoTo: prev });
    this.goStop('road');
  }
  undo() {
    const u = this.state.undoTo;
    if (!u) return this.setState({ toast: null });
    this.go(u, { toast: null, undoTo: null, ansDone: null, ansVals: this.state.toast === 'budget' ? {} : this.state.ansVals, status: 'Undone' });
  }
  openRow(id) { this.setState({ selected: id === this.sc.m.here ? null : id, panel: null, status: 'Opened' }); }
  renderVals() {
    const s = this.state;
    const { W, m } = this.sc;
    const motion = this.props.motion ?? true;
    const mode = this.mode(), wide = mode === 'wide', phone = mode === 'phone';
    const cam = s.cam || this.target(s.stop);
    const u = cam.u, S = (gx, gy) => { const p = this.P(gx, gy); return [cam.ox + p[0] * u, cam.oy + p[1] * u]; };
    const f1 = (v) => v.toFixed(1);
    const pt = (a) => a.map(v => f1(v[0]) + ',' + f1(v[1])).join(' ');
    const byId = {}; W.forEach(t => { byId[t.id] = t; });
    const lg = this.lg;
    const mid = (t) => t.kind === 'slab' ? [(t.gx + t.gx1) / 2, (t.gy + (t.gy1 ?? t.gy)) / 2] : [t.gx, t.gy];
    const line = (pts) => pts.map((g, i) => { const p = S(g[0], g[1]); return (i ? 'L' : 'M') + f1(p[0]) + ' ' + f1(p[1]); }).join(' ');
    const ends = (ids) => { const out = []; ids.forEach(id => { const t = byId[id]; if (!t) return; if (t.kind === 'slab') { out.push([t.gx, t.gy], [t.gx1, t.gy]); } else out.push([t.gx, t.gy]); }); return out; };
    const roads = [];
    if (m.cityLine.length > 1) roads.push({ cls: 'rd-lvl' + (m.open === 'city' ? ' is-open' : ''), d: line(ends(m.cityLine)), w: Math.max(1, u * (m.open === 'city' ? 0.06 : 0.05)) });
    if (m.courseLine.length > 1) roads.push({ cls: 'rd-lvl' + (m.open === 'course' ? ' is-open' : ''), d: line(ends(m.courseLine)), w: Math.max(1, u * (m.open === 'course' ? 0.06 : 0.05)) });
    if (m.ahead.length > 1) roads.push({ cls: 'rd-road is-fog', d: line(ends(m.ahead)), w: u * 0.36 });
    if (m.lgFork) roads.push({ cls: 'rd-road is-fog is-fork rb-lgfork', d: line([[byId.jn.gx, 0], [byId.s491.gx, byId.s491.gy], [byId.s491.gx1, byId.s491.gy1], [byId.s191.gx, byId.s191.gy]]), w: u * 0.3 });
    else if (m.fork && byId.s491) roads.push({ cls: 'rd-road is-fog is-fork', d: line([[byId.g485.gx1, 0], [byId.s491.gx, 1.9], [byId.s491.gx1, 1.9], [byId.s191.gx, 1.9]]), w: u * 0.2 });
    if (m.next) roads.push({ cls: 'rd-road is-next' + (m.here === null ? '' : ''), d: line(ends(m.next)), w: u * 0.36 });
    if (m.lit.length > 1) roads.push({ cls: 'rd-road is-lit', d: line(ends(m.lit)), w: u * 0.36 });
    if (m.arc) {
      // the two tiles' arcs during a swap
      const arc = (a, b, bulge) => { const p0 = S(a[0], a[1]), p1 = S(b[0], b[1]); const mx = (p0[0] + p1[0]) / 2 + bulge[0] * u, my = (p0[1] + p1[1]) / 2 + bulge[1] * u; return 'M' + f1(p0[0]) + ' ' + f1(p0[1]) + ' Q' + f1(mx) + ' ' + f1(my) + ' ' + f1(p1[0]) + ' ' + f1(p1[1]); };
      roads.push({ cls: 'rb-arc', d: arc([7.2, -2.6], [7.2, 0], [1.6, 0.4]), w: Math.max(1.5, u * 0.05) });
      roads.push({ cls: 'rb-arc', d: arc([7.2, 0], [7.2, -2.6], [-1.6, -0.4]), w: Math.max(1.5, u * 0.05) });
      roads.push({ cls: 'rd-road is-lit', d: line([[0, 0], [2.4, 0], [4.8, 0], [7.2, 0]]), w: u * 0.36 });
      roads.push({ cls: 'rd-road is-next', d: line([[7.2, 0], [9, 0]]), w: u * 0.36 });
    }
    // the time ruler, on the ground beside the road ahead
    const RG = lg ? 2.1 : -1.45;
    const ticks = [];
    if (!m.noRuler) for (let y = 2027; y <= 2034; y++) {
      const g = gxAt(y), a0 = S(g, RG - 0.18), a1 = S(g, RG + 0.18);
      const ao = lg ? a1 : a0;
      ticks.push({ d: 'M' + f1(a0[0]) + ' ' + f1(a0[1]) + ' L' + f1(a1[0]) + ' ' + f1(a1[1]), y: String(y), lx: f1(ao[0]), ly: f1(ao[1]) });
    }
    const years = ticks.filter((t, i) => s.stop === 'road' ? (i % (u < 30 ? 2 : 1) === 0) : true).map(t => ({ y: t.y, lx: t.lx, ly: t.ly }));
    const rulerD = m.noRuler ? 'M0 0' : line([[gxAt(2026.15), RG], [gxAt(2034.6), RG]]);
    const nowP = S(gxAt(2026.3), RG);
    const stop = s.stop;
    const ahead = !!(s.selected && byId[s.selected] && (byId[s.selected].state === 'fog' || byId[s.selected].state === 'seen') && byId[s.selected].id !== 's500');
    const hintOn = s.scene === 'first' && (s.t == null || s.t >= ARR.END);
    // ── arrival ──
    const at0 = s.t, arriving = at0 != null && at0 < ARR.END;
    const R = 16 * (s.rs || 1);
    const am = 1;
    const roadIdx = {}; W.forEach((t, i) => { roadIdx[t.id] = i; });
    const tileE = (id) => arriving ? easeOut(clamp01((at0 - ARR.LOAD - 150 - (roadIdx[id] || 0) * ARR.STAG) / ARR.RISE)) : 1;
    // pending answers: what would move, drawn as dashed outlines with "If you save"
    const prevMap = {};
    Object.keys(s.pending || {}).forEach(id => { const r = ANS_ROW[id]; if (r && r.eff) Object.assign(prevMap, r.eff(s.pending[id]).prev); });
    const order = W.slice().sort((a, b) => (mid(a)[0] + mid(a)[1]) - (mid(b)[0] + mid(b)[1]));
    const tiles = order.map(t => {
      const sz = t.sz || SIZE[t.kind], d = DEPTH[t.kind] * u;
      const isHere = t.id === m.here, sel = s.selected === t.id, hov = s.hover === t.id;
      const lift = (sel && !isHere) || (m.arc && (t.id === 'ds' || t.id === 'cyber')) ? 6 : 0;
      const hovUp = hov && !sel && !isHere && s.panel !== 'answers' ? 6 : 0;
      const box = t.kind === 'slab' ? { x0: t.gx, x1: t.gx1, y0: Math.min(t.gy, t.gy1 ?? t.gy) - (t.w || sz), y1: Math.max(t.gy, t.gy1 ?? t.gy) + (t.w || sz) } : { x0: t.gx - sz, x1: t.gx + sz, y0: t.gy - sz, y1: t.gy + sz };
      // the four corners of the top face (back, right, front, left), scaled about the middle; an angled slab runs along its own line
      const quad = (k) => {
        if (t.kind === 'slab' && t.gy1 != null) {
          const dx = t.gx1 - t.gx, dy = t.gy1 - t.gy, L = Math.hypot(dx, dy), w = (t.w || sz) * k, nx = -dy / L * w, ny = dx / L * w;
          const mm = mid(t), ex = dx / 2 * k, ey = dy / 2 * k;
          return [[mm[0] - ex - nx, mm[1] - ey - ny], [mm[0] + ex - nx, mm[1] + ey - ny], [mm[0] + ex + nx, mm[1] + ey + ny], [mm[0] - ex + nx, mm[1] - ey + ny]];
        }
        const mm = mid(t), hx = (box.x1 - box.x0) / 2 * k, hy = (box.y1 - box.y0) / 2 * k;
        return [[mm[0] - hx, mm[1] - hy], [mm[0] + hx, mm[1] - hy], [mm[0] + hx, mm[1] + hy], [mm[0] - hx, mm[1] + hy]];
      };
      const layerAt = (l) => {
        const c = (gx, gy) => { const p = S(gx, gy); return [p[0], p[1] - l]; };
        const q = quad(1), T = c(q[0][0], q[0][1]), R = c(q[1][0], q[1][1]), B = c(q[2][0], q[2][1]), Lf = c(q[3][0], q[3][1]);
        return { top: pt([T, R, B, Lf]), left: pt([Lf, B, [B[0], B[1] + d], [Lf[0], Lf[1] + d]]), right: pt([B, R, [R[0], R[1] + d], [B[0], B[1] + d]]) };
      };
      const layers = t.kind === 'stack' ? [layerAt(lift), layerAt(lift + d * 1.6), layerAt(lift + d * 3.2)] : [layerAt(lift)];
      const top = t.kind === 'stack' ? d * 3.2 : 0;
      const rp = (k) => pt(quad(k).map(g => S(g[0], g[1])).map(p => [p[0], p[1] - lift - top]));
      // sample: an icon printed on the top face, upright and flattened, so it reads like a mark on the tile
      const lk = lg ? lgKind(t) : null;
      let icoM = '';
      if (lk && ICO[lk[1]]) {
        let g = mid(t), isz = sz * (t.kind === 'stack' ? 0.5 : t.kind === 'fork' ? 0.8 : 0.66);
        if (t.kind === 'slab') { const g1 = t.gy1 ?? t.gy, L = Math.hypot(t.gx1 - t.gx, g1 - t.gy), a = Math.min(0.55, L / 2); g = [t.gx + (t.gx1 - t.gx) / L * a, t.gy + (g1 - t.gy) / L * a]; isz = (t.w || sz) * 0.8; }
        const p = S(g[0], g[1]), k = isz * u * 2 / 24;
        icoM = 'matrix(' + [k, 0, 0, k * 0.56, p[0] - 12 * k, p[1] - lift - top - 12 * k * 0.56].map(v => v.toFixed(3)).join(',') + ')';
      }
      const c = S(mid(t)[0], mid(t)[1]);
      let pos = (stop === 'level' && ahead && (t.state === 'fog' || t.state === 'seen') ? t.lab.road : (t.lab || {})[stop]) || 'none';
      // sample, phone: the icon says what a tile is; names stay short so they don't pile up
      if (lg && phone && t.id === 'adl' && pos === 'above') pos = 'left';
      if (lg && phone && stop === 'level' && t.state === 'fog' && !isHere && !sel) pos = 'none';
      let hasLab = pos !== 'none' || (hov && !isHere);
      const p2 = pos === 'none' ? 'above' : pos;
      const hw = t.kind === 'slab' ? (box.x1 - box.x0) / 2 + sz : 2 * sz;
      const lx = p2 === 'left' ? c[0] - hw * u - 6 : p2 === 'right' ? c[0] + hw * u + 6 : c[0];
      const ly = p2 === 'below' ? c[1] + sz * u + d + 6 - lift : p2 === 'above' ? c[1] - sz * u - top - 8 - lift : c[1] - lift - top / 2;
      // phone, answers open: the small map names only what would change, and where she is
      if (lg && phone && s.panel === 'answers' && !isHere && !(t.prev || prevMap[t.id])) hasLab = false;
      // a name that would be cut by the map's edge waits until the camera brings its tile in
      if (lg && hasLab && !isHere && s.mw) { const RR = 16 * (s.rs || 1); if ((p2 === 'right' && lx + 7 * RR > s.mw) || (p2 === 'left' && lx - 7 * RR < 0) || ((p2 === 'above' || p2 === 'below') && (lx < 3 * RR || lx > s.mw - 3 * RR)) || (p2 === 'above' && ly < 3 * RR) || (p2 === 'below' && s.mh && ly > s.mh - 3 * RR)) hasLab = false; }
      const full = isHere && stop === 'tile';
      const openLvl = (m.open === 'course' && t.level === 'course') || (m.open === 'city' && t.level === 'city');
      const showWhy = !!t.why && ((stop === 'level' && !phone && (openLvl || (isHere && t.kind === 'course'))) || full);
      const showSub = !!t.sub && ((t.kind === 'stack' && stop !== 'road') || (stop === 'level' && !phone && ((t.id === 'perth' && !lg) || isHere)) || full);
      const kick = lg ? [lk[0], t.kicker && t.kicker !== 'You' && t.kicker !== 'Point B' ? t.kicker : ''].filter(Boolean).join(' · ') : (t.kicker || '');
      const badges = (t.badges || []).map(k => BADGES[k]);
      const bw = Math.max(44, (t.kind === 'slab' ? (box.x1 - box.x0 + 2 * sz) : 4 * sz) * u), bh = Math.max(44, (t.kind === 'slab' ? (box.x1 - box.x0) / 2 + 2 * sz : 2 * sz) * u + d + top);
      const stateWord = isHere ? 'you are here' : ({ lit: 'visited', alt: 'not visited', next: 'not visited, next', fog: 'unexplored', seen: 'looked at', unknown: 'not picked yet' }[t.state] || '');
      return {
        id: t.id,
        ty: f1(12 * (1 - tileE(t.id)) - hovUp), op: tileE(t.id).toFixed(2),
        cls: 'rd-tile k-' + t.kind + ' s-' + (isHere ? 'here' : t.state) + (lift || hovUp ? ' is-lift' : '') + (hovUp ? ' is-hov' : '') + (sel ? ' is-sel' : ''),
        layers,
        hasPrevRing: !!(t.prev || prevMap[t.id]), prevRing: rp(isHere ? 1.75 : 1.5),
        hasRing: isHere || sel, ringCls: isHere ? 'rb-ring is-here' : 'rb-ring is-sel', ring: rp(isHere ? 1.45 : 1.3),
        hasHint: hintOn && t.id === 'perth', hint: rp(1.6),
        btnCls: 'rd-hit rb-hit' + (sel ? ' is-sel' : ''),
        bx: f1(c[0] - bw / 2), by: f1(c[1] - bh / 2 - lift - top / 2), bw: f1(bw), bh: f1(bh),
        aria: t.name + ', ' + stateWord + '. Open in the card',
        pressed: sel ? 'true' : 'false',
        press: () => this.press(t),
        enter: () => this.setState({ hover: t.id }), leave: () => this.setState({ hover: this.state.hover === t.id ? null : this.state.hover }),
        hasLabel: hasLab,
        labCls: 'rd-lab is-' + p2 + (isHere ? ' is-here' : '') + (full ? ' is-full' : '') + ' k-' + t.kind + ' s-' + (isHere ? 'here' : t.state) + (pos === 'none' ? ' is-hint' : '') + ' at-' + stop,
        lx: f1(lx), ly: f1(ly),
        hasKicker: lg ? (!!kick && (!phone || isHere || stop === 'tile')) : (!!t.kicker && stop !== 'tile'), kicker: kick,
        hasIco: !!icoM, icoM, ico: icoM ? ICO[lk[1]].map(d => ({ d })) : [],
        name: stop === 'road' ? (t.short || t.name) : t.name,
        hasSub: showSub, sub: t.sub || '',
        hasWhen: !!t.when && stop !== 'road' && t.kind !== 'step', when: t.when || '',
        hasBadges: full && badges.length > 0,
        badges: badges.slice(0, 2).map(b => ({ k: b.k, v: b.v, isLayers: b.icon === 'layers', isAlert: b.icon === 'alert', isSplit: b.icon === 'split' })),
        hasMore: badges.length > 2, more: '+' + (badges.length - 2),
        hasWhy: showWhy, why: (lg ? plain(t.why) : t.why) || '',
        hasPrev: !!(t.prev || prevMap[t.id]), prev: prevMap[t.id] || t.prev || ''
      };
    });
    const hereT = m.here && byId[m.here];
    const hc = hereT ? S(hereT.gx, hereT.gy) : [0, 0];
    const dw = Math.min(Math.max(u * 1.5, 34 * (s.rs || 1)), 76 * (s.rs || 1));
    const msT = byId.ms, msStart = msT ? (lg ? S(msT.gx + 2.4, -1.5) : S(msT.gx + 0.9, 0.95)) : [0, 0];
    const perthT = byId.perth, hintP = perthT ? S(perthT.gx, perthT.gy) : [0, 0];
    // ── the card ──
    const selT = s.selected && byId[s.selected];
    const cd = selT ? (CARD[selT.id] || CARD[selT.id === 'g491' ? 's491' : 'pr']) : null;
    let H = (m.illustrative ? HERE['cyber-' + s.scene] : HERE[m.here]) || HERE.cyber;
    if (m.budgetSaved && m.here === 'cyber') H = Object.assign({}, H, { c: '▼ Costs you on: Cost (AUD 3.5k a year over your budget) and Location (far from the east-coast job market).', badges: ['over', 'offerings', 'ielts', 'fork'] });
    const badgeVals = (keys) => keys.map(k => {
      const b = BADGES[k], open = !!s.open[k];
      return { k: b.k, v: b.v, exp: b.exp, open, expanded: open ? 'true' : 'false', cls: 'rd-badge-btn' + (open ? ' is-open' : ''),
        isLayers: b.icon === 'layers', isAlert: b.icon === 'alert', isSplit: b.icon === 'split',
        toggle: () => this.setState({ open: Object.assign({}, this.state.open, { [k]: !open }) }) };
    });
    const sibIds = m.courseLine.length > 1 && (m.here === 'cyber' || m.here === 'ds') ? m.courseLine.filter(id => id !== m.here) : m.here === 'perth' ? ['adl', 'cstack'] : [];
    const sibs = sibIds.map(id => { const t = byId[id]; return { name: t.name, sub: t.kind === 'stack' ? '' : ' · ' + (t.sub || '').split(' · ')[0], line: t.kind === 'stack' ? t.sub : (t.kicker === 'Visited' ? 'Visited · ' + ((lg ? plain(t.why) : t.why) || '') : (t.kicker ? t.kicker : ((lg ? plain(t.why) : t.why) || t.sub))), cls: 'rb-sib' + (t.kind === 'stack' ? ' is-stack' : '') + (t.state === 'lit' ? ' is-visited' : ''), open: () => this.openRow(id) }; });
    // ── phone: the vertical road ──
    const kindWord = { point: '', place: 'City', course: 'Course', step: 'Route step', slab: 'Route step', stack: 'Stack' };
    const rowState = (t) => t.id === m.here ? 'here' : t.state === 'seen' ? 'seen' : (t.state === 'lit' ? 'lit' : t.state === 'next' ? 'next' : t.state === 'unknown' ? 'next' : 'fog');
    const rows = [];
    m.road.forEach(id => {
      const t = byId[id]; if (!t) return;
      if (id === m.here) { rows.push({ isHere: true, isRow: false, isFork: false }); return; }
      const st = rowState(t);
      const altIds = id === 'perth' && m.here !== 'perth' && byId.adl ? ['adl', 'cstack'] : (id === 'cyber' && m.here === 'perth') ? ['ds', 'kstack'] : [];
      rows.push({
        isRow: true, isHere: false, isFork: false,
        cls: 'rb-row s-' + st + (hintOn && id === 'perth' ? ' has-hint' : ''),
        when: id === 'a' ? 'Now' : (t.when || ''),
        // the date leads the kicker, so the road needs no date column
        kicker: (t.when ? t.when + ' · ' : '') + (id === 'a' ? 'You' : id === 'au' ? 'Destination' : (st === 'next' ? 'Next · ' : st === 'seen' ? 'Looked at · ' : '') + (id === 'pr' ? 'Point B' : (kindWord[t.kind] || ''))),
        name: t.name,
        line: id === 'a' || id === 'au' ? t.sub : (CARD[id] && CARD[id].guide && t.kind !== 'place' ? CARD[id].guide : (t.sub || '')),
        hasAlts: altIds.length > 0, alts: altIds.map(a => ({ t: byId[a].name, open: () => this.openRow(a) })),
        hasLesson: id === 'ms' && st !== 'seen', hasHint: hintOn && id === 'perth',
        open: () => this.openRow(id),
        aria: t.name + ', ' + ({ lit: 'visited', next: 'next', fog: 'unexplored', seen: 'looked at' }[st] || '') + '. Open'
      });
    });
    if (m.fork) rows.push({ isFork: true, isRow: false, isHere: false });
    rows.forEach((r, j) => { const e = arriving ? easeOut(clamp01((at0 - ARR.PROWS - j * 90) / ARR.RISE)) : 1; r.op = e.toFixed(2); r.ty = f1(16 * (1 - e)); });
    if (m.illustrative && byId.pr) rows.push({ isRow: true, isHere: false, isFork: false, cls: 'rb-row s-fog', when: byId.pr.when, kicker: byId.pr.when + ' · Point B', name: byId.pr.name, line: 'Point B for this road.', hasAlts: false, alts: [], hasLesson: false, hasHint: false, open: () => {}, aria: byId.pr.name });
    // ── panels ──
    const panel = s.panel;
    const deskKinds = panel === 'stack' || panel === 'lesson' || panel === 'overview' || panel === 'change' || panel === 'answers';
    const mv = this.menuVals(() => this.setState({ away: 'login', status: 'Signed out' }));
    const tv = this.themeVals();
    const cardOther = !!selT && selT.id !== m.here;
    const sheetCard = phone && s.view === 'road' && cardOther;
    const toast = s.toast && TOASTS[s.toast];
    const fut = s.scene === 'course' || s.scene === 'cost' || s.scene === 'career';
    const showFut = !!this.props.futures && fut;
    const loading = s.scene === 'loading', empty = s.scene === 'empty';
    const lerp = (a, b, k) => a + (b - a) * k;
    // the pond sits in the middle of the loader, above the three steps
    const pW0 = Math.min(22 * R, (s.rw || 390) - 2 * R), RH = s.rh || (phone ? 844 : 900);
    const pond = { l: (s.rw || 390) / 2 - pW0 / 2, t: RH / 2 - 9 * R, w: pW0 };
    const slow = this.props.frame === 'slow' || this.props.arriveSlow, failed = this.props.frame === 'error' || s.loadErr;
    const stepAt = [ARR.L1, ARR.L2, ARR.L3];
    const loadSteps = LOAD_STEPS.map((t, i) => {
      const done = arriving && at0 >= stepAt[i] && !(failed && i >= 1), now = arriving && !done && (i === 0 || at0 >= stepAt[i - 1]) && !(failed && i > 1);
      const bad = failed && i === 1;
      return { t, cls: 'rb-ls' + (bad ? ' is-bad' : done ? ' is-done' : now ? ' is-now' : ' is-next'), isDone: done && !bad, isNow: now && !bad, isBad: bad };
    });
    const H0 = phone ? ARR.PHOP0 : ARR.HOP0, H1 = phone ? ARR.PHOP1 : ARR.HOP1;
    const hopK = arriving ? easeOut(clamp01((at0 - H0) / (H1 - H0))) : 1;
    const pdw = 3.75 * R, pdx = pond.l + pond.w / 2 - pdw / 2, pdy = pond.t + 7.5 * R - 1.125 * R - pdw * 0.93;
    const bdx = hc[0] - dw / 2 + (s.ml || 0), bdy = hc[1] - dw * 0.95 + (s.mt || 0);
    const duckW = arriving ? lerp(pdw, dw, hopK) : dw;
    const duckX = arriving ? lerp(pdx, bdx, hopK) - (s.ml || 0) : hc[0] - dw / 2;
    const duckY = arriving ? lerp(pdy, bdy, hopK) - Math.sin(Math.PI * hopK) * 3 * R - (s.mt || 0) : hc[1] - dw * 0.95;
    return {
      menuOpen: mv.menuOpen, menuExpanded: mv.menuExpanded, toggleMenu: mv.toggleMenu, closeMenu: mv.closeMenu, menuKey: mv.menuKey, menuBtnRef: mv.menuBtnRef, firstItemRef: mv.firstItemRef, menuSignOut: mv.menuSignOut,
      themeAttr: tv.themeAttr, themePref: tv.themePref, setTheme: tv.setTheme, showMoon: tv.showMoon, showSun: tv.showSun, darkChecked: tv.darkChecked, toggleLabel: tv.toggleLabel, toggleTheme: tv.toggleTheme,
      rootClass: 'rd rb ' + (motion ? 'motion-on' : 'motion-off') + ' m-' + mode + ' z-' + stop + (phone ? ' v-' + s.view : '') + (panel === 'pick' ? ' is-pick' : '') + (loading ? ' is-loading' : '') + (empty ? ' is-empty' : '') + (arriving ? ' is-arriving' + (at0 >= H1 ? ' arr-landed' : '') : '') + (panel === 'answers' ? ' is-answers' : '') + (lg ? ' is-lg' : ''),
      rootRef: (el) => { this.rootEl = el; }, mapRef: (el) => this.bindMap(el),
      listRef: (el) => { this.listEl = el; }, hereRowRef: (el) => { this.hereRow = el; },
      cardHRef: (el) => { this.cardH = el; },
      showMap: (!phone || s.view === 'map') && panel !== 'pick', showList: phone && s.view === 'road' && panel !== 'pick', showCard: !phone && panel !== 'pick', showPeek: phone && s.view === 'map' && !loading,
      showPick: panel === 'pick',
      mw: String(s.mw || 1), mh: String(s.mh || 1),
      // sample: the key, shown on first visit until she closes it; it stays in View after that
      lgKeyOn: lg && s.lgKey && !loading && !arriving && panel !== 'answers' && panel !== 'pick' && !(phone && sheetCard),
      closeLgKey: () => this.setState({ lgKey: false, status: 'Key closed. Map key brings it back.' }),
      keyShown: s.lgKey ? 'true' : 'false', toggleKey: () => this.setState({ lgKey: !this.state.lgKey, status: this.state.lgKey ? 'Key closed' : 'Map key' }),
      roads, tiles, ticks, years, rulerD, rw2: f1(Math.max(1, u * 0.04)), hasRuler: !m.noRuler,
      nowX: f1(nowP[0]), nowY: f1(nowP[1]),
      hasDuck: !!hereT && (!arriving || at0 >= ARR.HOP0), dx: f1(duckX), dy: f1(duckY), dw: f1(duckW), hereName: hereT ? hereT.name : '',
      arriveOn: arriving, ghostOn: false,
      loadOn: arriving && at0 < ARR.L3 + ARR.FADE, loadOp: (failed ? 1 : 1 - clamp01((at0 - ARR.L3) / ARR.FADE)).toFixed(2), loadTop: f1(RH / 2 + 0.75 * R), loadSteps, loadSlow: !!slow && !failed, loadErr: !!failed,
      retry: () => this.play(), ghostOp: (1 - clamp01((at0 || 0) / 300)).toFixed(2),
      pL: f1(pond.l), pT: f1(pond.t), pW: f1(pond.w), waterOp: (1 - clamp01(((at0 || 0) - (H0 - 250)) / 250)).toFixed(2), pDuckOp: (at0 || 0) < H0 ? '1' : '0',
      // phone: the duck hops from the water to its place on the road line, then the steps rise in around it
      aDuckOn: arriving && phone && at0 >= H0 && at0 < H1, aDx: f1(lerp(pdx, s.hnx || R, hopK)), aDy: f1(lerp(pdy, s.hny || 200, hopK) - Math.sin(Math.PI * hopK) * 3 * R), aDw: f1(lerp(pdw, s.hnw || 32, hopK)),
      roadOp: (arriving ? clamp01((at0 - ARR.LOAD) / 500) : 1).toFixed(2),
      fieldM: '1',
      arrVars: '--rd: ' + (arriving ? clamp01((at0 - ARR.LOAD) / 500) : 1).toFixed(2) + '; --ctl: ' + (arriving ? clamp01((at0 - ARR.LOAD - 500) / 400) : 1).toFixed(2) + '; --lab: ' + (arriving ? clamp01((at0 - ARR.LOAD - 950) / 400) : 1).toFixed(2) + '; --chrome: ' + am.toFixed(2),
      clipR: f1(arriving && wide ? Math.max(0, ((s.mw || 0) - 37.5 * R) * (1 - am)) : 0),
      fx: f1(Math.min(msStart[0], (s.mw || 0) - 17 * 16 * (s.rs || 1))), fy: f1(msStart[1]), showFog: stop === 'level' && !ahead && !!msT && s.scene !== 'read' && !m.illustrative && m.here !== 'perth' && m.here !== 'au',
      hintOn, hintX: f1(hintP[0] + 2 * SIZE.place * u + 14), hintY: f1(hintP[1] + 0.2 * u),
      weights: WEIGHTS.map(w => ({ name: w[0], h: (w[1] / 3 * 100).toFixed(0) + '%' })),
      wide, narrow: !wide, phone,
      backLabel: wide ? (m.here === 'perth' ? 'Back to Australia' : m.here === 'au' || m.here === 'a' ? 'Back to Point A' : 'Back to Perth') : 'Back',
      zooms: STOPS.map(z => ({ name: STOP_NAME[z], cls: 'rb-zbtn' + (z === stop ? ' is-on' : ''), on: z === stop ? 'true' : 'false', go: () => this.goStop(z) })),
      zoomOut: () => this.step(-1), zoomIn: () => this.step(1),
      outOff: stop === 'road' ? 'true' : 'false', inOff: stop === 'tile' ? 'true' : 'false',
      viewOpen: s.viewMenu && !(panel === 'key'), viewExpanded: s.viewMenu ? 'true' : 'false',
      toggleView: () => this.setState({ viewMenu: !this.state.viewMenu, panel: this.state.panel === 'key' ? null : this.state.panel }), closeView: () => this.setState({ viewMenu: false }),
      openKey: () => this.setState({ viewMenu: false, panel: 'key' }),
      // the card column
      cardHereOn: !cardOther && !deskKinds && !loading && !(arriving && at0 < ARR.HOP1), cardOther: cardOther && !deskKinds && !phone, cardLoading: loading || (arriving && at0 < ARR.HOP1),
      cardAria: cardOther ? 'The tile you pressed' : 'Where you are',
      hKicker: H.kicker, hName: H.name, hSub: H.sub, hHasTrade: !!H.g, hG: (lg ? plain(H.g) : H.g) || '', hC: (lg ? plain(H.c) : H.c) || '', hGuide: H.guide || '', hHasGuide: !!(H.g || H.guide),
      hBecause: H.because, hIsCourse: !!H.course, hPrimary: H.primary, hHasSecondary: !!H.secondary, hSecondary: H.secondary || '',
      hasHereBadges: (H.badges || []).length > 0, hereBadges: badgeVals(m.illustrative ? [] : (H.badges || [])),
      hasSibs: sibs.length > 0, sibsK: H.sibsK, sibs,
      cKicker: cd ? cd.kicker : '', cName: selT ? selT.name : '', cSub: cd ? cd.sub : '',
      cHasTrade: !!(cd && cd.g), cG: cd ? ((lg ? plain(cd.g) : cd.g) || '') : '', cC: cd ? ((lg ? plain(cd.c) : cd.c) || '') : '', cGuide: cd ? (cd.guide || '') : '', cBecause: cd ? cd.because : '',
      cHasPrimary: !!(cd && cd.primary), cPrimary: cd ? ((selT.id === 'cyber' && selT.state === 'next') ? 'Walk to Cyber Security' : (cd.primary || '')) : '', cLesson: !!(cd && cd.lesson),
      cSecondary: cd && cd.kicker === LOOK.kicker ? 'Back to ' + (hereT ? hereT.name : '') : 'Cancel',
      cHasBadges: !!(selT && (selT.badges || []).length), cardBadges: badgeVals(selT ? (selT.badges || []) : []),
      cancelSelect: () => this.setState({ selected: null, status: 'Back to where you are' }),
      lesson: () => this.setState({ panel: 'lesson', selected: null }), closePanel: () => this.setState({ panel: null, viewMenu: false }),
      openStack: () => this.setState({ panel: 'stack', selected: null }),
      // panels in the card column (desktop) or as sheets (phone)
      // changing one answer from the board (Point A's facts, or a card's reason)
      panelChange: panel === 'change',
      aFacts: selT && selT.id === 'a' ? A_FACTS.map(f => ({ q: f[0], a: m.budgetSaved && f[0] === 'Your budget per year' ? 'AUD 30k a year, fees only, roughly' : f[1], change: () => f[0] === 'Your budget per year' ? this.setState({ panel: 'change', pick: '36', selected: null, status: 'Changing: Your budget per year' }) : this.setState({ status: 'Change: ' + f[0] }) })) : [],
      hasAFacts: !!(selT && selT.id === 'a'),
      amounts: AMOUNTS.map(([v, l]) => ({ label: l, cls: 'fx-card' + (v === 'unsure' ? ' is-unsure' : ''), checked: (s.pick || '36') === v ? 'true' : 'false', isUnsure: v === 'unsure', isWas: v === '36' && (s.pick || '36') !== '36', pick: () => { const sc = v === '36' || v === '42' ? 'course' : 'budget-preview'; this.sc = buildScene(sc, this.lg); this.setState({ pick: v, scene: sc, status: l }); } })),
      budgetIf: BUDGET_IF[s.pick || '36'] || '', hasBudgetIf: !!BUDGET_IF[s.pick || '36'], budgetSame: (s.pick || '36') === '36',
      budgetSaveCls: 'btn blueprint ' + ((s.pick || '36') === '36' ? 'btn-secondary is-off' : 'btn-primary aa') + ' rd-primary',
      saveBudget: () => { const v = this.state.pick || '36'; if (v === '36') return; this.sc = buildScene(v === '42' ? 'course' : 'budget-saved', this.lg); this.setState({ panel: null, scene: v === '42' ? 'course' : 'budget-saved', toast: v === '42' ? 'nochange' : 'budget', status: v === '42' ? 'Saved. Nothing on your roadmap changes.' : 'Budget changed.' }); },
      cancelChange: () => { this.sc = buildScene('course', this.lg); this.setState({ panel: null, scene: 'course', pick: '36', status: 'Nothing changed' }); },
      panelAnswers: panel === 'answers',
      ansSteps: ANS.map(g => ({ n: g.n, name: g.name, rows: g.rows.map(r => {
        const cur = s.ansVals[r.id] != null ? s.ansVals[r.id] : r.a;
        const pend = s.pending[r.id];
        const open = s.ansOpen === r.id;
        const shownVal = pend != null ? pend : cur;
        const done = (s.ansDone || '').split(',').includes(r.id);
        const e = r.eff && pend != null && pend !== cur ? r.eff(pend) : null;
        return {
          q: r.q, sub: r.sub || '', hasSub: !!r.sub, shown: r.opts ? ansLabel(r, shownVal) : r.a, hasShown: !!(r.opts ? ansLabel(r, shownVal) : r.a),
          isOpen: !!r.open && !shownVal, open: r.open || '', isPending: pend != null && pend !== cur, isDone: done && pend == null, personal: !!r.personal,
          cls: 'rb-ans-li' + (open ? ' is-open' : '') + (pend != null && pend !== cur ? ' is-pending' : ''),
          expanded: open ? 'true' : 'false', isExpanded: open, hasOpts: !!r.opts, noOpts: !r.opts,
          actLabel: open ? 'Close' : (r.open && !shownVal ? 'Answer now' : 'Change'),
          toggle: () => this.setState({ ansOpen: open ? null : r.id, ansAsk: false }),
          why: r.why || '', hasEff: !!e, effLines: e ? e.lines.map(t => ({ t })) : [],
          cards: (r.opts || []).map(([v, l]) => ({ label: l, cls: 'fx-card' + (v === 'unsure' ? ' is-unsure' : ''), checked: shownVal === v ? 'true' : 'false', isUnsure: v === 'unsure', isWas: v === cur && shownVal !== cur,
            pick: () => { const pn = Object.assign({}, this.state.pending); if (v === cur) delete pn[r.id]; else pn[r.id] = v; this.setState({ pending: pn, ansAsk: false, status: l + (v === cur ? ' · your answer now' : ' · not saved') }); setTimeout(() => this.setState({ cam: this.target(this.state.stop) }), 0); } }))
        };
      }) })),
      ansPending: Object.keys(s.pending).length > 0,
      ansBarOn: Object.keys(s.pending).length > 0 || !!this.props.draft,
      ansPendingText: (() => { const n = Object.keys(s.pending).length; if (this.props.draft) return n ? n + (n > 1 ? ' answers' : ' answer') + ' changed' : 'Change at least one answer'; return n + (n > 1 ? ' changes' : ' change') + ' not saved'; })(),
      ansAsk: s.ansAsk, ansAskText: (() => { const n = Object.keys(s.pending).length; if (this.props.draft) return 'Discard this new roadmap?'; return 'Discard ' + n + (n > 1 ? ' changes?' : ' change?'); })(),
      ansAskSub: this.props.draft ? 'Nothing is created. Your other roadmaps stay as they are.' : 'Your answers and your roadmap stay as they are.',
      ansKicker: this.props.draft ? 'New roadmap · a copy of ' + this.props.draft : 'From onboarding · change any of them',
      ansTitle: this.props.draft ? 'Change any answers' : 'Your answers',
      ansLead: this.props.draft ? 'It starts with the same answers. Change one or more; the map shows what would be different before you create it.' : 'Pick one to change it. Your roadmap shows what would move before anything moves.',
      ansCloseLabel: this.props.draft ? 'Cancel' : 'Close',
      ansCancelLabel: this.props.draft ? 'Cancel' : 'Discard', ansBarCancel: () => this.props.draft ? this.closeAnswers(false) : this.closeAnswers(true),
      ansSaveLabel: this.props.draft ? 'Create roadmap' : 'Save changes',
      ansSaveOff: this.props.draft && !Object.keys(s.pending).length ? 'true' : 'false',
      ansSaveCls: 'btn btn-primary aa rb-ans-bbtn' + (this.props.draft && !Object.keys(s.pending).length ? ' is-off' : ''),
      hasRm: !!this.props.roadmapName, rmName: this.props.roadmapName || '',
      toRoadmaps: () => this.props.onRoadmaps ? this.props.onRoadmaps() : this.setState({ status: 'Your roadmaps' }),
      menuRoadmaps: () => { this.setState({ menuOpen: false }); if (this.props.onRoadmaps) this.props.onRoadmaps(); },
      ansSave: () => this.saveAnswers(), ansDiscard: () => this.closeAnswers(true), ansKeep: () => this.setState({ ansAsk: false }), ansClose: () => this.closeAnswers(false),
      previewOn: panel === 'answers' && Object.keys(prevMap).length > 0, isAnswering: panel === 'answers',
      panelStack: panel === 'stack', panelLesson: panel === 'lesson', panelOverview: panel === 'overview', panelKey: panel === 'key',
      deskPanel: !phone && (panel === 'stack' || panel === 'lesson' || panel === 'overview' || panel === 'change' || panel === 'answers'),
      sheetOn: phone && (panel === 'stack' || panel === 'lesson' || panel === 'overview' || panel === 'key' || panel === 'change' || panel === 'answers' || sheetCard),
      sheetCard,
      keyPop: !phone && panel === 'key',
      filters: ['All', 'Match well', 'Not yet reachable'].map((f, i) => ({ name: f, cls: 'rb-chip' + (i === s.filter ? ' is-on' : ''), on: i === s.filter ? 'true' : 'false', go: () => this.setState({ filter: i }) })),
      stackRows: STACK.map((r, i) => ({ add: () => i === 0 ? this.go('added', { toast: 'add', undoTo: this.state.scene }) : this.setState({ toast: 'notdrawn' }), name: r.name, sub: r.sub, hasTag: !!r.tag, tag: r.tag, cls: 'rb-srow' + (r.blocked ? ' is-blocked' : ''), blocked: !!r.blocked, open: !r.blocked })),
      keyPress: KEY_PRESS.map(k => ({ k: k[0], v: k[1] })), keyLight: KEY_LIGHT.map(k => ({ cls: 'rb-sw is-' + k[0], v: k[1] })),
      overview: OVERVIEW.map(t => ({ t })),
      backToWalk: () => this.goStop('level'),
      // toast and tag
      hasToast: !!toast, toastText: toast ? toast.text : '', toastUndo: !!(toast && toast.undo), closeToast: () => this.setState({ toast: null }), undo: () => this.undo(),
      hAct: () => this.act(null), hLater: () => this.setState({ toast: 'later' }), cAct: () => this.act(this.state.selected), peekAct: () => this.act(cardOther ? this.state.selected : null),
      goBack: () => this.goBack(), nextRound: () => this.setState({ toast: 'next' }), doneReading: () => this.go('read', { toast: 'read', undoTo: this.state.scene }),
      swapping: !!m.arc,
      // futures (option A switcher, option B pick first)
      showFut, futures: FUTURES.map(f => ({ name: f[1], cls: 'rb-fbtn' + (f[0] === s.scene ? ' is-on' : ''), on: f[0] === s.scene ? 'true' : 'false', go: () => { this.sc = buildScene(f[0], this.lg); this.setState({ scene: f[0], selected: null, cam: this.target(this.state.stop), status: f[1] + ' · illustrative' }); } })),
      illustrative: !!m.illustrative,
      pickFutures: [
        { name: 'Built around staying', steps: 'Perth · Master of Cyber Security, ECU · 190 state nomination · then PR', go: () => this.setState({ panel: null, scene: 'course' }) },
        { name: 'Built around cost', steps: 'Adelaide · Master of Cyber Security, UniSA · 491 regional visa · then PR', go: () => { this.sc = buildScene('cost', this.lg); this.setState({ panel: null, scene: 'cost' }); } },
        { name: 'Built around career', steps: 'Sydney · Master of Cyber Security, UTS · 485 · then employer sponsorship', go: () => { this.sc = buildScene('career', this.lg); this.setState({ panel: null, scene: 'career' }); } }
      ],
      isEmpty: empty, isLoading: loading,
      // phone
      viewRoad: () => this.setState({ view: 'road', status: 'Road view' }), viewMap: () => this.setState({ view: 'map', status: 'Map view' }),
      roadOn: s.view === 'road' ? 'true' : 'false', mapOn: s.view === 'map' ? 'true' : 'false',
      roadCls: 'rb-seg' + (s.view === 'road' ? ' is-on' : ''), mapCls: 'rb-seg' + (s.view === 'map' ? ' is-on' : ''),
      rows,
      peekKicker: cardOther ? cd.kicker : H.kicker, peekName: cardOther ? selT.name : H.name,
      peekLine: lg ? (cardOther ? (cd.g ? plain(cd.g + ' · ' + cd.c).replace('\n', ' · ') : (cd.guide || cd.sub)) : (hereT && hereT.why ? plain(hereT.why).replace('\n', ' · ') : H.sub)) : (cardOther ? (cd.g ? cd.g + ' · ' + cd.c : (cd.guide || cd.sub)) : (hereT && hereT.why ? hereT.why : H.sub)),
      peekPrimary: cardOther ? (cd.primary || 'Back to ' + H.name) : H.primary,
      peekIsOther: cardOther, peekSecondary: cardOther && cd.kicker === LOOK.kicker ? 'Back to ' + H.name : 'Cancel',
      menuAnswers: () => this.openAnswers(null), showAnswers: s.away === 'answers',
      showSelf: !s.away, showLogin: s.away === 'login', motion,
      backHere: () => this.setState({ away: null, status: '' }),
      statusText: s.status
    };
  }
}
