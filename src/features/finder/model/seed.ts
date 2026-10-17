// What the Find box starts with (criterion 2): the quotes her study-step tags were read from, then
// the field or areas she stated. Never her raw own words: they can hold what she feels, which the
// privacy page promises never reaches the models that write explanations; her tags have already
// been split, so a wellbeing one is left out here. Pure.

import { DEFAULTS, effective, isAssumed } from '@/features/opening/model/questions'
import type { Roadmap } from '@/shared/types/student'

/** A sentence for a quote: its own stop kept, else a full stop added. */
const sentence = (quote: string): string => {
  const said = quote.trim()
  return /[.!?]$/.test(said) ? said : `${said}.`
}

/** "A", "A and B", "A, B and C". */
const listed = (items: string[]): string =>
  items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`

/** Her stated field (not its default) and her stated areas, in that order. */
function drawnTo(answers: Roadmap['answers']): string[] {
  const picks: string[] = []
  const field = effective(answers, 'field')
  if (!isAssumed(answers, 'field') && typeof field === 'string' && field !== DEFAULTS.field) {
    picks.push(field)
  }
  const areas = effective(answers, 'areas')
  if (!isAssumed(answers, 'areas') && Array.isArray(areas)) picks.push(...areas)
  return picks
}

/** The Find box's first text; '' when she gave neither a study-step tag nor a field or areas. */
export function finderSeedText({ answers, tags }: Pick<Roadmap, 'answers' | 'tags'>): string {
  const quotes = tags
    .filter((t) => t.step === 'study' && !t.wellbeing)
    .map((t) => sentence(t.quote))
  const picks = drawnTo(answers)
  if (picks.length > 0) quotes.push(`I'm drawn to ${listed(picks)}.`)
  return quotes.join(' ')
}
