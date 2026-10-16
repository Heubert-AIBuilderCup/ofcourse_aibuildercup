import 'server-only'
import { suggestIdeas } from '../../ai/ideas'
import { outlinePost } from '../../ai/outline'
import { WORKFLOW_ERRORS } from '../../lib/workflow'
import { isLook, templateById } from '../../templates'
import { runStep } from '../steps'
import { putArtifact } from '../store'
import { type Actor, command, fail, type Saved, save } from './shared'

// Idea cards before any draft (GD1–GD3, GD7, GD20): "Make post" stops at them (./source.ts), the
// editor asks for more, then picks one, or two to combine, and that idea is outlined slide by
// slide in the first card's look (GD32) for the versions to follow (./outline.ts). The cards stay
// pointed at, so the outline and the versions can go back to them.

/** The step the ideas run as: "Make post", "More ideas" and the failed step's "Try again" share it. */
export const IDEAS_STEP = 'ideas'
/** The step a picked idea is outlined in (GD32); its "Try again" is the same pick. */
export const OUTLINE_STEP = 'outline'
/** "More ideas" adds at most this many cards to those shown (GD3)… */
const MORE = 4
/** …up to this many cards in all. */
export const MAX_IDEAS = 12

/**
 * "More ideas" (GD3), and the first cards when there are none yet: "Make post" runs it after the
 * facts, and it is the failed step's "Try again". The model is told which hooks were shown; the
 * new record keeps those cards and adds up to four new ones, twelve in all; at twelve it is
 * refused before any call. Cards offered for other facts are not shown: the first cards for these
 * facts are made. The first cards' top three formats stay the record's (GD33). A failed call
 * saves nothing, and the step shows failed.
 */
export async function moreIdeas(actor: Actor, id: string, version: number): Promise<Saved> {
  return command('moreIdeas', 'moreIdeas', actor, id, version, async (post) => {
    const { source, facts } = post.current
    if (!source || !facts) return fail(WORKFLOW_ERRORS.movedOn)
    const shown = post.current.ideas?.body ?? null
    if (shown && shown.cards.length >= MAX_IDEAS) return fail(WORKFLOW_ERRORS.plentyIdeas)
    return runStep(id, IDEAS_STEP, version, async () => {
      const rounds = (shown?.rounds ?? 0) + 1
      const offered = await suggestIdeas({
        source: source.body,
        facts: facts.body.facts,
        avoid: shown?.cards.map((c) => c.hook) ?? [],
        postId: id,
        attempt: rounds,
        // A blog's cards are angles for one article (BR1).
        kind: post.kind === 'blog' ? 'blog' : 'feed',
      })
      if (!offered.ok) return fail(offered.error)
      const room = MAX_IDEAS - (shown?.cards.length ?? 0)
      const added = offered.cards.slice(0, shown ? Math.min(MORE, room) : room)
      // Only the first cards' top three are recommended (GD29); later rounds add after them.
      const cards = [
        ...(shown?.cards ?? []),
        ...(shown ? added.map((c) => ({ ...c, recommended: false })) : added),
      ]
      // Likewise only the first cards' top formats (GD33); a record from before formats, and a
      // blog's, has none.
      const formats = shown ? shown.formats : offered.formats
      const ranked = formats && formats.length > 0 ? { formats } : {}
      return save(post, version, actor, async (tx) => {
        const ideasId = await putArtifact(tx, {
          kind: 'ideas',
          postId: id,
          actorId: actor.id,
          body: { factsId: facts.id, cards, rounds, ...ranked },
        })
        return { stage: post.stage, pointers: { ...post.pointers, ideasId } }
      })
    })
  })
}

/** One card's index, or two different ones, each a card shown. */
function isPick(cards: unknown, shown: number): cards is number[] {
  return (
    Array.isArray(cards) &&
    cards.length >= 1 &&
    cards.length <= 2 &&
    new Set(cards).size === cards.length &&
    cards.every((i) => Number.isInteger(i) && i >= 0 && i < shown)
  )
}

/**
 * "Use this idea", or two ticked and "Combine" (GD2): the idea outlined slide by slide in the
 * first card's look (GD32), each slide's job, layout and point, with the card, or both to
 * combine, kept on the outline, in the first card's format (GD33). Nothing is drafted: the editor
 * shapes the outline, then "Write the slides" drafts to it (./outline.ts). Versions drafted for
 * an earlier outline no longer count. A failed outline saves nothing, and the outline step shows
 * failed.
 */
export async function pickIdeas(
  actor: Actor,
  id: string,
  version: number,
  input: { cards: number[] },
): Promise<Saved> {
  return command('pickIdeas', 'pickIdeas', actor, id, version, async (post) => {
    const { source, facts } = post.current
    const ideas = post.current.ideas?.body
    if (!source || !facts || !ideas) return fail(WORKFLOW_ERRORS.movedOn)
    if (!isPick(input.cards, ideas.cards.length)) return fail(WORKFLOW_ERRORS.ideas)
    const cards = input.cards.map((i) => ideas.cards[i])
    const template = templateById(cards[0].look)
    if (!template || !isLook(template)) return fail(WORKFLOW_ERRORS.look)

    return runStep(id, OUTLINE_STEP, version, async () => {
      // The same idea picked again is the same call: its outline, as the editor first saw it.
      const format = cards[0].format ?? null
      const outlined = await outlinePost({
        template,
        ideas: cards,
        format,
        facts: facts.body.facts,
        language: source.body.language,
        postId: id,
        attempt: 1,
      })
      if (!outlined.ok) return fail(outlined.error)
      return save(post, version, actor, async (tx) => {
        const outlineId = await putArtifact(tx, {
          kind: 'post_outline',
          postId: id,
          actorId: actor.id,
          body: {
            factsId: facts.id,
            ideas: cards,
            format,
            slides: outlined.slides,
            note: 'Outlined',
          },
        })
        const pointers = { ...post.pointers, outlineId, draftsId: null, picked: null }
        return { stage: post.stage, pointers }
      })
    })
  })
}
