'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { FrameMarks } from '@/shared/components/Blueprint'
import { Button, buttonVariants } from '@/shared/components/ui/button'
import { cn } from '@/shared/lib/utils'
import type { ActionResult } from '@/shared/types/action-result'
import { type Coins, LIFE_VALUES } from '@/shared/types/student'
import {
  addCoin,
  COINS_ASSUMED,
  COINS_HINT,
  COINS_INTRO,
  COINS_TOTAL,
  canFinish,
  coinLine,
  MAX_PER_PILE,
  NOT_SURE_SPREAD,
  placed,
  removeCoin,
} from '../model/coins'
import { SAVE_FAILED } from '../model/messages'
import { FUTURES_PATH } from '../model/onboarding'
import styles from './coins.module.css'
import { Hero } from './Hero'
import { Progress, SCREEN_COUNT } from './Progress'

const COINS = Array.from({ length: COINS_TOTAL }, (_, i) => i)
const SLOTS = Array.from({ length: MAX_PER_PILE }, (_, i) => i)
const EMPTY: number[] = LIFE_VALUES.map(() => 0)

// A coin she chose is solid; one the spread placed for her is hatched, so it reads as an assumption.
const HATCHED = cn('border border-primary-strong', styles.hatched)

const coinsLeft = (n: number) => (n === 1 ? '1 coin left to place' : `${n} coins left to place`)

/** The pile's five slots, filled from the bottom: one per coin on it. */
function Pile({ count, assumed }: { count: number; assumed: boolean }) {
  return (
    <div aria-hidden="true" className="flex flex-col gap-1">
      {SLOTS.map((slot) => (
        <span
          key={slot}
          className={cn(
            'h-2 rounded-full border',
            // Slot 0 is the top; the bottom `count` are filled.
            slot >= MAX_PER_PILE - count
              ? assumed
                ? HATCHED
                : 'border-primary-strong bg-primary-strong'
              : 'border-accent-300',
          )}
        />
      ))}
    </div>
  )
}

/**
 * Screen 6, "Your attention" (frames r1-7 to r1-9): ten coins over eight life values, five on a
 * pile at most. Optional: she can spend them later. The piles and the one line under them are
 * local state; nothing is saved until Done or "Spend them later", and coins never reach her
 * answers or her futures (DS-R7).
 */
export function CoinsScreen({
  initial,
  saveCoinsAction,
}: {
  initial: Extract<Coins, { state: 'spent' }> | null
  saveCoinsAction: (coins: Coins) => Promise<ActionResult>
}) {
  const router = useRouter()
  const [piles, setPiles] = useState<number[]>(initial?.piles ?? EMPTY)
  const [assumed, setAssumed] = useState(initial?.assumed ?? false)
  // The pile she changed last, whose effect the line shows.
  const [last, setLast] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const total = placed(piles)

  function change(index: number, next: number[]) {
    setPiles(next)
    setAssumed(false)
    setLast(index)
  }

  function spreadForMe() {
    setPiles([...NOT_SURE_SPREAD])
    setAssumed(true)
    setLast(null)
  }

  function startAgain() {
    setPiles(EMPTY)
    setAssumed(false)
    setLast(null)
  }

  async function save(coins: Coins) {
    setPending(true)
    setError(null)
    try {
      const result: ActionResult = await saveCoinsAction(coins)
      if (result.ok) {
        router.push(FUTURES_PATH)
        return
      }
      setError(result.error)
    } catch {
      setError(SAVE_FAILED)
    }
    setPending(false)
  }

  const line = assumed ? COINS_ASSUMED : last === null ? COINS_HINT : coinLine(last, piles[last])

  return (
    // The container the phone layout (@max-[35rem]) and the wide grid (@min-[48rem]) query.
    <div className="@container">
      <Hero
        overline={`Getting started · step ${SCREEN_COUNT} of ${SCREEN_COUNT} · optional`}
        title="Your attention"
        sub={COINS_INTRO}
      />
      <div className="flex max-w-5xl flex-col gap-block px-gutter py-section @max-[35rem]:px-5 @max-[35rem]:py-6">
        <Progress step={SCREEN_COUNT} />

        <div className="flex items-center gap-3">
          <div aria-hidden="true" className="flex gap-1">
            {COINS.map((coin) => (
              <span
                key={coin}
                className={cn(
                  'size-3.5 rounded-full border border-primary-strong',
                  // The coins still in hand are solid; each one placed leaves an empty ring.
                  coin < COINS_TOTAL - total && 'bg-primary-strong',
                )}
              />
            ))}
          </div>
          <p role="status" className="m-0 text-caption uppercase text-muted-foreground">
            {total === COINS_TOTAL ? `All ${COINS_TOTAL} placed` : coinsLeft(COINS_TOTAL - total)}
          </p>
        </div>

        <ul className="m-0 grid list-none grid-cols-2 gap-3 p-0 @min-[48rem]:grid-cols-4">
          {LIFE_VALUES.map((value, index) => (
            <li
              key={value}
              className={cn(
                'flex flex-col gap-3 border p-3',
                last === index && !assumed ? 'border-primary bg-accent-100' : 'border-border',
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <h2 className="m-0 font-heading text-h4 font-semibold">{value}</h2>
                <span className="font-heading text-h4" aria-hidden="true">
                  {piles[index]}
                </span>
              </div>
              <Pile count={piles[index]} assumed={assumed} />
              <div className="mt-auto grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  aria-label={`Take a coin from ${value}`}
                  disabled={piles[index] <= 0}
                  onClick={() => change(index, removeCoin(piles, index))}
                  className="h-11"
                >
                  −
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  aria-label={`Add a coin to ${value}`}
                  disabled={piles[index] >= MAX_PER_PILE || total >= COINS_TOTAL}
                  onClick={() => change(index, addCoin(piles, index))}
                  className="h-11"
                >
                  +
                </Button>
              </div>
            </li>
          ))}
        </ul>

        <div className="flex max-w-xl flex-col gap-3">
          <p
            role="status"
            className={cn(
              'm-0 border bg-background px-3 py-2',
              assumed ? 'border-dashed border-primary-strong' : 'border-foreground',
            )}
          >
            {line}
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="outline"
              aria-pressed={assumed}
              disabled={pending}
              onClick={spreadForMe}
              className="h-11 font-sans text-base font-normal aria-pressed:border-primary-strong aria-pressed:bg-primary-strong aria-pressed:text-primary-strong-foreground"
            >
              Not sure · spread them for me
            </Button>
            <button
              type="button"
              disabled={pending}
              onClick={startAgain}
              className="min-h-11 bg-transparent px-1 underline underline-offset-4 hover:text-primary-strong"
            >
              Start again
            </button>
          </div>

          {error ? (
            <p className="m-0 text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Link
              href={FUTURES_PATH}
              className={buttonVariants({ variant: 'outline', size: 'lg' })}
            >
              <FrameMarks />
              Back
            </Link>
            <Button
              type="button"
              variant="outline"
              size="lg"
              disabled={pending}
              onClick={() => void save({ state: 'later' })}
            >
              Spend them later
            </Button>
            <Button
              type="button"
              variant="strong"
              size="lg"
              disabled={pending || !canFinish(piles)}
              onClick={() => void save({ state: 'spent', piles, assumed })}
              className="h-auto min-h-11 flex-1 whitespace-normal text-center"
            >
              {canFinish(piles) ? 'Done' : 'Place all ten to finish'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
