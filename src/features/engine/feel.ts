// "Might feel" on a future's line: DS-D4 from the line's effect and her weight, plus the Cost
// rule, which judges a route over her budget by how far over it is, whatever her weight.

import { type Effect, FEELS, type Feel, type Weight } from './types'

function dsD4(effect: Effect, weight: Weight): Feel {
  if (effect === 'gives') return weight >= 2 ? 'relieved' : 'fine'
  if (effect === 'costs') return weight === 3 ? 'hard' : weight === 2 ? 'stretched' : 'fine'
  return 'fine'
}

/** The heavier of two feels, in FEELS order. */
const atLeast = (feel: Feel, floor: Feel): Feel =>
  FEELS.indexOf(feel) >= FEELS.indexOf(floor) ? feel : floor

export function feelOf(
  effect: Effect,
  weight: Weight,
  cost?: { budgetK: number; totalK: number },
): Feel {
  const feel = dsD4(effect, weight)
  if (!cost || cost.totalK <= cost.budgetK) return feel
  // More than 20% over: over × 5 > budget, kept in whole numbers.
  if ((cost.totalK - cost.budgetK) * 5 > cost.budgetK) return 'hard'
  return atLeast(feel, 'stretched')
}
