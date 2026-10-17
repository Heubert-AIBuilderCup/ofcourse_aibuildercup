// What a running step is doing, in words (criterion 122): the reason every move back is shown
// disabled while a step of the post runs, and the refusal's wording when one is pressed anyway
// (lib/workflow.ts stepRunningError), so the two read the same. With the progress a step records
// (server/steps.ts), the words count: "Drawing image 2 of 4", "Drafting 3 versions". Pure and
// client-safe.

import type { StepId } from './steps'

/**
 * What a run's model call waits for (ai/wait-notes.ts): Google's model refusing it as busy (429)
 * with the wait before try `attempt`, or the move to Flash-Lite once Flash and Pro were busy.
 */
export type WaitNote =
  | { kind: 'busy'; model: string; attempt: number; waitS: number }
  | { kind: 'fallback'; model: string }

/** How far a run is: `done` of `total`, as it records it (server/steps.ts StepRun), and what it waits for. */
export type StepProgress = { done: number; total: number; note?: WaitNote }

/** What each step wrote, for the line naming the ones that finished on Flash-Lite. */
const WRITTEN_WORDS = new Map([
  ['extract', 'the facts'],
  ['draft', 'the versions'],
  ['covers', 'the covers'],
  ['source_check', 'the source check'],
  ['market', 'the market version'],
  ['ideas', 'the ideas'],
  ['outline', 'the outline'],
  ['nudge_version', 'a version'],
  ['scene_plan', 'the image plan'],
  ['research', 'the research'],
  ['blog_text', 'the blog text'],
])

/**
 * The screen each step's work is read on (lib/steps.ts StepId), where the line saying it was
 * written with Flash-Lite shows: the source check and the research on Settings, beside its checks.
 */
const SCREENS = new Map<string, StepId>([
  ['extract', 'source'],
  ['ideas', 'ideas'],
  ['outline', 'outline'],
  ['draft', 'text'],
  ['nudge_version', 'text'],
  ['blog_text', 'text'],
  ['covers', 'images'],
  ['scene_plan', 'images'],
  ['source_check', 'settings'],
  ['research', 'settings'],
  ['market', 'settings'],
])

/** The screen a step's work is read on; a slide redrafted on its own is the text's. */
const screenOf = (step: string): StepId | undefined =>
  SLIDE_STEP.test(step) ? 'text' : SCREENS.get(step)

/**
 * The line on `screen` for its steps whose last run finished on Flash-Lite because Flash and Pro
 * were busy (server/steps.ts failedNow `lite`), leaving out any running again; null when none. A
 * step with no screen of its own is said on every screen.
 */
export function liteLine(
  lite: readonly string[] | undefined,
  running: readonly string[],
  screen: StepId,
): string | null {
  const shown = (lite ?? []).filter((step) => {
    const on = screenOf(step)
    return !running.includes(step) && (on === undefined || on === screen)
  })
  if (shown.length === 0) return null
  const words = shown.map((step) =>
    SLIDE_STEP.test(step) ? 'a slide' : (WRITTEN_WORDS.get(step) ?? 'a step'),
  )
  return `Written with Flash-Lite because Flash and Pro were busy: ${words.join(', ')}.`
}

/** A wait note in words, said after the step's own. */
function noteWords(note: WaitNote): string {
  if (note.kind === 'fallback') return 'Flash and Pro are busy. Writing with Flash-Lite instead'
  return `Google's model is busy (${note.model}). Trying again in about ${note.waitS} s (try ${note.attempt})`
}

/** The steps a post runs (server/steps.ts runStep), as the workbench says them. */
const STEP_WORDS = new Map([
  ['extract', 'Facts are being read'],
  ['draft', 'Versions are being drafted'],
  ['covers', 'Covers are being drawn'],
  ['render', 'Slides are being drawn'],
  ['source_check', 'The source check is running'],
  ['market', 'The market version is being made'],
  ['ideas', 'Ideas are being found'],
  // A picked idea outlined slide by slide (server/commands/ideas.ts OUTLINE_STEP, GD32).
  ['outline', 'The outline is being made'],
  // A text chip on a whole version (server/commands/structures.ts NUDGE_VERSION_STEP, GD10).
  ['nudge_version', 'A version is being redrafted'],
  // A look post's images planned in words, then drawn or one nudged (server/commands/images.ts, GD12–GD14).
  ['scene_plan', 'Images are being planned'],
  ['images', 'Images are being drawn'],
  // "Research this" on a sentence the check did not find (server/commands/suggest.ts RESEARCH_STEP, BR14).
  ['research', 'A sentence is being researched'],
  // A blog's text written from its outline (server/commands/blog.ts BLOG_TEXT_STEP, BR3).
  ['blog_text', 'The blog is being written'],
])
/** Another take on one slide (server/commands/structures.ts SLIDE_STEP). */
const SLIDE_STEP = /^draft_slide:(\d+)$/

/** The counted words of a step that records its progress, or null. */
function counted(step: string, progress: StepProgress | undefined): string | null {
  if (!progress || progress.total <= 0) return null
  const { done, total } = progress
  // The image on its way; with every image in, the last one is being saved.
  if (step === 'images') return `Drawing image ${Math.min(done + 1, total)} of ${total}`
  if (step === 'draft') return `Drafting ${total} ${total === 1 ? 'version' : 'versions'}`
  if (step === 'blog_text') return `Writing ${total} ${total === 1 ? 'section' : 'sections'}`
  return null
}

/** A comic's story, drafted under the draft step (server/commands/comic.ts), as the workbench says it. */
const STORY_WORDS = 'The story is being written'

/** A running step in words, counted when it records its progress. */
function stepWords(step: string, progress: StepProgress | undefined, comic: boolean): string {
  if (comic && step === 'draft') return STORY_WORDS
  const count = counted(step, progress)
  if (count) return count
  const slide = SLIDE_STEP.exec(step)?.[1]
  if (slide) return `Slide ${slide} is being redrafted`
  return STEP_WORDS.get(step) ?? 'A step is running'
}

/**
 * The first running step in words, counted when it records its progress, then what its model
 * waits for when it says, or null while none runs. On a comic (`comic`), the draft step is its
 * story being written (RC2).
 */
export function runningReason(
  running: readonly { step: string; progress?: StepProgress }[],
  post: { comic: boolean } = { comic: false },
): string | null {
  const [first] = running
  if (first === undefined) return null
  const words = stepWords(first.step, first.progress, post.comic)
  const note = first.progress?.note
  return note ? `${words}. ${noteWords(note)}` : words
}
