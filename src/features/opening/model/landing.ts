import { OPENING_STEPS, type OpeningStep, type Profile } from '@/shared/types/student'
import {
  ATTENTION_PATH,
  DONE_PATH,
  factPath,
  firstUnanswered,
  ONBOARDING_PATH,
  WELCOME_PATH,
} from './onboarding'

type Resumable = Pick<Profile, 'persona' | 'lastStep' | 'seenFutures' | 'answers' | 'coins'>

const isOpeningStep = (step: string): step is OpeningStep =>
  (OPENING_STEPS as readonly string[]).includes(step)

/**
 * Step 05 reached: from step 05 itself, or from the futures before they left onboarding (marks
 * stored then; the parked futures page marks nothing now).
 */
const reachedAttention = (p: Resumable) =>
  p.seenFutures || p.lastStep === 'futures' || p.lastStep === 'attention'

/**
 * Where /onboarding resumes: the welcome until she has answered step 00; the end screen once her
 * coins are stored (spent or for later); step 05 once she has reached it (or the futures, before
 * they left onboarding); else the step 02–04 screen she left, or her first unanswered step 01
 * question.
 */
export function onboardingResumePath(p: Resumable): string {
  if (p.persona === null) return WELCOME_PATH
  if (p.coins !== null) return DONE_PATH
  if (reachedAttention(p)) return ATTENTION_PATH
  if (isOpeningStep(p.lastStep) && p.lastStep !== 'facts') {
    return `${ONBOARDING_PATH}/${p.lastStep}`
  }
  return factPath(firstUnanswered(p.answers))
}

/**
 * Where a signed-in student lands: where onboarding resumes, the end screen once she has finished.
 * Never the futures, which sit outside onboarding until their own feature places them.
 */
export function landingPath(p: Resumable): string {
  return onboardingResumePath(p)
}
