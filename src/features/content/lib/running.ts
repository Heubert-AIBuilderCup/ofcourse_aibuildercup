// What a running step is doing, in words (criterion 122): the reason every move back is shown
// disabled while a step of the post runs, and the refusal's wording when one is pressed anyway
// (lib/workflow.ts stepRunningError), so the two read the same. With the progress a step records
// (server/steps.ts), the words count: "Drawing image 2 of 4", "Drafting 3 versions". Pure and
// client-safe.

/** How far a run is: `done` of `total`, as it records it (server/steps.ts StepRun). */
export type StepProgress = { done: number; total: number }

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

/**
 * The first running step in words, counted when it records its progress, or null while none runs.
 * On a comic (`comic`), the draft step is its story being written (RC2).
 */
export function runningReason(
  running: readonly { step: string; progress?: StepProgress }[],
  post: { comic: boolean } = { comic: false },
): string | null {
  const [first] = running
  if (first === undefined) return null
  if (post.comic && first.step === 'draft') return STORY_WORDS
  const count = counted(first.step, first.progress)
  if (count) return count
  const slide = SLIDE_STEP.exec(first.step)?.[1]
  if (slide) return `Slide ${slide} is being redrafted`
  return STEP_WORDS.get(first.step) ?? 'A step is running'
}
