// The full-screen loader's model: its three steps per kind, the state each is in, its timing and
// its words when a step fails. Pure and client-safe. From the reference's STEPS_FIRST, STEPS_NEW,
// LT and loadSteps (docs/roadmaps/reference/logic/roadmaps.js).

/** After onboarding, her first roadmap; after Create roadmap or a second onboarding, a new one. */
export type LoaderKind = 'first' | 'new'
export type LoaderStepState = 'done' | 'now' | 'next' | 'bad'
export type LoaderStep = { text: string; state: LoaderStepState }

export const LOADER_STEPS: Record<LoaderKind, readonly [string, string, string]> = {
  first: ['Reading your answers', 'Drawing your first roadmap', 'Opening your roadmaps'],
  new: ['Reading your answers', 'Drawing your new roadmap', 'Adding it to your roadmaps'],
}

/** Each step stays at least this long, so it never flashes. */
export const LOADER_MIN_MS = 700
/** After the last tick, the loader fades over this long, then goes. */
export const LOADER_FADE_MS = 450
/** With a step still running this long, the loader says it is still working. */
export const LOADER_SLOW_MS = 10000

/**
 * Each step's words and state: the first `done` are done; the next is the one working (`now`), or
 * the one that failed (`bad`); the rest wait (`next`).
 */
export function loaderSteps(
  kind: LoaderKind,
  { done, failed }: { done: number; failed: boolean },
): LoaderStep[] {
  return LOADER_STEPS[kind].map((text, i) => ({
    text,
    state: i < done ? 'done' : i > done ? 'next' : failed ? 'bad' : 'now',
  }))
}

export const loaderError = (kind: LoaderKind): string =>
  kind === 'first'
    ? "We couldn't draw your roadmap. Your answers are saved."
    : "We couldn't draw this roadmap. Your answers are saved."
