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

/**
 * What a failed step says. After onboarding her answers are saved before the loader runs; a new
 * roadmap's draft (`draft`) is made by the loader's first step, so nothing is stored yet.
 */
export const loaderError = (kind: LoaderKind, { draft = false } = {}): string =>
  kind === 'first'
    ? "We couldn't draw your roadmap. Your answers are saved."
    : `We couldn't draw this roadmap. ${draft ? 'Nothing is created yet.' : 'Your answers are saved.'}`
