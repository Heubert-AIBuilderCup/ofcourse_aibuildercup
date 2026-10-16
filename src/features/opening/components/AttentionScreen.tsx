'use client'

import { ArrowLeft, ArrowRight, Lock, Minus, Plus } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useId } from 'react'
import motion from '@/shared/components/motion.module.css'
import { Note } from '@/shared/components/Note'
import { Button } from '@/shared/components/ui/button'
import { cn } from '@/shared/lib/utils'
import type { ActionResult } from '@/shared/types/action-result'
import { COINS_TOTAL, type Coins, LIFE_VALUES, MAX_PER_PILE } from '@/shared/types/student'
import { useSubmit } from '../model/answer-save'
import {
  COINS_ALL_PLACED,
  COINS_ASSUMED,
  COINS_HINT,
  COINS_INTRO,
  canFinish,
  coinLine,
  doneLine,
  placed,
  refusal,
} from '../model/coins'
import { DONE_PATH, questionPath } from '../model/onboarding'
import { SaveFailed } from './SaveFailed'
import { StepActions } from './StepActions'
import { StepHeading, StepKicker } from './StepHeading'
import { useCoinPiles } from './useCoinPiles'

const TRAY = Array.from({ length: COINS_TOTAL }, (_, i) => i)
const STACK = Array.from({ length: MAX_PER_PILE }, (_, i) => i)
/** Back opens step 04's last question. */
const BACK_PATH = questionPath(4, 'settle')

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
  const { pending, failed, submit, retry } = useSubmit(saveCoinsAction, () =>
    router.push(DONE_PATH),
  )
  const doneWhyId = useId()

  const total = placed(piles)
  const full = canFinish(piles)

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 @max-xl:gap-4">
      <div className={cn(motion.rise, motion.d2, 'flex min-h-11 items-center')}>
        <StepKicker detail="optional">Your attention</StepKicker>
      </div>

      <StepHeading className={cn(motion.rise, motion.d3)}>Your attention</StepHeading>
      <p className={cn(motion.rise, motion.d4, 'm-0 max-w-prose text-lead')}>{COINS_INTRO}</p>
      <Note tone="hint" className={cn(motion.rise, motion.d4, '-mt-2')}>
        {COINS_HINT}
      </Note>

      {initial ? (
        <Note tone="limit" icon={null} className={cn(motion.rise, motion.d4, 'text-caption')}>
          Here's where you placed them last time. Move any, or keep them as they are.
        </Note>
      ) : null}

      <div
        className={cn(
          motion.rise,
          motion.d5,
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
        <Button
          type="button"
          variant="square"
          onClick={notSure}
          className="ml-auto h-11 gap-2 border-dashed px-3 font-sans text-base font-medium text-muted-foreground hover:text-foreground @max-xl:ml-0"
        >
          <span
            aria-hidden="true"
            className="flex size-5 shrink-0 items-center justify-center rounded-full border border-current text-caption leading-none"
          >
            ?
          </span>
          Not sure
        </Button>
      </div>

      {/* Always rendered, so the assumed spread and "all ten placed" are announced; empty, it
          leaves the flow. */}
      <div role="status" className="-mt-2 flex flex-col gap-2 empty:absolute">
        {assumed ? (
          <Note tone="impact" appear className="border-dashed">
            {COINS_ASSUMED}
          </Note>
        ) : null}
        {total === COINS_TOTAL ? (
          <Note tone="limit" appear className="text-caption">
            {COINS_ALL_PLACED}
          </Note>
        ) : null}
      </div>

      <ul
        aria-label="Eight piles"
        className={cn(
          motion.rise,
          motion.d6,
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
                  <Button
                    type="button"
                    variant="square"
                    size="icon-lg"
                    aria-label={`Take a coin from ${name}`}
                    aria-disabled={n <= 0}
                    onClick={() => minus(index)}
                    className="bg-background"
                  >
                    <Minus aria-hidden="true" strokeWidth={1.5} className="size-icon" />
                  </Button>
                  <span className="min-w-6 text-center font-heading text-h4 font-semibold">
                    <span aria-hidden="true">{n}</span>
                    <span className="sr-only">
                      {n} of {MAX_PER_PILE} on {name}
                    </span>
                  </span>
                  <Button
                    type="button"
                    variant="square"
                    size="icon-lg"
                    aria-label={`Place a coin on ${name}`}
                    // Unavailable, not disabled: a tap still says why, and Tab still reaches it.
                    aria-disabled={capped}
                    onClick={() => plus(index)}
                    className={cn(
                      'bg-background',
                      // Capped, it reads dashed rather than faded: the tap still answers.
                      capped
                        ? 'border-dashed border-neutral-500 text-neutral-600 aria-disabled:opacity-100 aria-disabled:hover:border-neutral-500'
                        : 'border-accent-700 text-accent-800 hover:border-accent-700 hover:bg-accent-100',
                    )}
                  >
                    <Plus aria-hidden="true" strokeWidth={1.5} className="size-icon" />
                  </Button>
                </span>
              </div>

              {/* Always rendered, so a refusal or a new line is announced; empty, it leaves the
                  flow and adds no gap under the pile. */}
              <div aria-live="polite" className="empty:absolute">
                {why ? (
                  <Note tone="limit" appear className="text-caption">
                    {why}
                  </Note>
                ) : null}
                {showLine ? (
                  <Note
                    key={coinLine(index, n)}
                    tone="impact"
                    appear
                    className="px-3 py-2 text-caption"
                  >
                    {coinLine(index, n)}
                  </Note>
                ) : null}
              </div>
            </li>
          )
        })}
      </ul>

      <Note
        tone="hint"
        icon={<Lock aria-hidden="true" className="icon-on-line-sm size-icon-sm shrink-0" />}
      >
        Your routes stay exactly as they are, whatever you place here.
      </Note>

      {failed ? (
        <SaveFailed message={failed.error} pending={pending} onRetry={() => void retry()} />
      ) : null}

      <p
        id={doneWhyId}
        className="m-0 -mb-3 text-right text-caption text-muted-foreground @max-xl:mb-0 @max-xl:text-left"
      >
        {doneLine(piles)}
      </p>
      <Button
        type="button"
        variant="text"
        disabled={pending}
        onClick={() => void submit({ state: 'later' })}
        className="-mb-2 self-start"
      >
        Spend them later: finish without placing coins
      </Button>

      <StepActions className="justify-between">
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
            if (full) void submit({ state: 'spent', piles, assumed })
          }}
          className="min-w-33 aria-disabled:opacity-60 @max-xl:min-w-0 @max-xl:flex-1"
        >
          Done
          <ArrowRight aria-hidden="true" className="size-icon-sm" />
        </Button>
      </StepActions>
    </div>
  )
}
