import { useState } from 'react'
import { type Coins, LIFE_VALUES } from '@/shared/types/student'
import { addCoin, NOT_SURE_SPREAD, refusal, removeCoin } from '../model/coins'

const EMPTY: number[] = LIFE_VALUES.map(() => 0)

/**
 * Step 05's piles as she moves coins: + places one unless model/coins.ts refuses it (then the
 * refused pile is kept, to say why), − takes one from a pile that has any, and "Not sure" places
 * the even spread, assumed until she moves a coin.
 */
export function useCoinPiles(initial: Extract<Coins, { state: 'spent' }> | null) {
  const [piles, setPiles] = useState<number[]>(initial?.piles ?? EMPTY)
  const [assumed, setAssumed] = useState(initial?.assumed ?? false)
  // The pile she changed last, whose line shows, and the pile whose + was refused.
  const [last, setLast] = useState<number | null>(null)
  const [refused, setRefused] = useState<number | null>(null)

  function plus(index: number) {
    if (refusal(piles, index) !== null) {
      setRefused(index)
      return
    }
    setPiles(addCoin(piles, index))
    setAssumed(false)
    setLast(index)
    setRefused(null)
  }

  function minus(index: number) {
    if (piles[index] <= 0) return
    setPiles(removeCoin(piles, index))
    setAssumed(false)
    setLast(index)
    setRefused(null)
  }

  function notSure() {
    setPiles([...NOT_SURE_SPREAD])
    setAssumed(true)
    setLast(null)
    setRefused(null)
  }

  return { piles, assumed, last, refused, plus, minus, notSure }
}
