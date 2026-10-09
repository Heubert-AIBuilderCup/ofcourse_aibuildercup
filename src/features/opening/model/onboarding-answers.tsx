'use client'

import {
  createContext,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  useContext,
  useState,
} from 'react'
import type { StoredAnswers } from '@/shared/types/student'

const OnboardingAnswersContext = createContext<
  readonly [StoredAnswers, Dispatch<SetStateAction<StoredAnswers>>] | null
>(null)

/** Her answers for the onboarding shell: the layout's on load, then every tap the screen makes. */
export function OnboardingAnswersProvider({
  answers,
  children,
}: {
  answers: StoredAnswers
  children: ReactNode
}) {
  // Only the first value is read: a later prop (a router.refresh()) must not undo her taps.
  const state = useState(answers)
  return <OnboardingAnswersContext value={state}>{children}</OnboardingAnswersContext>
}

/** The shell's answers and their setter; throws outside an OnboardingAnswersProvider. */
export function useOnboardingAnswers() {
  const state = useContext(OnboardingAnswersContext)
  if (!state) throw new Error('useOnboardingAnswers needs an OnboardingAnswersProvider above it')
  return state
}
