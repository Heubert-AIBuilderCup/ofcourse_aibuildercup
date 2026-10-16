import { ROADMAPS_PATH } from '@/shared/lib/student-paths'
import { OPENING_STEPS, type OpeningStep, type Profile } from '@/shared/types/student'
import {
  ATTENTION_PATH,
  DONE_PATH,
  firstOpenQuestion,
  ONBOARDING_PATH,
  questionPath,
  WELCOME_PATH,
} from './onboarding'

type Resumable = Pick<
  Profile,
  'persona' | 'lastStep' | 'seenFutures' | 'answers' | 'coins' | 'draft' | 'finished'
>

/**
 * Onboarding is closed (locked) when she is answering no roadmap and has finished one: until
 * then, a new student included, it stays open.
 */
export const onboardingClosed = (p: Pick<Profile, 'draft' | 'finished'>): boolean =>
  p.draft === null && p.finished > 0

const isOpeningStep = (step: string): step is OpeningStep =>
  (OPENING_STEPS as readonly string[]).includes(step)

/**
 * Step 05 reached: from step 05 itself, or from the futures before they left onboarding (marks
 * stored then; nothing marks them now).
 */
const reachedAttention = (p: Resumable) =>
  p.seenFutures || p.lastStep === 'futures' || p.lastStep === 'attention'

/**
 * Where /onboarding resumes: her roadmaps once onboarding is closed (whatever else is stored);
 * else, from the roadmap she is answering (the profile mirrors it), the welcome until she has
 * answered step 00; the end once her coins are stored (spent or for later); step 05 once she has
 * reached it (or the futures, before they left onboarding); else the step 02–04 screen she left,
 * or her first unanswered step 01 question.
 */
export function onboardingResumePath(p: Resumable): string {
  if (onboardingClosed(p)) return ROADMAPS_PATH
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
 * (`asked`, already checked to be this app's), else where she left off. Once onboarding is
 * closed, an onboarding page asked for ("You're all set" included) is her roadmaps, where the lock
 * would send her next.
 */
export function signedInLanding(p: Resumable, asked: string | null): string {
  if (asked === null) return onboardingResumePath(p)
  const path = asked.split(/[?#]/)[0]
  const onboarding = path === ONBOARDING_PATH || path.startsWith(`${ONBOARDING_PATH}/`)
  if (onboarding && onboardingClosed(p)) return ROADMAPS_PATH
  return asked
}
