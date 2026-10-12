'use client'

import { ArrowLeft, ArrowRight, CircleAlert, Info, Lock, Minus, Plus } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useId, useState } from 'react'
import { Button } from '@/shared/components/ui/button'
import { cn } from '@/shared/lib/utils'
import type { ActionResult } from '@/shared/types/action-result'
import { type Coins, LIFE_VALUES } from '@/shared/types/student'
import {
  COINS_ALL_PLACED,
  COINS_ASSUMED,
  COINS_HINT,
  COINS_INTRO,
  COINS_TOTAL,
  canFinish,
  coinLine,
  doneLine,
  MAX_PER_PILE,
  placed,
  refusal,
} from '../model/coins'
import { SAVE_FAILED } from '../model/messages'
import { DONE_PATH, questionPath } from '../model/onboarding'
import shell from './onboarding.module.css'
import picture from './picture.module.css'
import { useCoinPiles } from './useCoinPiles'

const TRAY = Array.from({ length: COINS_TOTAL }, (_, i) => i)
const STACK = Array.from({ length: MAX_PER_PILE }, (_, i) => i)
/** Back opens step 04's last question. */
const BACK_PATH = questionPath(4, 'settle')
/** The grey note: the back note and a refused +. */
const NOTE = 'border-l-2 border-neutral-600 bg-neutral-100 px-3.5 py-2.5 text-caption'
/** The accent line under a change: the assumed spread and a pile's line. */
const IMPACT = 'flex items-start gap-2.5 border-l-2 border-accent-700 bg-accent-100/70'

/** One coin: a dashed ring while free, filled once placed. */
function Coin({ on }: { on: boolean }) {
  return (
    <i
      className={cn(
        'block size-4.5 rounded-full border motion-safe:transition-colors motion-safe:duration-200',
        on
          ? 'border-accent-700 bg-accent-700 inset-ring-2 inset-ring-background'
          : 'border-dashed border-neutral-400',
        '@max-xl:size-4',
      )}
    />
  )
}

/**
 * Onboarding step 05, "Your attention" (the design's Coins): ten coins over eight piles, five on a
 * pile at most, on the onboarding shell. Optional. The pile she changed last says what it now
 * shows; a + that cannot place says why under its pile. "Not sure" places the even spread, assumed
 * until she moves a coin. Nothing is saved until Done (exactly ten) or "Spend them later"; either
 * ends onboarding on /onboarding/done, and a refused save keeps her here with Try again. Coins
 * never change her routes. The rules are model/coins.ts's.
 */
export function AttentionScreen({
  initial,
  saveCoinsAction,
}: {
  initial: Extract<Coins, { state: 'spent' }> | null
  saveCoinsAction: (coins: Coins) => Promise<ActionResult>
}) {
  const router = useRouter()
  const { piles, assumed, last, refused, plus, minus, notSure } = useCoinPiles(initial)
  // The save that failed, for Try again, and what it said.
  const [failed, setFailed] = useState<{ coins: Coins; error: string } | null>(null)
  const [pending, setPending] = useState(false)
  const doneWhyId = useId()

  const total = placed(piles)
  const full = canFinish(piles)

  async function save(coins: Coins) {
    if (pending) return
    setPending(true)
    setFailed(null)
    try {
      const result = await saveCoinsAction(coins)
      if (result.ok) {
        router.push(DONE_PATH)
        return
      }
      setFailed({ coins, error: result.error })
    } catch {
      setFailed({ coins, error: SAVE_FAILED })
    }
    setPending(false)
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 @max-xl:gap-4">
      <div className={cn(shell.rise, shell.d2, 'flex min-h-11 items-center')}>
        <p className="m-0 text-overline uppercase text-accent-700">
          Your attention · <b className="font-medium text-muted-foreground">optional</b>
        </p>
      </div>

      <h1
        className={cn(
          shell.rise,
          shell.d3,
          'm-0 font-heading text-h1 font-semibold tracking-[-0.015em] outline-none',
        )}
      >
        Your attention
      </h1>
      <p className={cn(shell.rise, shell.d4, 'm-0 max-w-prose text-lead')}>{COINS_INTRO}</p>
      <p
        className={cn(
          shell.rise,
          shell.d4,
          '-mt-2 flex items-start gap-2 text-caption text-muted-foreground',
        )}
      >
        <Info aria-hidden="true" className="icon-on-line-sm size-icon-sm shrink-0" />
        <span>{COINS_HINT}</span>
      </p>

      {initial ? (
        <p className={cn(shell.rise, shell.d4, 'm-0', NOTE)}>
          Here's where you placed them last time. Move any, or keep them as they are.
        </p>
      ) : null}

      <div
        className={cn(
          shell.rise,
          shell.d5,
          'flex flex-wrap items-center gap-x-4 gap-y-3 border border-border px-4 py-3.5 @max-xl:p-3',
        )}
      >
        <span aria-hidden="true" className="inline-flex gap-1.5 @max-xl:gap-1">
          {TRAY.map((coin) => (
            <Coin key={coin} on={coin < total} />
          ))}
        </span>
        <p aria-live="polite" className="m-0 text-muted-foreground">
          <b className="font-heading text-h4 font-semibold text-foreground">
            {total} of {COINS_TOTAL}
          </b>{' '}
          placed
        </p>
        <button
          type="button"
          onClick={notSure}
          className={cn(
            'ml-auto flex min-h-11 cursor-pointer items-center gap-2 border border-dashed border-border bg-transparent px-3 font-medium text-muted-foreground',
            'hover:border-foreground/40 hover:text-foreground',
            'focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-primary',
            '@max-xl:ml-0',
          )}
        >
          <span
            aria-hidden="true"
            className="flex size-5 shrink-0 items-center justify-center rounded-full border border-current text-caption leading-none"
          >
            ?
          </span>
          Not sure
        </button>
      </div>

      {/* Always rendered, so the assumed spread and "all ten placed" are announced; empty, it
          leaves the flow. */}
      <div role="status" className="-mt-2 flex flex-col gap-2 empty:absolute">
        {assumed ? (
          <div className={cn(IMPACT, 'border-dashed px-4 py-3')}>
            <ArrowRight
              aria-hidden="true"
              className="icon-on-line-sm size-icon-sm shrink-0 text-accent-700"
            />
            <p className="m-0">{COINS_ASSUMED}</p>
          </div>
        ) : null}
        {total === COINS_TOTAL ? (
          <p className={cn('m-0 flex items-start gap-2', NOTE)}>
            <Info
              aria-hidden="true"
              className="icon-on-line-sm size-icon-sm shrink-0 text-neutral-700"
            />
            <span>{COINS_ALL_PLACED}</span>
          </p>
        ) : null}
      </div>

      <ul
        aria-label="Eight piles"
        className={cn(
          shell.rise,
          shell.d6,
          'm-0 grid list-none grid-cols-2 gap-3 p-0 @max-xl:grid-cols-1 @max-xl:gap-2',
        )}
      >
        {LIFE_VALUES.map((name, index) => {
          const n = piles[index]
          const capped = refusal(piles, index) !== null
          // A tap on an unavailable + says why on its card, where she tapped.
          const why = refused === index ? refusal(piles, index) : null
          const showLine = last === index && why === null
          return (
            <li
              key={name}
              className={cn(
                'flex flex-col gap-2.5 border border-border py-3.5 pr-3.5 pl-4 motion-safe:transition-colors',
                '@max-xl:py-2.5 @max-xl:pr-2.5 @max-xl:pl-3.5',
                n > 0 && 'border-accent-700/55',
                showLine && 'border-accent-700 inset-ring inset-ring-accent-700',
              )}
            >
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2">
                <span className="font-heading text-lead leading-tight font-semibold">{name}</span>
                <span aria-hidden="true" className="col-start-1 row-start-2 inline-flex gap-1.25">
                  {STACK.map((slot) => (
                    <Coin key={slot} on={slot < n} />
                  ))}
                </span>
                <span className="col-start-2 row-span-2 row-start-1 flex items-center gap-1">
                  <button
                    type="button"
                    aria-label={`Take a coin from ${name}`}
                    aria-disabled={n <= 0}
                    onClick={() => minus(index)}
                    className={cn(
                      'flex size-11 cursor-pointer items-center justify-center border border-border bg-background text-foreground',
                      'hover:border-foreground/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
                      'aria-disabled:cursor-not-allowed aria-disabled:opacity-40 aria-disabled:hover:border-border',
                    )}
                  >
                    <Minus aria-hidden="true" strokeWidth={1.5} className="size-icon" />
                  </button>
                  <span className="min-w-6 text-center font-heading text-h4 font-semibold">
                    <span aria-hidden="true">{n}</span>
                    <span className="sr-only">
                      {n} of {MAX_PER_PILE} on {name}
                    </span>
                  </span>
                  <button
                    type="button"
                    aria-label={`Place a coin on ${name}`}
                    // Unavailable, not disabled: a tap still says why, and Tab still reaches it.
                    aria-disabled={capped}
                    onClick={() => plus(index)}
                    className={cn(
                      'flex size-11 cursor-pointer items-center justify-center border bg-background aria-disabled:cursor-not-allowed',
                      'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
                      capped
                        ? 'border-dashed border-neutral-500 text-neutral-600'
                        : 'border-accent-700 text-accent-800 hover:bg-accent-100',
                    )}
                  >
                    <Plus aria-hidden="true" strokeWidth={1.5} className="size-icon" />
                  </button>
                </span>
              </div>

              {/* Always rendered, so a refusal or a new line is announced; empty, it leaves the
                  flow and adds no gap under the pile. */}
              <div aria-live="polite" className="empty:absolute">
                {why ? (
                  <p className={cn(picture.errorIn, 'm-0 flex items-start gap-2', NOTE)}>
                    <Info
                      aria-hidden="true"
                      className="icon-on-line-sm size-icon-sm shrink-0 text-neutral-700"
                    />
                    <span>{why}</span>
                  </p>
                ) : null}
                {showLine ? (
                  <div className={cn(IMPACT, 'px-3 py-2 text-caption')}>
                    <ArrowRight
                      aria-hidden="true"
                      className="icon-on-line-sm size-icon-sm shrink-0 text-accent-700"
                    />
                    <p className="m-0">{coinLine(index, n)}</p>
                  </div>
                ) : null}
              </div>
            </li>
          )
        })}
      </ul>

      <p className="m-0 flex items-start gap-2 text-caption text-muted-foreground">
        <Lock aria-hidden="true" className="icon-on-line-sm size-icon-sm shrink-0" />
        <span>Your routes stay exactly as they are, whatever you place here.</span>
      </p>

      {failed ? (
        <div
          role="alert"
          className={cn(
            picture.errorIn,
            'flex flex-wrap items-center gap-x-2.5 gap-y-2 border border-danger-300 bg-danger-100 px-3.5 py-2.5 text-caption text-danger-800',
          )}
        >
          <CircleAlert aria-hidden="true" className="size-icon shrink-0 text-danger-700" />
          <span className="min-w-45 flex-1">{failed.error}</span>
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => void save(failed.coins)}
            className="h-11 border-danger-300 px-3.5 text-danger-800 hover:bg-danger-200 hover:text-danger-800"
          >
            Try again
          </Button>
        </div>
      ) : null}

      <p
        id={doneWhyId}
        className="m-0 -mb-3 text-right text-caption text-muted-foreground @max-xl:mb-0 @max-xl:text-left"
      >
        {doneLine(piles)}
      </p>
      <button
        type="button"
        disabled={pending}
        onClick={() => void save({ state: 'later' })}
        className="-mb-2 inline-flex min-h-11 cursor-pointer items-center self-start bg-transparent text-caption font-medium text-accent-700 underline-offset-3 hover:text-accent-800 hover:underline"
      >
        Spend them later: finish without placing coins
      </button>

      <div
        className={cn(
          shell.rise,
          shell.d8,
          'mt-1 flex items-center justify-between gap-3.5',
          '@max-xl:sticky @max-xl:bottom-0 @max-xl:z-5 @max-xl:-mx-4 @max-xl:border-t @max-xl:bg-background @max-xl:px-4 @max-xl:pt-3 @max-xl:pb-[calc(0.75rem+env(safe-area-inset-bottom))]',
        )}
      >
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={() => router.push(BACK_PATH)}
          className="min-w-33 @max-xl:min-w-24 @max-xl:flex-none"
        >
          <ArrowLeft aria-hidden="true" className="size-icon-sm" />
          Back
        </Button>
        <Button
          type="button"
          variant={full ? 'strong' : 'outline'}
          size="lg"
          aria-disabled={!full || pending}
          aria-describedby={doneWhyId}
          onClick={() => {
            if (full) void save({ state: 'spent', piles, assumed })
          }}
          className="min-w-33 aria-disabled:cursor-not-allowed aria-disabled:opacity-60 @max-xl:min-w-0 @max-xl:flex-1"
        >
          Done
          <ArrowRight aria-hidden="true" className="size-icon-sm" />
        </Button>
      </div>
    </div>
  )
}
