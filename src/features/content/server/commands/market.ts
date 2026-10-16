import 'server-only'
import { marketRewording } from '../../ai/market'
import { paragraphSites } from '../../layout/engine'
import { layoutMarket, type Reworded } from '../../layout/market'
import { excerptOf } from '../../lib/feed'
import { conversionsFor, rateLine } from '../../lib/market'
import { WORKFLOW_ERRORS } from '../../lib/workflow'
import { type Market, marketById } from '../../markets'
import type { Body } from '../../model/artifacts'
import { runStep } from '../steps'
import { getAsset, type LoadedPost, putArtifact } from '../store'
import { type Actor, command, draw, fail, imagesOf, putSlides, type Saved, save } from './shared'

// The market version (G5, criteria 56–61, 85, 110): one per post, for the market the editor chose
// from the markets file (ADR-123). "Make market version" makes it at once by code, the approved
// text with the money converted; "Reword for <market>" is the optional extra that runs the model
// rewording on top (ADR-129).

/**
 * The market layout: the approved revision with the reworded slots and the converted figures as
 * slot overrides, laid out and checked by the same engine as the default version (AD-E5). The
 * rate line goes on each slide whose text gained a conversion, naming that conversion's pair.
 * Refuses with the conversion's error when the rate file has no row for a figure's currency (86).
 */
function convertedLayout(
  revision: Body<'revision'>,
  source: Body<'source'>,
  facts: Body<'facts'>,
  market: Market,
  slots: Reworded[],
) {
  const converted = conversionsFor(revision.structure, facts.facts, market)
  if (!converted.ok) return converted
  const { conversions } = converted
  const laid = layoutMarket({
    revision,
    slots,
    conversions,
    facts: facts.facts,
    sourceTitle: source.title,
    sourceSite: source.site,
    sites: paragraphSites(source),
    language: source.language,
  })
  // One source document quotes one currency, so a slide reads one line; two pairs on one slide
  // would be joined.
  const rateLines: Record<number, string> = {}
  for (const [key, text] of Object.entries(laid.converted)) {
    const lines = new Set(conversions.filter((c) => text.includes(c.to)).map(rateLine))
    rateLines[Number(key.split(':')[0])] = [...lines].join(' · ')
  }
  return {
    ok: true as const,
    conversions,
    slides: laid.slides,
    fitChecks: laid.fitChecks,
    rateLines,
  }
}

/** The refusal for a market id the markets file does not have (criterion 85). */
const CHOOSE_MARKET = 'Choose a market.'
/** The refusal for a rewording asked before the version exists (criterion 110). */
const MAKE_FIRST = 'Make the market version first.'

/** The words a market version carries beyond the approved text: none when made by code alone. */
type Wording = { slots: Reworded[]; feedExcerpt: string; replays: string[]; reworded: boolean }

/**
 * Lays out the market version with its wording, checks it, draws it with the current art and
 * stores it as the post's market record. A layout that fails a fit check is refused with that
 * row: nothing is shortened by code. Facts, the revision and its bindings stay as they are.
 */
async function storeMarket(
  post: LoadedPost,
  version: number,
  actor: Actor,
  market: Market,
  wording: Wording,
): Promise<Saved> {
  const { source, facts, revision, render } = post.current
  if (!source || !facts || !revision || !render) return fail(WORKFLOW_ERRORS.movedOn)
  const laid = convertedLayout(revision.body, source.body, facts.body, market, wording.slots)
  if (!laid.ok) return fail(laid.error)
  const failing = laid.fitChecks.find((c) => !c.pass)
  if (failing) return fail(failing.label)

  const artId = render.body.art.assetId
  // A look's images go with it, slide by slide (GD12).
  const [artBytes, images] = await Promise.all([
    artId ? getAsset(artId).then((a) => a?.bytes ?? null) : null,
    imagesOf(render.body),
  ])
  const drawn = draw(revision.body, laid, artBytes, laid.rateLines, images)
  return save(post, version, actor, async (tx) => {
    const marketId = await putArtifact(tx, {
      kind: 'market',
      postId: post.id,
      actorId: actor.id,
      body: {
        revisionId: revision.id,
        renderId: render.id,
        market: market.id,
        slots: wording.slots,
        feedExcerpt: wording.feedExcerpt,
        conversions: laid.conversions,
        layout: laid.slides,
        fitChecks: laid.fitChecks,
        slides: await putSlides(tx, drawn),
        replays: wording.replays,
        reworded: wording.reworded,
      },
    })
    return { stage: post.stage, pointers: { ...post.pointers, marketId } }
  })
}

/**
 * The market version at once (criterion 110): the approved text with the money converted by
 * code, the default version's feed excerpt, and no model call. One per post, for the market the
 * editor chose (85).
 */
export async function makeMarket(
  actor: Actor,
  id: string,
  version: number,
  marketId: string,
): Promise<Saved> {
  return command('makeMarket', 'market', actor, id, version, async (post) => {
    const market = marketById(marketId)
    if (!market) return fail(CHOOSE_MARKET)
    const { revision } = post.current
    if (!revision) return fail(WORKFLOW_ERRORS.movedOn)
    return runStep(id, 'market', version, () =>
      storeMarket(post, version, actor, market, {
        slots: [],
        feedExcerpt: excerptOf(revision.body.structure),
        replays: [],
        reworded: false,
      }),
    )
  })
}

/**
 * The optional rewording of the post's market version (criteria 56, 59, 110): the model rewords
 * the presentational slots and the feed excerpt for the version's market, code checks every
 * number, and a new market record replaces the instant one. Refused before a version exists.
 */
export async function rewordMarket(actor: Actor, id: string, version: number): Promise<Saved> {
  return command('rewordMarket', 'market', actor, id, version, async (post) => {
    const { source, facts, revision, market: current } = post.current
    if (!current) return fail(MAKE_FIRST)
    const market = marketById(current.body.market)
    if (!market) return fail(CHOOSE_MARKET)
    if (!source || !facts || !revision) return fail(WORKFLOW_ERRORS.movedOn)

    return runStep(id, 'market', version, async () => {
      const made = await marketRewording({
        revision: revision.body,
        facts: facts.body.facts,
        market,
        demoKey: source.body.demoKey,
        postId: id,
        sourceTitle: source.body.title,
        sourceSite: source.body.site,
        sites: paragraphSites(source.body),
        language: source.body.language,
      })
      if (!made.ok) return fail(made.error)
      return storeMarket(post, version, actor, market, {
        slots: made.slots,
        feedExcerpt: made.feedExcerpt,
        replays: made.replays,
        reworded: true,
      })
    })
  })
}
