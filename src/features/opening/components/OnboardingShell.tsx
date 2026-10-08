import type { ReactNode } from 'react'
import { cn } from '@/shared/lib/utils'
import { OnboardingPanel } from './OnboardingPanel'
import styles from './onboarding.module.css'

/**
 * The page every onboarding step sits in: the steel panel beside the step's own column. The page
 * is a container: split side by side from @5xl (64rem), the panel a band on top below it, and the
 * phone layout below @xl (36rem); above the cap the content stays in a centred frame while the
 * panel's colour runs to the edge (split-page). Each step brings its own content wrapper, since
 * each sets its own gap.
 */
export function OnboardingShell({ children }: { children: ReactNode }) {
  return (
    <div className={cn(styles.page, '@container min-h-dvh bg-background text-foreground')}>
      <div className="split-page min-h-dvh [--split-panel:5/12] @max-5xl:grid-cols-1 @max-5xl:grid-rows-[auto_1fr]">
        <OnboardingPanel />

        <div className="flex flex-col justify-center px-gutter py-section @max-5xl:justify-start @max-5xl:px-10 @max-5xl:pt-10 @max-5xl:pb-14 @max-xl:px-4 @max-xl:pt-6 @max-xl:pb-0">
          {children}
        </div>
      </div>
    </div>
  )
}
