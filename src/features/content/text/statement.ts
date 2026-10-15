// Whether a title sentence states something the article must back (criterion 96, amended 11 Oct
// 2026): one with a verb or a number is a claim and goes to the source check; a short label such
// as "Test Feed" or "Paid work and grades" has neither and is no claim at all. Code, not a model:
// the verbs are a list that grows by editing it, as the abbreviations in sentences.ts do.

import { numbersIn } from './numbers'

/** Forms of be, have and do, and the modals: a sentence with one has a verb. */
const AUXILIARIES = [
  ...['am', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'has', 'have', 'had'],
  ...['do', 'does', 'did', 'can', 'cannot', 'could', 'will', 'would', 'shall', 'should'],
  ...['may', 'might', 'must', "isn't", "aren't", "wasn't", "weren't", "hasn't", "haven't"],
  ...["don't", "doesn't", "didn't", "can't", "won't", "wouldn't", "shouldn't", "couldn't"],
]

/**
 * Verbs a claim in a post title turns on, by their base form; each also counts in its regular
 * forms (rises, rising; cuts, cutting; varies, varied). Words as often nouns in a label
 * ("work", "pay", "study", "feed", "grade", "result", "cost", "sleep") are left out, so a label
 * of nouns stays a label.
 */
const VERBS = [
  ...['improve', 'boost', 'raise', 'lift', 'lower', 'cut', 'reduce', 'increase', 'decrease'],
  ...['double', 'halve', 'triple', 'help', 'hurt', 'harm', 'damage', 'protect', 'prevent'],
  ...['cause', 'lead', 'drive', 'affect', 'change', 'predict', 'link', 'mean', 'make', 'give'],
  ...['get', 'earn', 'save', 'beat', 'outperform', 'outpace', 'fall', 'rise', 'drop', 'grow'],
  ...['shrink', 'climb', 'slip', 'jump', 'soar', 'surge', 'plunge', 'fail', 'pass', 'win'],
  ...['lose', 'matter', 'find', 'show', 'suggest', 'prove', 'reveal', 'say', 'need', 'want'],
  ...['risk', 'face', 'keep', 'stay', 'become', 'take', 'go', 'come', 'spend', 'struggle'],
  ...['miss', 'leave', 'skip', 'choose', 'prefer', 'expect', 'trail', 'lag', 'widen', 'narrow'],
  ...['ease', 'slow', 'allow', 'ban', 'require', 'vary', 'depend', 'add', 'top'],
]

/** Past forms that do not follow the rule. */
const IRREGULAR = [
  ...['rose', 'risen', 'fell', 'fallen', 'grew', 'grown', 'made', 'gave', 'given', 'got'],
  ...['gotten', 'found', 'shown', 'said', 'kept', 'became', 'took', 'taken', 'led', 'drove'],
  ...['driven', 'won', 'lost', 'meant', 'went', 'gone', 'came', 'spent', 'left', 'chose'],
  ...['chosen', 'shrank', 'shrunk', 'beaten', 'slid'],
]

/** A verb's regular forms: as written, -s, -es, -d, -ed, -ing, with a doubled last letter, with -e dropped, -y as -ies and -ied. */
function forms(base: string): string[] {
  const last = base.at(-1) ?? ''
  const stem = base.slice(0, -1)
  return [
    base,
    `${base}s`,
    `${base}es`,
    `${base}d`,
    `${base}ed`,
    `${base}ing`,
    `${base}${last}ed`,
    `${base}${last}ing`,
    ...(last === 'e' ? [`${stem}ing`] : []),
    ...(last === 'y' ? [`${stem}ies`, `${stem}ied`] : []),
  ]
}

const VERB_FORMS = new Set([...AUXILIARIES, ...IRREGULAR, ...VERBS.flatMap(forms)])

/** True when the sentence has a number or a word the verb lists know: it states something. */
export function statesClaim(sentence: string): boolean {
  if (numbersIn(sentence).length > 0) return true
  const words = sentence.toLowerCase().match(/[a-z]+(?:['’][a-z]+)?/g) ?? []
  return words.some((word) => VERB_FORMS.has(word.replace('’', "'")))
}
