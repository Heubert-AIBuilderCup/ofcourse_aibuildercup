import { OPENING_STEPS, type OpeningStep, type Profile } from '@/shared/types/student'
import {
  ATTENTION_PATH,
  DONE_PATH,
  firstOpenQuestion,
  ONBOARDING_PATH,
  questionPath,
  ROAD_PATH,
  WELCOME_PATH,
} from './onboarding'

type Resumable = Pick<
  Profile,
  'persona' | 'lastStep' | 'seenFutures' | 'answers' | 'coins' | 'onboardedAt'
>

const isOpeningStep = (step: string): step is OpeningStep =>
  (OPENING_STEPS as readonly string[]).includes(step)

/**
 * Step 05 reached: from step 05 itself, or from the futures before they left onboarding (marks
 * stored then; nothing marks them now).
 */
const reachedAttention = (p: Resumable) =>
  p.seenFutures || p.lastStep === 'futures' || p.lastStep === 'attention'

/**
 * Where /onboarding resumes: her road once she has pressed "Go to your road" (onboarding is
 * finished and locked, whatever else is stored); else the welcome until she has answered step 00;
 * the end once her coins are stored (spent or for later); step 05 once she has reached it (or the
 * futures, before they left onboarding); else the step 02–04 screen she left, or her first
 * unanswered step 01 question.
 */
export function onboardingResumePath(p: Resumable): string {
  if (p.onboardedAt !== null) return ROAD_PATH
  if (p.persona === null) return WELCOME_PATH
  if (p.coins !== null) return DONE_PATH
  if (reachedAttention(p)) return ATTENTION_PATH
  if (isOpeningStep(p.lastStep) && p.lastStep !== 'facts') {
    return `${ONBOARDING_PATH}/${p.lastStep}`
  }
  return questionPath(1, firstOpenQuestion(1, p.answers))
}

/**
 * Where a signed-in student goes from the sign-in page, in one redirect: the page she asked for
 * (`asked`, already checked to be this app's), else where she left off. Once she is on her road,
 * an onboarding page asked for is her road, where the lock would send her next; "You're all set"
 * stays open after it, for now.
 */
export function signedInLanding(p: Resumable, asked: string | null): string {
  if (asked === null) return onboardingResumePath(p)
  const path = asked.split(/[?#]/)[0]
  const onboarding = path === ONBOARDING_PATH || path.startsWith(`${ONBOARDING_PATH}/`)
  if (p.onboardedAt !== null && onboarding && path !== DONE_PATH) return ROAD_PATH
  return asked
}
