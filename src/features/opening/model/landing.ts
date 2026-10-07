import { OPENING_STEPS, type OpeningStep, type Profile } from '@/shared/types/student'

const isOpeningStep = (step: string): step is OpeningStep =>
  (OPENING_STEPS as readonly string[]).includes(step)

/**
 * Where a signed-in student lands: the picture question until she has answered it, her futures
 * once she has seen them, else the opening screen she left (screen 1 if she has not started).
 */
export function landingPath(p: Pick<Profile, 'persona' | 'lastStep' | 'seenFutures'>): string {
  if (p.persona === null) return '/picture'
  if (p.seenFutures) return '/futures'
  if (isOpeningStep(p.lastStep)) return `/opening/${p.lastStep}`
  if (p.lastStep === 'futures' || p.lastStep === 'attention') return '/futures'
  return '/opening/facts'
}
