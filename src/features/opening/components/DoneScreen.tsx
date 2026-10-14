'use client'

import { useRouter } from 'next/navigation'
import { Duck } from '@/shared/components/Duck'
import motion from '@/shared/components/motion.module.css'
import { Note } from '@/shared/components/Note'
import { Button } from '@/shared/components/ui/button'
import { cn } from '@/shared/lib/utils'
import type { ActionResult } from '@/shared/types/action-result'
import { useSubmit } from '../model/answer-save'
import { ROAD_PATH } from '../model/onboarding'
import shell from './onboarding.module.css'
import { StepHeading, StepKicker } from './StepHeading'

/**
 * The end of onboarding, after step 05 (the design's "You're all set"): what is saved, the duck in
 * its pond, and the way on to her road. `spent` is true when her coins are placed, false when
 * she left them for later. The heading takes focus on arrival, so a screen reader starts there.
 * "Go to your road" records that she finished (which locks onboarding) and only then replaces this
 * screen with her road, so Back does not return here; a failed save keeps her here to press again.
 */
export function DoneScreen({
  spent,
  finishOnboardingAction,
}: {
  spent: boolean
  finishOnboardingAction: () => Promise<ActionResult>
}) {
  const router = useRouter()
  const { pending, failed, submit } = useSubmit(
    () => finishOnboardingAction(),
    () => router.replace(ROAD_PATH),
  )

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 pt-6 pb-12">
      <StepKicker className={cn(motion.rise, motion.d2)}>Onboarding · done</StepKicker>
      <StepHeading focusOnArrival className={cn(motion.rise, motion.d3, 'mt-1')}>
        You're all set
      </StepHeading>
      <p
        className={cn(
          motion.rise,
          motion.d4,
          'm-0 max-w-prose leading-relaxed text-muted-foreground',
        )}
      >
        {spent
          ? 'Your answers and your ten coins are saved. You can change any of them later.'
          : 'Your answers are saved. You can spend your ten coins any time.'}
      </p>
      <div aria-hidden="true" className={cn(shell.pond, 'mt-2')}>
        <span className={cn(shell.wave, shell.waveBack)} />
        <span className={shell.swim}>
          <span className={shell.ripple} />
          <span className={shell.ripple} />
          <span className={shell.turn}>
            <Duck size="3.75rem" eager className={shell.pondDuck} />
          </span>
        </span>
        <span className={cn(shell.wave, shell.waveFront)} />
      </div>
      <span className="text-caption text-muted-foreground">Keep floating.</span>
      {failed ? (
        <Note tone="limit" role="alert" appear>
          We couldn't save that. Try again.
        </Note>
      ) : null}
      <Button
        type="button"
        variant="strong"
        size="lg"
        aria-disabled={pending}
        aria-busy={pending}
        onClick={() => void submit(undefined)}
        className="self-start aria-disabled:opacity-60"
      >
        Go to your road
      </Button>
    </div>
  )
}
