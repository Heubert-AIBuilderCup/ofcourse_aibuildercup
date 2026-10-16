// The line over a board that is not exactly hers: the closest road with a chip per answer it
// differs from, each saying in plain words what the difference means for its own question, or
// Priya's drawn as an illustration. A matched road, or the switch off, says nothing. Pure.

import type { Difference, RoadFor } from '@/features/roads'

/** Her stay answer, as the chip repeats it. */
const STAY_SAID: Record<string, string> = {
  Yes: "you'd stay",
  'Not sure': "you're not sure",
  No: "you'd go home",
}

/** The road's ending, as the stay rule reads it ("Stays" or "Goes home"). */
const STAY_ROAD: Record<string, string> = {
  Stays: 'leads to staying',
  'Goes home': 'ends at home',
  'No clear PR': 'has no clear road to PR',
}

/** One chip, for its key alone: "Level: this road is a Master's (you said Diploma)". */
function chip(d: Difference): string {
  switch (d.key) {
    // The road's own city; her hint, with its source, only in "you said".
    case 'place':
      return `City: ${d.road}${d.because ? `, ${d.because}` : ''} (you said ${d.yours})`
    case 'level':
      return `Level: this road is a ${d.road} (you said ${d.yours})`
    case 'field':
    case 'areas':
      return `Field: this road is ${d.road} (you picked ${d.yours})`
    case 'stay':
      return `Staying: this road ${STAY_ROAD[d.road] ?? d.road} (you said ${STAY_SAID[d.yours] ?? d.yours})`
    // Her last qualification, and how it shaped the road's level.
    case 'qual':
      return `Qualification: this road is a ${d.road}${d.because ? `; ${d.because}` : ''} (you said ${d.yours})`
  }
}

export type MatchLine = { title: string; chips: string[] }

export function matchLine(r: Pick<RoadFor, 'kind' | 'differences'>): MatchLine | null {
  if (r.kind === 'illustrative') {
    return { title: 'An illustrative road, drawn in the same shape as yours', chips: [] }
  }
  if (r.kind !== 'nearest') return null
  return { title: 'Closest road to your answers', chips: r.differences.map(chip) }
}
