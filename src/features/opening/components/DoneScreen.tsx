'use client'

import Image from 'next/image'
import Link from 'next/link'
import { FrameMarks } from '@/shared/components/Blueprint'
import motion from '@/shared/components/motion.module.css'
import { buttonVariants } from '@/shared/components/ui/button'
import { cn } from '@/shared/lib/utils'
import { ATTENTION_PATH } from '../model/onboarding'
import shell from './onboarding.module.css'
import { StepHeading, StepKicker } from './StepHeading'

/**
 * The end of onboarding, after step 05 (the design's "You're all set"): what is saved, the duck on
 * the river, and the way back to her coins. `spent` is true when her coins are placed, false when
 * she left them for later. The heading takes focus on arrival, so a screen reader starts there.
 */
export function DoneScreen({ spent }: { spent: boolean }) {
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
      <div aria-hidden="true" className={cn(shell.river, 'relative mt-2 h-16')}>
        <span className="absolute inset-x-0 bottom-2 h-px bg-primary/55" />
        <span className={cn(shell.riverDuck, 'absolute bottom-1 left-0 w-13')}>
          <Image
            src="/brand/duck.png"
            alt=""
            width={64}
            height={59}
            loading="eager"
            className={cn(shell.duck, 'block h-auto w-full')}
          />
        </span>
      </div>
      <span className="text-caption text-muted-foreground">Keep floating.</span>
      <Link
        href={ATTENTION_PATH}
        className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'self-start')}
      >
        <FrameMarks />
        Back to Your attention
      </Link>
    </div>
  )
}
