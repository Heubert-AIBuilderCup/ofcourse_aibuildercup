import 'server-only'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { compile, GUIDELINE, type Guideline, guidelineFor } from '../brands/guideline'
import { emotionOf } from '../emotions'
import { canonicalJson, sha256Hex } from '../server/hash'
import { dbCallLog } from './calls'
import { ai } from './client'
import { ART_PROMPT_ERROR, artPromptError } from './draft'
import { artCheck } from './vision'

/** The prompt with the emotion's mood on the end: what the image model gets (criterion 100). */
export function withMood(prompt: string, emotion: string | null | undefined): string {
  const mood = emotionOf(emotion)
  return mood ? `${prompt} Mood: ${mood.label.toLowerCase()}.` : prompt
}

/**
 * What a cover is drawn from (criterion 102): the system's own words for the post, and the two
 * the editor may give, both optional. The look is the brand guideline's (GD15); the page's art
 * style, when its page has a design language (criterion 105), replaces the guideline's style
 * sentence only.
 */
export type CoverPromptInput = {
  /** The picked version's drafted picture for its cover (Structure.artPrompt). */
  scene: string
  /** The words on the cover slide. */
  message: string
  /** The picked version's angle; null when it has none (a version drafted before 9 Oct 2026). */
  angle: string | null
  /** The emotion the revision carries (emotions/index.ts). */
  emotion: string | null
  /** The page's art style, from its design language (criterion 105); in place of the guideline's style sentence when given. */
  artStyle?: string | null
  /** The guideline to draw from; the brand guideline when absent. Tests pass a changed one. */
  guideline?: Guideline
  /** The editor's cover idea, up to 120 characters, or null. Never cleaned: the guard refuses it whole. */
  idea: string | null
}

const NO_TEXT = 'No text, letters, numbers, logos or watermarks anywhere in the image.'

/**
 * The system's words without what the art prompt guard refuses (a digit, a quote mark, a brand
 * name): a word with a digit or a brand goes, quote marks go, and so does a word with no letter
 * (a separator such as "·"). So the post's own numbers and names never reach the image model.
 */
function clean(text: string): string {
  return text
    .split(/\s+/)
    .map((word) => word.replace(/["“”]/g, ''))
    .filter((word) => /\p{L}/u.test(word) && artPromptError(word) === null)
    .join(' ')
}

/** The text as a sentence: its own end mark (a Devanagari danda among them), or a full stop. */
const sentence = (text: string) => (/[.!?।]$/.test(text) ? text : `${text}.`)

/** What opens the guideline at the end of a prompt. The art prompt guard reads only what comes before the last one. */
const GUIDELINE_HEADING = '\n\nBrand guideline for the image:\n'

/** The prompt's own words, without the guideline the code appended: palette hexes and sizes carry digits the guard refuses. */
function ownWords(prompt: string): string {
  const at = prompt.lastIndexOf(GUIDELINE_HEADING)
  return at === -1 ? prompt : prompt.slice(0, at)
}

/**
 * The cover art prompt, built by code (criterion 102, ADR-129): the scene, the cover's words, the
 * angle, the editor's idea, the rule against text in the art, the mood, and last the brand
 * guideline for images (GD15), its style sentence the page's art style when it has one.
 */
export function coverPrompt(input: CoverPromptInput): string {
  const scene = clean(input.scene)
  const message = clean(input.message)
  const angle = input.angle === null ? '' : clean(input.angle)
  const style = clean(input.artStyle ?? '')
  const idea = input.idea?.trim() ?? ''
  const parts = [
    scene && sentence(scene),
    message && sentence(`The post: ${message}`),
    angle && sentence(`Angle: ${angle}`),
    idea && sentence(`Idea: ${idea}`),
    NO_TEXT,
  ].filter(Boolean)
  return `${withMood(parts.join(' '), input.emotion)}${GUIDELINE_HEADING}${imageGuideline(input.guideline, style)}`
}

/** The guideline for images (GD15), its style sentence the page's art style when there is one (105). */
function imageGuideline(guideline: Guideline | undefined, style: string): string {
  const look = guideline ? compile(guideline).guidelineFor('image') : guidelineFor('image')
  const base = (guideline ?? GUIDELINE).art.style
  return style ? look.replace(`Style: ${base}`, () => `Style: ${style}`) : look
}

/** The input of a slide's image prompt (GD12, GD13). */
export type SlidePromptInput = {
  /** The planned scene: what is seen in the slide's art box. Never cleaned: the guard refuses it whole. */
  scene: string
  /** The emotion the revision carries (emotions/index.ts). */
  emotion: string | null
  /** The image nudge's instruction when the image is drawn again with one, or null. */
  nudge: string | null
  /** The page's art style, from its design language (criterion 105); in place of the guideline's style sentence when given. */
  artStyle?: string | null
  /** The guideline to draw from; the brand guideline when absent. Tests pass a changed one. */
  guideline?: Guideline
  /** A comic panel (RC6): its character is the first reference image, the approved sheet. */
  character?: boolean
}

const SAME_CHARACTER = 'The same character as in the first reference image, drawn consistently.'

/**
 * The prompt for one slide's image, built by code: for a comic panel, the character of its first
 * reference image; the planned scene, the nudge's instruction, the rule against text in the art,
 * the mood, and last the brand guideline for images (GD15), its style sentence the page's art
 * style when it has one, under the heading the art prompt guard stops reading at.
 */
export function slidePrompt(input: SlidePromptInput): string {
  const scene = input.scene.trim()
  const nudge = input.nudge?.trim() ?? ''
  const parts = [
    input.character && SAME_CHARACTER,
    scene && sentence(scene),
    nudge && sentence(`Change: ${nudge}`),
    NO_TEXT,
  ]
  const look = imageGuideline(input.guideline, clean(input.artStyle ?? ''))
  return `${withMood(parts.filter(Boolean).join(' '), input.emotion)}${GUIDELINE_HEADING}${look}`
}

/**
 * The aspect ratios images are drawn at: a slide or cover, a square, or a panorama (GD4); a blog's
 * wide cover and the pictures between its sections (BR4). The image model's ImageConfig takes
 * each (@google/genai ImageConfig.aspectRatio).
 */
export type ImageAspect = '4:5' | '1:1' | '21:9' | '16:9' | '4:3'

/**
 * The aspect a slide's image is drawn at, by its art box: 4:5 for a box the shape of the slide,
 * 1:1 for a square one or one wider still, whichever ratio is nearer.
 */
export function imageAspect(box: { w: number; h: number }): '4:5' | '1:1' {
  const ratio = Math.log(box.w / box.h)
  return Math.abs(ratio - Math.log(4 / 5)) < Math.abs(ratio) ? '4:5' : '1:1'
}

/** One of a page's reference images, sent to the image model as a style reference (criterion 105). */
export type StyleReference = {
  assetId: string
  mime: 'image/png' | 'image/jpeg'
  bytes: Uint8Array
}

export type ArtDeps = {
  /** The bytes cached for this key, or null (the command wires this to ai_cache and content_asset). */
  cached(key: string): Promise<Uint8Array | null>
  remember(key: string, bytes: Uint8Array): Promise<void>
}

/** 'daily_limit' is no art because the day's image cap refused the call: the cover says so (criterion 6). */
export type CoverArt = {
  bytes: Uint8Array | null
  fallback: 'replay' | 'no_art' | 'daily_limit' | null
}

const ASPECT_RATIO: ImageAspect = '4:5'
/** The options "Make covers" and "Another set" draw at a time (criterion 102). */
export const COVER_OPTIONS = 3
const COVERS_DIR = join(process.cwd(), 'src/features/content/demo-sources/covers')
// A demo key names a file, so only a plain slug is read.
const DEMO_KEY = /^[a-z0-9][a-z0-9-]*$/

/** The demo source's pre-rendered cover, or null when it has none. */
async function demoCover(demoKey: string | null): Promise<Uint8Array | null> {
  if (demoKey === null || !DEMO_KEY.test(demoKey)) return null
  try {
    return new Uint8Array(await readFile(join(COVERS_DIR, `${demoKey}.png`)))
  } catch {
    return null
  }
}

/** Labels the step's outcome on the call log. Cached = true: no model call, so no cap is spent. */
async function recordFallback(fallback: 'replay' | 'no_art', postId: string): Promise<void> {
  try {
    await dbCallLog.record({
      useCase: 'art',
      tier: 'image',
      model: process.env.GEMINI_IMAGE_MODEL ?? '',
      promptVersion: 'image.v1',
      ok: fallback === 'replay',
      cached: true,
      ms: 0,
      fallback,
      postId,
    })
  } catch (err) {
    console.error('[ai] could not log an art fallback', err instanceof Error ? err.message : err)
  }
}

type Drawn =
  | { ok: true; bytes: Uint8Array }
  | { ok: false; reason: 'failed' | 'daily_limit' | 'text' }

/**
 * One image under its cache key: the cached one, which was checked when it was kept, or a new one
 * from the image model, kept only when the art check finds it clean (criterion 103).
 */
async function drawOne(
  prompt: string,
  aspectRatio: ImageAspect,
  key: string,
  postId: string,
  references: StyleReference[],
  deps: ArtDeps,
): Promise<Drawn> {
  try {
    const hit = await deps.cached(key)
    if (hit) return { ok: true, bytes: hit }
  } catch {}

  const res = await ai.generateImage({
    prompt,
    aspectRatio,
    postId,
    data: { prompt },
    ...(references.length > 0 && {
      references: references.map((r) => ({
        mime: r.mime,
        base64: Buffer.from(r.bytes).toString('base64'),
      })),
    }),
  })
  if (!res.ok) return { ok: false, reason: res.reason }
  // Art the check could not read is never offered as if it were clean.
  if ((await artCheck({ bytes: res.value, postId })) !== 'clean')
    return { ok: false, reason: 'text' }
  try {
    await deps.remember(key, res.value)
  } catch {}
  return { ok: true, bytes: res.value }
}

/**
 * One cover image. Refuses a prompt the guard refuses before any call. Otherwise never fails: an
 * image with text in it is replaced once (criterion 103); a failed, slow or capped one, or a
 * second with text, falls back, labelled. `set` and `option` name the image among a post's cover
 * options (0 and 0 for the render's own cover), so each is its own call and its own cache key.
 * A page's reference images go with the prompt as style references, and their asset ids into the
 * key (criterion 105); with none, the key is the one a page without a design language always had.
 * `aspectRatio` is 4:5 unless given: a square art box's 1:1, a panorama's 21:9 (GD12, GD4), or a
 * blog's 16:9 cover and 4:3 inline pictures (BR4).
 */
export async function coverArt(
  input: {
    prompt: string
    demoKey: string | null
    postId: string
    set?: number
    option?: number
    references?: StyleReference[]
    aspectRatio?: ImageAspect
  },
  deps: ArtDeps,
): Promise<{ ok: true; art: CoverArt } | { ok: false; error: string }> {
  const { prompt, demoKey, postId } = input
  const aspectRatio = input.aspectRatio ?? ASPECT_RATIO
  const references = input.references ?? []
  if (artPromptError(ownWords(prompt))) return { ok: false, error: ART_PROMPT_ERROR }

  let drawn: Drawn = { ok: false, reason: 'failed' }
  for (const attempt of [1, 2]) {
    const key = sha256Hex(
      canonicalJson({
        model: process.env.GEMINI_IMAGE_MODEL ?? '',
        prompt,
        aspectRatio,
        set: input.set ?? 0,
        option: input.option ?? 0,
        attempt,
        ...(references.length > 0 && { references: references.map((r) => r.assetId) }),
      }),
    )
    drawn = await drawOne(prompt, aspectRatio, key, postId, references, deps)
    // Only an image with text is drawn again; a failed or capped call is not.
    if (drawn.ok || drawn.reason !== 'text') break
  }
  if (drawn.ok) return { ok: true, art: { bytes: drawn.bytes, fallback: null } }

  const cover = await demoCover(demoKey)
  const fallback = cover ? 'replay' : 'no_art'
  await recordFallback(fallback, postId)
  // A demo source still replays; any other cover says the cap, not just that it has no art.
  if (!cover && drawn.reason === 'daily_limit') {
    return { ok: true, art: { bytes: null, fallback: 'daily_limit' } }
  }
  return { ok: true, art: { bytes: cover, fallback } }
}

/**
 * Three cover options from one prompt (criterion 102), each its own image call, so each counts
 * against the day's image limit, under its own cache key. Refused whole before any call when the
 * guard refuses the prompt, as when the editor's idea asks for text, a number or a brand.
 */
export async function coverOptions(
  input: {
    prompt: string
    demoKey: string | null
    postId: string
    set: number
    references?: StyleReference[]
  },
  deps: ArtDeps,
): Promise<{ ok: true; options: CoverArt[] } | { ok: false; error: string }> {
  if (artPromptError(ownWords(input.prompt))) return { ok: false, error: ART_PROMPT_ERROR }
  const made = await Promise.all(
    Array.from({ length: COVER_OPTIONS }, (_, i) => coverArt({ ...input, option: i + 1 }, deps)),
  )
  const options: CoverArt[] = []
  for (const res of made) {
    if (!res.ok) return res
    options.push(res.art)
  }
  return { ok: true, options }
}
