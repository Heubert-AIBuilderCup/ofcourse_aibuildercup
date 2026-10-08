'use client'

import { Check, Layers } from 'lucide-react'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { Blueprint } from '@/shared/components/Blueprint'
import { SITE_NAME } from '@/shared/lib/site'
import { cn } from '@/shared/lib/utils'
import {
  FACT_QUESTIONS,
  factIndexOfPath,
  ONBOARDING_STEPS,
  type OnboardingStep,
  PANEL_COPY,
  stepOfPath,
} from '../model/onboarding'
import styles from './onboarding.module.css'

/** What the band (below @5xl) says is now and next, per step. */
function progress(step: OnboardingStep, question: number) {
  if (step === 0)
    return { now: 'Now: Your comic character · optional', next: 'Next: Facts about you' }
  return {
    now: `Now: 01 Facts about you · ${question} of ${FACT_QUESTIONS.length}`,
    next: `Next: ${ONBOARDING_STEPS[2]}`,
  }
}

/**
 * The steel panel beside every onboarding step: the brand, the step's title and lead, the steps
 * (the full list side by side, seven segments with Now and Next as a band) and the duck. The step
 * comes from the URL; on step 01 so does the question (its slug, the first when missing or unknown).
 * Steps before the current one are marked Done (criterion 22). Side by side it stays in view
 * while the step scrolls.
 */
export function OnboardingPanel() {
  const pathname = usePathname()
  const step = stepOfPath(pathname) ?? 0
  const index = Math.max(factIndexOfPath(pathname), 0)
  const copy = PANEL_COPY[step]
  const { now, next } = progress(step, index + 1)
  const badge = step === 0 ? 'Now · optional' : `Now · ${index + 1}/${FACT_QUESTIONS.length}`

  return (
    // Marked light: the steel panel keeps its look in a dark page (Industry's light tokens).
    <aside
      aria-label="Getting started"
      data-theme="light"
      className={cn(
        styles.grid,
        'split-panel relative flex flex-col justify-between gap-block overflow-hidden py-section text-panel-foreground',
        '@5xl:sticky @5xl:top-0 @5xl:min-h-dvh @5xl:self-start',
        '@max-5xl:justify-start @max-5xl:gap-5 @max-5xl:px-10 @max-5xl:pt-7 @max-5xl:pb-6',
        '@max-xl:flex-row @max-xl:flex-wrap @max-xl:items-center @max-xl:justify-between @max-xl:gap-y-2.5 @max-xl:px-4 @max-xl:pt-3 @max-xl:pb-3.5',
      )}
    >
      <div
        className={cn(
          styles.rise,
          styles.d1,
          'relative flex items-center gap-3 font-heading text-h4 font-semibold tracking-[-0.015em]',
        )}
      >
        <Blueprint
          className={cn(styles.onPanel, 'flex size-9 items-center justify-center @max-xl:size-8')}
        >
          <Layers aria-hidden="true" className="size-icon-md" />
        </Blueprint>
        <span>{SITE_NAME}</span>
      </div>

      <div className="relative flex max-w-110 flex-col gap-4 @max-5xl:max-w-130 @max-5xl:pr-18 @max-xl:order-2 @max-xl:mt-1.5 @max-xl:max-w-none @max-xl:basis-full @max-xl:gap-1.5 @max-xl:pr-0">
        <h2
          className={cn(
            styles.rise,
            styles.d2,
            'm-0 font-heading text-h1 leading-[1.04] font-semibold tracking-[-0.015em] text-panel-foreground',
          )}
        >
          {copy.title}
        </h2>
        <p className={cn(styles.rise, styles.d3, 'm-0 text-panel-foreground/80')}>{copy.lead}</p>
      </div>

      <ol
        aria-label="Your steps"
        className={cn(
          styles.rise,
          styles.d4,
          'relative m-0 flex max-w-110 list-none flex-col p-0 @max-5xl:hidden',
        )}
      >
        {ONBOARDING_STEPS.map((name, n) => (
          <li
            key={name}
            aria-current={n === step ? 'step' : undefined}
            className={cn(
              'grid min-h-9.5 grid-cols-[2.25rem_1fr_auto] items-center gap-2 border-t border-panel-foreground/12 text-caption text-panel-foreground/72 last:border-b',
              n < step && 'text-panel-foreground/82',
              n === step && 'font-medium text-panel-foreground',
            )}
          >
            <span
              className={cn(
                'text-micro',
                n === step ? 'text-panel-accent' : 'text-panel-foreground/50',
              )}
            >
              {String(n).padStart(2, '0')}
            </span>
            <span>{name}</span>
            {n < step ? (
              <span className="inline-flex items-center gap-1 text-micro uppercase text-panel-foreground/70">
                <Check aria-hidden="true" className="size-icon-xs" />
                Done
              </span>
            ) : n === step ? (
              <span className="border border-panel-accent/60 px-2 py-0.5 text-micro uppercase text-panel-accent">
                {badge}
              </span>
            ) : (
              <span />
            )}
          </li>
        ))}
      </ol>

      <div
        className={cn(
          styles.rise,
          styles.d4,
          'relative hidden max-w-130 flex-col gap-2 @max-5xl:flex @max-5xl:pr-18 @max-xl:order-3 @max-xl:mt-1 @max-xl:max-w-none @max-xl:basis-full @max-xl:gap-1.5 @max-xl:pr-0',
        )}
      >
        <div aria-hidden="true" className="grid grid-cols-7 gap-1">
          {ONBOARDING_STEPS.map((name, n) => (
            <span
              key={name}
              className={cn(
                'h-1',
                n < step && 'bg-panel-accent/55',
                n === step && 'bg-panel-accent',
                n > step && 'bg-panel-foreground/22',
              )}
            />
          ))}
        </div>
        <p className="m-0 flex flex-wrap justify-between gap-x-4 gap-y-1 text-caption text-panel-foreground/78">
          <span className="font-medium text-panel-foreground">
            <span className="sr-only">{`Step ${step} of ${ONBOARDING_STEPS.length - 1}. `}</span>
            {now}
          </span>
          <span>{next}</span>
        </p>
      </div>

      <div
        className={cn(
          styles.rise,
          styles.d5,
          'relative flex h-18 items-end gap-3',
          '@max-5xl:absolute @max-5xl:right-10 @max-5xl:bottom-3 @max-5xl:h-14',
          // The phone band gives the duck's place to the header menu.
          '@max-xl:hidden',
        )}
      >
        <span
          aria-hidden="true"
          className="absolute inset-x-0 bottom-1.5 h-px bg-panel-foreground/30 @max-5xl:hidden"
        />
        <Image
          src="/brand/duck.png"
          alt=""
          width={64}
          height={59}
          loading="eager"
          className={cn(styles.duck, 'block h-auto w-16 @max-5xl:w-14')}
        />
        <span className="pb-3.5 text-caption text-panel-foreground/70 @max-5xl:hidden">
          From off course to “Of Course!”
        </span>
      </div>
    </aside>
  )
}
