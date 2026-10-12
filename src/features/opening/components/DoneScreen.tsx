'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useRef } from 'react'
import { FrameMarks } from '@/shared/components/Blueprint'
import { buttonVariants } from '@/shared/components/ui/button'
import { cn } from '@/shared/lib/utils'
import { ATTENTION_PATH } from '../model/onboarding'
import shell from './onboarding.module.css'

/**
 * The end of onboarding, after step 05 (the design's "You're all set"): what is saved, the duck on
 * the river, and the way back to her coins. `spent` is true when her coins are placed, false when
 * she left them for later. The heading takes focus on arrival, so a screen reader starts there.
 */
export function DoneScreen({ spent }: { spent: boolean }) {
  const heading = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    heading.current?.focus({ preventScroll: true })
  }, [])

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 pt-6 pb-12">
      <p className={cn(shell.rise, shell.d2, 'm-0 text-overline uppercase text-accent-700')}>
        Onboarding · done
      </p>
      <h1
        ref={heading}
        tabIndex={-1}
        className={cn(
          shell.rise,
          shell.d3,
          'm-0 mt-1 font-heading text-h1 font-semibold tracking-[-0.015em] outline-none',
        )}
      >
        You're all set
      </h1>
      <p
        className={cn(
          shell.rise,
          shell.d4,
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
