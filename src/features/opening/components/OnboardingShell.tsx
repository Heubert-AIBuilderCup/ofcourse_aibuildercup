import type { ReactNode } from 'react'
import motion from '@/shared/components/motion.module.css'
import { cn } from '@/shared/lib/utils'
import type { StoredAnswers } from '@/shared/types/student'
import { OnboardingAnswersProvider } from '../model/onboarding-answers'
import { AccountMenu } from './AccountMenu'
import { OnboardingPanel } from './OnboardingPanel'

/**
 * The page every onboarding step sits in: the steel panel beside the step's own column. The page
 * is a container: split side by side from @5xl (64rem), the panel a band on top below it, and the
 * phone layout below @xl (36rem); above the cap the content stays in a centred frame while the
 * panel's colour runs to the edge (split-page). Each step brings its own content wrapper, since
 * each sets its own gap. It holds her answers (the layout's, as she loaded the page) for the panel
 * and the screen to share: the panel's count on step 02 follows what she taps.
 */
export function OnboardingShell({
  answers,
  children,
}: {
  answers: StoredAnswers
  children: ReactNode
}) {
  return (
    <OnboardingAnswersProvider answers={answers}>
      <div className={cn(motion.page, '@container min-h-dvh bg-background text-foreground')}>
        <div className="split-page relative min-h-dvh [--split-panel:5/12] @max-5xl:grid-cols-1 @max-5xl:grid-rows-[auto_1fr]">
          <OnboardingPanel />
          {/* The header action (the design's .hdr): on the page side by side, in the band below. */}
          <AccountMenu className="split-corner absolute top-11 z-20 @max-5xl:top-6 @max-5xl:[--corner:2.5rem] @max-xl:top-1.5 @max-xl:[--corner:1rem]" />

          <div className="flex flex-col justify-center px-gutter dark:@5xl:split-divider-x dark:@max-5xl:split-divider-y py-section @max-5xl:justify-start @max-5xl:px-10 @max-5xl:pt-10 @max-5xl:pb-14 @max-xl:px-4 @max-xl:pt-6 @max-xl:pb-0">
            {children}
          </div>
        </div>
      </div>
    </OnboardingAnswersProvider>
  )
}
