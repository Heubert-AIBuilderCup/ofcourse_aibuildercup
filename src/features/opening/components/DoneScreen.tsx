'use client'

import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'
import { type LoaderKind, RoadmapLoader } from '@/features/roadmaps'
import motion from '@/shared/components/motion.module.css'
import { Pond } from '@/shared/components/Pond'
import { Button } from '@/shared/components/ui/button'
import { ROADMAPS_PATH } from '@/shared/lib/student-paths'
import { cn } from '@/shared/lib/utils'
import type { ActionResult } from '@/shared/types/action-result'
import { StepHeading, StepKicker } from './StepHeading'

/** A step's work fails the loader's step when its action is refused. */
async function ensure(action: () => Promise<ActionResult>): Promise<void> {
  const result = await action()
  if (!result.ok) throw new Error(result.error)
}

/**
 * The end of onboarding, after step 05 (the design's "You're all set"): what is saved, the duck in
 * its pond, and the way on to her roadmaps. `spent` is true when her coins are placed, false when
 * she left them for later; `finished` counts the roadmaps she had before this one. The heading
 * takes focus on arrival, so a screen reader starts there. "Go to your roadmaps" hides this screen
 * under the loader, whose first step finishes the roadmap she answered (which closes onboarding);
 * the loader stays up until her roadmaps have replaced this screen, so nothing of onboarding shows
 * again. Once it has run, the server refreshes her whole router (refreshAfterOnboardingAction), so Back
 * never shows a cached onboarding page (the client's own refresh clears this route only); asked
 * any earlier, it would re-render this screen, which sends her on and cuts the loader short. Then
 * this screen is replaced with her roadmaps, so Back does not return here: the list, or for a
 * second roadmap the list with the new one marked (`?made=`).
 */
export function DoneScreen({
  spent,
  finished,
  finishOnboardingAction,
  refreshAfterOnboardingAction,
}: {
  spent: boolean
  finished: number
  finishOnboardingAction: () => Promise<ActionResult<{ id: string }>>
  refreshAfterOnboardingAction: () => Promise<ActionResult>
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const madeId = useRef<string | null>(null)
  const kind: LoaderKind = finished === 0 ? 'first' : 'new'

  const work = [
    () =>
      ensure(async () => {
        const result = await finishOnboardingAction()
        if (result.ok) madeId.current = result.id
        return result
      }),
    // Real generation goes here; the mock road has nothing to draw.
    () => Promise.resolve(),
    // The list renders fresh when she lands on it; nothing to load ahead of it.
    () => Promise.resolve(),
  ]

  async function arrive() {
    const id = madeId.current
    // Her roadmaps either way: a refresh that fails only leaves the router's cache as it was.
    await refreshAfterOnboardingAction().catch(() => undefined)
    router.replace(
      kind === 'new' && id ? `${ROADMAPS_PATH}?made=${encodeURIComponent(id)}` : ROADMAPS_PATH,
    )
  }

  return (
    <>
      <div hidden={loading} className="mx-auto flex w-full max-w-2xl flex-col gap-4 pt-6 pb-12">
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
        <Pond className="mt-2" />
        <span className="text-caption text-muted-foreground">Keep floating.</span>
        <Button
          type="button"
          variant="strong"
          size="lg"
          onClick={() => setLoading(true)}
          className="self-start"
        >
          Go to your roadmaps
        </Button>
      </div>
      {loading ? <RoadmapLoader kind={kind} work={work} onDone={arrive} /> : null}
    </>
  )
}
