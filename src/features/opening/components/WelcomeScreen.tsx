'use client'

import { ArrowRight, CircleHelp, Clock, Columns3, type LucideIcon } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useRef } from 'react'
import { FrameMarks } from '@/shared/components/Blueprint'
import { buttonVariants } from '@/shared/components/ui/button'
import { cn } from '@/shared/lib/utils'
import { PICTURE_PATH, WELCOME_MINUTES } from '../model/onboarding'
import shell from './onboarding.module.css'

const POINTS = [
  {
    icon: Clock,
    title: 'Five short steps, one question at a time',
    text: 'Everything saves as you go, so you can stop and pick up where you left off.',
    rise: shell.d5,
  },
  {
    icon: CircleHelp,
    title: 'Each question says why it asks',
    text: "“Not sure” and Skip are always fine. I'll assume a sensible default and show it as a chip you can change.",
    rise: shell.d6,
  },
  {
    icon: Columns3,
    title: 'Nothing ranked or recommended',
    text: 'We show what each choice would give you and what it would cost you. You decide what matters.',
    rise: shell.d7,
  },
] as const satisfies readonly { icon: LucideIcon; title: string; text: string; rise: string }[]

/**
 * The welcome before step 00 (the design's Welcome), the screen's own column in the onboarding
 * shell: how long it takes, what the answers shape, what she controls and what comes first, then
 * one action, Start, which opens step 00. No Back and no Skip. The heading takes focus when it
 * opens, so a screen reader starts there. `firstName` is empty when the account has no name
 * (email-code sign-ins). On a phone (below @xl) Start sits in a bar within thumb reach.
 */
export function WelcomeScreen({ firstName }: { firstName: string }) {
  const heading = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    heading.current?.focus({ preventScroll: true })
  }, [])

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 @max-xl:gap-4">
      <p className={cn(shell.rise, shell.d2, 'm-0 text-lead text-muted-foreground')}>
        {firstName ? `Welcome, ${firstName}.` : 'Welcome.'}
      </p>
      <h1
        ref={heading}
        tabIndex={-1}
        className={cn(
          shell.rise,
          shell.d3,
          'm-0 font-heading text-h1 font-semibold tracking-[-0.015em] outline-none',
        )}
      >
        {`About ${WELCOME_MINUTES} minutes of short questions`}
      </h1>
      <p
        className={cn(
          shell.rise,
          shell.d4,
          'm-0 max-w-prose leading-relaxed text-muted-foreground',
        )}
      >
        Your answers shape what OfCourse shows you: what you'd study, where you'd live, and what
        could come after.
      </p>

      <ul aria-label="How it works" className="m-0 mt-1 flex list-none flex-col p-0">
        {POINTS.map(({ icon: Icon, title, text, rise }) => (
          <li
            key={title}
            className={cn(
              shell.rise,
              rise,
              'grid grid-cols-[2.75rem_minmax(0,1fr)] items-start gap-4 border-t py-4 last:border-b',
              '@max-xl:grid-cols-[2.25rem_minmax(0,1fr)] @max-xl:gap-3 @max-xl:py-3.5',
            )}
          >
            <span className="flex size-11 items-center justify-center border text-accent-700 @max-xl:size-9">
              <Icon aria-hidden="true" strokeWidth={1.5} className="size-icon-lg" />
            </span>
            <div>
              <h2 className="m-0 mb-1 font-heading text-h4 font-semibold">{title}</h2>
              <p className="m-0 max-w-prose text-muted-foreground">{text}</p>
            </div>
          </li>
        ))}
      </ul>

      <div
        className={cn(
          shell.rise,
          shell.d7,
          'flex flex-col gap-1 border-l-2 border-accent-700 bg-accent-100/70 px-4 py-3',
        )}
      >
        <span className="text-overline uppercase text-accent-700">First · optional</span>
        <p className="m-0">
          How your comic character is drawn. It only sets the drawing in the comics, and you can
          skip it.
        </p>
      </div>

      <div
        className={cn(
          shell.rise,
          shell.d8,
          'mt-1 flex items-center justify-start gap-3.5',
          '@max-xl:sticky @max-xl:bottom-0 @max-xl:z-5 @max-xl:-mx-4 @max-xl:border-t @max-xl:bg-background @max-xl:px-4 @max-xl:pt-3 @max-xl:pb-[calc(0.75rem+env(safe-area-inset-bottom))]',
        )}
      >
        <Link
          href={PICTURE_PATH}
          className={cn(
            buttonVariants({ variant: 'strong', size: 'lg' }),
            'min-w-44 @max-xl:flex-1',
          )}
        >
          <FrameMarks />
          Start
          <ArrowRight aria-hidden="true" className="size-icon-sm" />
        </Link>
      </div>
    </div>
  )
}
