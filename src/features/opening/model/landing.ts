import { OPENING_STEPS, type OpeningStep, type Profile } from '@/shared/types/student'
import {
  FUTURES_PATH,
  factPath,
  firstUnanswered,
  ONBOARDING_PATH,
  WELCOME_PATH,
} from './onboarding'

type Resumable = Pick<Profile, 'persona' | 'lastStep' | 'seenFutures' | 'answers'>

const isOpeningStep = (step: string): step is OpeningStep =>
  (OPENING_STEPS as readonly string[]).includes(step)

const pastOnboarding = (p: Resumable) =>
  p.seenFutures || p.lastStep === 'futures' || p.lastStep === 'attention'

/**
 * Where /onboarding resumes: the welcome until she has answered step 00; step 04, the last onboarding
 * step, once she has reached the futures; else the step 02–04 screen she left, or her first
 * unanswered step 01 question.
 */
export function onboardingResumePath(p: Resumable): string {
  if (p.persona === null) return WELCOME_PATH
  if (pastOnboarding(p)) return `${ONBOARDING_PATH}/after`
  if (isOpeningStep(p.lastStep) && p.lastStep !== 'facts') {
    return `${ONBOARDING_PATH}/${p.lastStep}`
  }
  return factPath(firstUnanswered(p.answers))
}

/**
 * Where a signed-in student lands: her futures once she has reached them (step 00 answered),
 * else where onboarding resumes.
 */
export function landingPath(p: Resumable): string {
  if (p.persona !== null && pastOnboarding(p)) return FUTURES_PATH
  return onboardingResumePath(p)
}
