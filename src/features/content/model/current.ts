// The post's valid state. A pointer is only a claim; a record counts when it exists, is of the
// right kind and links to the records it was made from. So a stale check or an approval of
// anything but the current revision and render reads as null. Slide vision checks and their
// overrides (before 9 Oct 2026) stay stored but no longer count for anything (criterion 103).

import type { Artifact, ArtifactKind, Body, Pointers } from './artifacts'

type With<K extends ArtifactKind> = { id: string; body: Body<K> } | null

export type CurrentPost = {
  source: With<'source'>
  facts: With<'facts'>
  drafts: With<'drafts'>
  /** The idea cards offered for the current facts (GD1). */
  ideas: With<'ideas'>
  /** The slide-by-slide outline made for the current facts (GD32). */
  outline: With<'post_outline'>
  /** A blog's outline made for the current facts (BR2). */
  blogOutline: With<'blog_outline'>
  /** A blog's text written from the current outline (BR3). */
  blogText: With<'blog_text'>
  revision: With<'revision'>
  layout: With<'layout'>
  render: With<'render'>
  /** The cover options made for the current revision (criterion 102). */
  covers: With<'covers'>
  /** The images planned in words for the current revision (GD12), or a blog's current text (BR4). */
  artPlan: With<'art_plan'>
  /** A blog's pictures and embedded posts for its current text (BR4). */
  blogImages: With<'blog_images'>
  sourceCheck: With<'source_check'>
  settings: With<'settings'>
  sendBack: With<'send_back'>
  approval: With<'approval'>
  market: With<'market'>
  caption: With<'caption'>
  export: With<'export'>
}

/** The post's state from its pointers, keeping a record only when it links to the records it was made from. */
export function current(pointers: Pointers, records: ReadonlyMap<string, Artifact>): CurrentPost {
  /** The pointed-to record, if it exists, is of this kind, and its link holds. */
  function pick<K extends ArtifactKind>(
    kind: K,
    pointer: string | null,
    linked: (body: Body<K>) => boolean = () => true,
  ): With<K> {
    if (pointer === null) return null
    const record = records.get(pointer)
    if (!record || record.kind !== kind) return null
    const body = record.body as Body<K>
    return linked(body) ? { id: record.id, body } : null
  }

  const source = pick('source', pointers.sourceId)
  const facts = pick('facts', pointers.factsId, (b) => b.sourceId === source?.id)
  const drafts = pick('drafts', pointers.draftsId, (b) => b.factsId === facts?.id)
  const ideas = pick('ideas', pointers.ideasId, (b) => b.factsId === facts?.id)
  const outline = pick('post_outline', pointers.outlineId, (b) => b.factsId === facts?.id)
  const blogOutline = pick('blog_outline', pointers.blogOutlineId, (b) => b.factsId === facts?.id)
  const blogText = pick('blog_text', pointers.blogTextId, (b) => b.outlineId === blogOutline?.id)
  const revision = pick('revision', pointers.revisionId, (b) => b.factsId === facts?.id)
  const layout = pick('layout', pointers.layoutId, (b) => b.revisionId === revision?.id)
  const render = pick(
    'render',
    pointers.renderId,
    (b) => b.revisionId === revision?.id && b.layoutId === layout?.id,
  )
  const covers = pick('covers', pointers.coversId, (b) => b.revisionId === revision?.id)
  // A plan counts for what it was made from: a revision, or a blog's text, which has none (BR4).
  const artPlan = pick('art_plan', pointers.artPlanId, (b) =>
    b.blogTextId !== undefined
      ? b.blogTextId === blogText?.id
      : b.revisionId !== undefined && b.revisionId === revision?.id,
  )
  const blogImages = pick(
    'blog_images',
    pointers.blogImagesId,
    (b) => b.blogTextId === blogText?.id,
  )
  // A revision's check counts for that revision; before approval, a check of the picked version
  // counts while the post still points at that drafts record and that pick (criterion 98). A
  // blog's check counts for the text it read (BR3).
  const sourceCheck = pick('source_check', pointers.sourceCheckId, (b) =>
    b.blogTextId !== undefined
      ? b.revisionId === null && b.blogTextId === blogText?.id
      : b.revisionId !== null
        ? b.revisionId === revision?.id
        : revision === null &&
          b.draft !== undefined &&
          b.draft.draftsId === drafts?.id &&
          b.draft.index === pointers.picked,
  )
  const settings = pick('settings', pointers.settingsId)
  // A request for changes stays through the moves back until the post is sent to review again,
  // which clears the pointer (criterion 120). One from before steps were named (step null) counts
  // only for its revision, as then, so an old pointer left after a later review stays silent.
  const sendBack = pick(
    'send_back',
    pointers.sendBackId,
    (b) => (b.step ?? null) !== null || b.revisionId === revision?.id,
  )
  // Drawn with one render's art: new art on the same revision means the market version is stale.
  const market = pick(
    'market',
    pointers.marketId,
    (b) => b.revisionId === revision?.id && b.renderId === render?.id,
  )
  const caption = pick('caption', pointers.captionId, (b) => b.renderId === render?.id)
  const exported = pick(
    'export',
    pointers.exportId,
    (b) => b.renderId === render?.id && b.captionId === caption?.id,
  )
  // An approval's vision and override ids, on older rows, name what no longer gates anything.
  const approval = pick(
    'approval',
    pointers.approvalId,
    (b) =>
      b.revisionId === revision?.id &&
      b.renderId === render?.id &&
      b.sourceCheckId === sourceCheck?.id &&
      b.settingsId === settings?.id &&
      b.marketId === (market?.id ?? null) &&
      (b.blogTextId ?? null) === (blogText?.id ?? null),
  )

  return {
    source,
    facts,
    drafts,
    ideas,
    outline,
    blogOutline,
    blogText,
    revision,
    layout,
    render,
    covers,
    artPlan,
    blogImages,
    sourceCheck,
    settings,
    sendBack,
    approval,
    market,
    caption,
    export: exported,
  }
}

/**
 * The check "Use the source's wording" reads a claim from (criterion 104): the one that counts;
 * else, on a post an edit at a passed step has just moved back to its text (GD28,
 * server/commands/shared.ts movedBack: everything from the revision cleared, the check still
 * named), the approved revision's check the Text step's Checks tab showed, on the current facts,
 * until the picked version is checked again. Without it the press failed on every approved post
 * with "The source check has not finished" (18 Oct). Its claims name the slides the revision was
 * approved from; a sentence no longer in its slot is refused as moved on. Null for none.
 */
export function wordingCheck(
  pointers: Pointers,
  c: CurrentPost,
  records: ReadonlyMap<string, Artifact>,
): With<'source_check'> {
  if (c.sourceCheck || c.revision || pointers.sourceCheckId === null) return c.sourceCheck
  const record = records.get(pointers.sourceCheckId)
  if (record?.kind !== 'source_check') return null
  const body = record.body as Body<'source_check'>
  const revision = body.revisionId === null ? undefined : records.get(body.revisionId)
  const onFacts =
    revision?.kind === 'revision' &&
    (revision.body as Body<'revision'>).factsId === c.facts?.id &&
    body.blogTextId === undefined
  return onFacts ? { id: record.id, body } : null
}
