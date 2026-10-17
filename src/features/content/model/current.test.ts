import { describe, expect, it } from 'bun:test'
import { type Artifact, type ArtifactKind, emptyPointers, type Pointers } from './artifacts'
import { current, wordingCheck } from './current'

const stamp = { userId: 'u1', name: 'Ed', at: '2026-10-05T10:00:00.000Z' }

function rec(id: string, kind: ArtifactKind, body: Record<string, unknown>): Artifact {
  return {
    id,
    kind,
    postId: 'p1',
    body,
    createdAt: stamp.at,
    createdByUserId: 'u1',
  } as unknown as Artifact
}

function records(...list: Artifact[]): Map<string, Artifact> {
  return new Map(list.map((r) => [r.id, r]))
}

const source = rec('source_1', 'source', {
  title: 'S',
  kind: 'article',
  text: 't',
  paragraphs: [],
  demoKey: null,
})
const facts = rec('facts_1', 'facts', {
  sourceId: 'source_1',
  keyIdeas: [],
  facts: [],
  replays: [],
})
const revision = rec('revision_2', 'revision', {
  factsId: 'facts_1',
  themeId: 't',
  by: stamp,
  note: 'approved',
})
const oldRevision = rec('revision_1', 'revision', {
  factsId: 'facts_1',
  themeId: 't',
  by: stamp,
  note: 'approved',
})
const layout = rec('layout_2', 'layout', {
  revisionId: 'revision_2',
  slides: [],
  fits: [],
  fitChecks: [],
})
const render = rec('render_2', 'render', {
  revisionId: 'revision_2',
  layoutId: 'layout_2',
  slides: [],
})
const oldRender = rec('render_1', 'render', {
  revisionId: 'revision_1',
  layoutId: 'layout_1',
  slides: [],
})
const check = rec('source_check_2', 'source_check', {
  revisionId: 'revision_2',
  claims: [],
  replays: [],
})
const settings = rec('settings_1', 'settings', { layer: 'general' })

const linked: Pointers = {
  ...emptyPointers(),
  sourceId: 'source_1',
  factsId: 'facts_1',
  revisionId: 'revision_2',
  layoutId: 'layout_2',
  renderId: 'render_2',
}
const base = [source, facts, revision, layout, render]

function approvalBody(over: Record<string, unknown> = {}) {
  return {
    revisionId: 'revision_2',
    renderId: 'render_2',
    sourceCheckId: 'source_check_2',
    settingsId: 'settings_1',
    visionId: null,
    overrideId: null,
    marketId: null,
    by: stamp,
    selfReviewed: false,
    ...over,
  }
}

describe('current', () => {
  it('counts a source, facts, revision, layout and render that all link up', () => {
    const c = current(linked, records(...base))
    expect(c.source?.id).toBe('source_1')
    expect(c.facts?.id).toBe('facts_1')
    expect(c.revision?.id).toBe('revision_2')
    expect(c.layout?.id).toBe('layout_2')
    expect(c.render?.id).toBe('render_2')
  })

  it('counts the idea cards while they were offered for the current facts, and reads older ones as null (GD1)', () => {
    const ideas = (factsId: string) => rec('ideas_1', 'ideas', { factsId, cards: [], rounds: 1 })
    const pointers = { ...linked, ideasId: 'ideas_1' }
    expect(current(pointers, records(...base, ideas('facts_1'))).ideas?.id).toBe('ideas_1')
    expect(current(pointers, records(...base, ideas('facts_0'))).ideas).toBeNull()
    expect(current(linked, records(...base, ideas('facts_1'))).ideas).toBeNull()
  })

  it('counts the outline while it was made for the current facts, and reads older ones as null (GD32)', () => {
    const outline = (factsId: string) =>
      rec('post_outline_1', 'post_outline', { factsId, ideas: [], slides: [], note: 'Outlined' })
    const pointers = { ...linked, outlineId: 'post_outline_1' }
    expect(current(pointers, records(...base, outline('facts_1'))).outline?.id).toBe(
      'post_outline_1',
    )
    expect(current(pointers, records(...base, outline('facts_0'))).outline).toBeNull()
    expect(current(linked, records(...base, outline('facts_1'))).outline).toBeNull()
  })

  it("counts a blog's outline while it was made for the current facts, and its text while it follows that outline", () => {
    const outline = (id: string, factsId: string) =>
      rec(id, 'blog_outline', { factsId, idea: null, sections: [], takeaways: [], faq: [] })
    const text = (outlineId: string) =>
      rec('blog_text_1', 'blog_text', { outlineId, sections: [], takeaways: [], faq: [] })
    const pointers = { ...linked, blogOutlineId: 'blog_outline_2', blogTextId: 'blog_text_1' }
    const at = (...list: Artifact[]) => current(pointers, records(...base, ...list))

    const kept = at(outline('blog_outline_2', 'facts_1'), text('blog_outline_2'))
    expect(kept.blogOutline?.id).toBe('blog_outline_2')
    expect(kept.blogText?.id).toBe('blog_text_1')
    // Text written for an earlier outline no longer counts once the outline changed.
    const stale = at(outline('blog_outline_2', 'facts_1'), text('blog_outline_1'))
    expect(stale.blogOutline?.id).toBe('blog_outline_2')
    expect(stale.blogText).toBeNull()
    // New facts: the outline made for the old ones drops, and the text resting on it with it.
    const old = at(outline('blog_outline_2', 'facts_0'), text('blog_outline_2'))
    expect(old.blogOutline).toBeNull()
    expect(old.blogText).toBeNull()
    // A post's slide outline is not a blog's.
    const slides = rec('blog_outline_2', 'post_outline', { factsId: 'facts_1', ideas: [] })
    expect(at(slides).blogOutline).toBeNull()
  })

  it("counts a blog's source check while it names the current text, and never for anything else (BR3)", () => {
    const outline = rec('blog_outline_1', 'blog_outline', { factsId: 'facts_1' })
    const text = (id: string) => rec(id, 'blog_text', { outlineId: 'blog_outline_1' })
    const blogCheck = rec('source_check_b', 'source_check', {
      revisionId: null,
      blogTextId: 'blog_text_1',
      claims: [],
      replays: [],
    })
    const blog: Pointers = {
      ...emptyPointers(),
      sourceId: 'source_1',
      factsId: 'facts_1',
      blogOutlineId: 'blog_outline_1',
      blogTextId: 'blog_text_1',
      sourceCheckId: 'source_check_b',
    }
    const counted = (pointers: Pointers, ...list: Artifact[]) =>
      current(pointers, records(source, facts, outline, ...list)).sourceCheck?.id ?? null

    expect(counted(blog, text('blog_text_1'), blogCheck)).toBe('source_check_b')
    // The text edited: a new record, which the check did not read.
    expect(
      counted({ ...blog, blogTextId: 'blog_text_2' }, text('blog_text_2'), blogCheck),
    ).toBeNull()
    // A check of a picked version or a revision never counts for a blog's text, nor a blog's for them.
    const draftCheck = rec('source_check_b', 'source_check', {
      revisionId: null,
      draft: { draftsId: 'drafts_1', index: 0 },
      claims: [],
      replays: [],
    })
    expect(counted(blog, text('blog_text_1'), draftCheck)).toBeNull()
    const drafts = rec('drafts_1', 'drafts', { factsId: 'facts_1', items: [] })
    const picked = { ...blog, draftsId: 'drafts_1', picked: 0, blogTextId: null }
    expect(counted(picked, drafts, blogCheck)).toBeNull()
  })

  it("counts a blog's image plan and pictures while they were made for the current text, and a revision's plan never for a blog (BR4)", () => {
    const outline = rec('blog_outline_1', 'blog_outline', { factsId: 'facts_1' })
    const text = (id: string) => rec(id, 'blog_text', { outlineId: 'blog_outline_1' })
    const plan = rec('art_plan_b', 'art_plan', {
      blogTextId: 'blog_text_1',
      scenes: [],
      panorama: false,
    })
    const pictures = rec('blog_images_1', 'blog_images', {
      blogTextId: 'blog_text_1',
      version: 1,
      images: [],
      embeds: [],
    })
    const blog: Pointers = {
      ...emptyPointers(),
      sourceId: 'source_1',
      factsId: 'facts_1',
      blogOutlineId: 'blog_outline_1',
      blogTextId: 'blog_text_1',
      artPlanId: 'art_plan_b',
      blogImagesId: 'blog_images_1',
    }
    const at = (pointers: Pointers) =>
      current(
        pointers,
        records(source, facts, outline, text('blog_text_1'), text('blog_text_2'), plan, pictures),
      )

    expect(at(blog).artPlan?.id).toBe('art_plan_b')
    expect(at(blog).blogImages?.id).toBe('blog_images_1')
    // The text edited: the plan and the pictures made for the text before no longer count.
    const edited = at({ ...blog, blogTextId: 'blog_text_2' })
    expect(edited.artPlan).toBeNull()
    expect(edited.blogImages).toBeNull()
    // A blog's plan is not a revision's, nor a revision's a blog's.
    expect(current({ ...linked, artPlanId: 'art_plan_b' }, records(...base, plan)).artPlan).toBe(
      null,
    )
    const revisionPlan = rec('art_plan_b', 'art_plan', {
      revisionId: 'revision_2',
      scenes: [],
      panorama: false,
    })
    expect(
      current(blog, records(source, facts, outline, text('blog_text_1'), revisionPlan)).artPlan,
    ).toBeNull()
  })

  it('reads an approval that names another blog text as null (BR3)', () => {
    const outline = rec('blog_outline_1', 'blog_outline', { factsId: 'facts_1' })
    const text = rec('blog_text_1', 'blog_text', { outlineId: 'blog_outline_1' })
    const pointers = {
      ...linked,
      sourceCheckId: 'source_check_2',
      settingsId: 'settings_1',
      approvalId: 'approval_1',
      blogOutlineId: 'blog_outline_1',
      blogTextId: 'blog_text_1',
    }
    const at = (blogTextId: string) =>
      current(
        pointers,
        records(
          ...base,
          check,
          settings,
          outline,
          text,
          rec('approval_1', 'approval', approvalBody({ blogTextId })),
        ),
      ).approval?.id ?? null
    expect(at('blog_text_1')).toBe('approval_1')
    expect(at('blog_text_0')).toBeNull()
  })

  it('reads a source check for an older revision as null though the pointer is set', () => {
    const stale = rec('source_check_1', 'source_check', {
      revisionId: 'revision_1',
      claims: [],
      replays: [],
    })
    const c = current(
      { ...linked, sourceCheckId: 'source_check_1' },
      records(...base, oldRevision, stale),
    )
    expect(c.sourceCheck).toBeNull()
    expect(
      current({ ...linked, sourceCheckId: 'source_check_2' }, records(...base, check)).sourceCheck
        ?.id,
    ).toBe('source_check_2')
  })

  describe('a source check of the picked version before approval (criterion 98)', () => {
    const drafts = rec('drafts_2', 'drafts', { factsId: 'facts_1', items: [] })
    const editing: Pointers = {
      ...emptyPointers(),
      sourceId: 'source_1',
      factsId: 'facts_1',
      draftsId: 'drafts_2',
      picked: 1,
      sourceCheckId: 'source_check_d',
    }
    const draftCheck = (draftsId: string, index: number) =>
      rec('source_check_d', 'source_check', {
        revisionId: null,
        draft: { draftsId, index },
        claims: [],
        replays: [],
      })
    const counted = (pointers: Pointers, ...list: Artifact[]) =>
      current(pointers, records(source, facts, drafts, ...list)).sourceCheck?.id ?? null

    it('counts while the post still points at those drafts and that pick, with no revision', () => {
      expect(counted(editing, draftCheck('drafts_2', 1))).toBe('source_check_d')
    })

    it('reads as null once the text is saved again (new drafts) or another version is picked', () => {
      expect(counted(editing, draftCheck('drafts_1', 1))).toBeNull()
      expect(counted({ ...editing, picked: 0 }, draftCheck('drafts_2', 1))).toBeNull()
    })

    it('reads as null once the version is approved: the revision needs its own check', () => {
      expect(
        counted({ ...editing, revisionId: 'revision_2' }, draftCheck('drafts_2', 1), revision),
      ).toBeNull()
    })

    it('never lets a check of a revision count for the draft that revision came from', () => {
      expect(counted({ ...editing, sourceCheckId: 'source_check_2' }, check)).toBeNull()
    })
  })

  it('reads an approval whose render is not the current render as null', () => {
    const pointers = {
      ...linked,
      sourceCheckId: 'source_check_2',
      settingsId: 'settings_1',
      approvalId: 'approval_1',
    }
    const stale = rec('approval_1', 'approval', approvalBody({ renderId: 'render_1' }))
    expect(
      current(pointers, records(...base, oldRender, check, settings, stale)).approval,
    ).toBeNull()
    const good = rec('approval_1', 'approval', approvalBody())
    expect(current(pointers, records(...base, check, settings, good)).approval?.id).toBe(
      'approval_1',
    )
  })

  it('still counts an approval that names a slide vision and an override, as older ones do (103)', () => {
    const vision = rec('vision_1', 'vision', {
      renderId: 'render_2',
      readable: true,
      figuresMatch: true,
      strayText: true,
      notes: 'Text in the art.',
      replays: [],
    })
    const override = rec('override_1', 'override', {
      visionId: 'vision_1',
      renderId: 'render_2',
      reason: 'ok',
      by: stamp,
    })
    const approval = rec(
      'approval_1',
      'approval',
      approvalBody({ visionId: 'vision_1', overrideId: 'override_1', marketVisionId: 'vision_9' }),
    )
    const pointers = {
      ...linked,
      sourceCheckId: 'source_check_2',
      settingsId: 'settings_1',
      visionId: 'vision_1',
      overrideId: 'override_1',
      approvalId: 'approval_1',
    }
    const c = current(pointers, records(...base, check, settings, vision, override, approval))
    expect(c.approval?.id).toBe('approval_1')
    // Nothing reads a slide vision any more: the post's state has none.
    expect(Object.keys(c)).not.toContain('vision')
    expect(Object.keys(c)).not.toContain('override')
  })

  it('counts a Nepal version only while it was made from the current revision and render', () => {
    const market = (id: string, revisionId: string, renderId: string) =>
      rec(id, 'market', { revisionId, renderId, market: 'NP', slots: [], slides: [] })
    const sameRevision = rec('render_3', 'render', {
      revisionId: 'revision_2',
      layoutId: 'layout_2',
      slides: [],
    })
    const at = (marketId: string, ...list: Artifact[]) =>
      current({ ...linked, marketId }, records(...base, sameRevision, ...list)).market
    expect(at('market_1', market('market_1', 'revision_2', 'render_2'))?.id).toBe('market_1')
    // New art on the same revision: the Nepal version drew the old art, so it no longer counts.
    expect(at('market_1', market('market_1', 'revision_2', 'render_3'))).toBeNull()
    expect(at('market_1', market('market_1', 'revision_1', 'render_2'))).toBeNull()
  })

  it('counts cover options only while they were made for the current revision (102)', () => {
    const covers = (revisionId: string) => rec('covers_1', 'covers', { revisionId, options: [] })
    const at = (...list: Artifact[]) =>
      current({ ...linked, coversId: 'covers_1' }, records(...base, ...list)).covers
    expect(at(covers('revision_2'))?.id).toBe('covers_1')
    // A light edit made another revision: covers drawn for the old text no longer count.
    expect(at(covers('revision_1'))).toBeNull()
  })

  it('counts an image plan only while it was made for the current revision (GD12)', () => {
    const plan = (revisionId: string) =>
      rec('art_plan_1', 'art_plan', { revisionId, scenes: [], panorama: false })
    const at = (...list: Artifact[]) =>
      current({ ...linked, artPlanId: 'art_plan_1' }, records(...base, ...list)).artPlan
    expect(at(plan('revision_2'))?.id).toBe('art_plan_1')
    // An edit made another revision: scenes planned for the old text no longer count.
    expect(at(plan('revision_1'))).toBeNull()
  })

  it('keeps a request for changes that names a step through every move until the post is sent to review again (120)', () => {
    const sendBack = (step: string | null) =>
      rec('send_back_1', 'send_back', {
        revisionId: 'revision_1',
        reason: 'Too long',
        by: stamp,
        step,
      })
    const at = (pointers: Pointers, ...list: Artifact[]) =>
      current({ ...pointers, sendBackId: 'send_back_1' }, records(...base, ...list)).sendBack
    // Its revision is gone (a move back, a new approval): a note naming a step still counts.
    expect(at(linked, sendBack('covers'))?.id).toBe('send_back_1')
    expect(at({ ...linked, revisionId: null }, sendBack('structures'))?.id).toBe('send_back_1')
    // One from before steps were named counts only for the revision it was written on.
    expect(at(linked, sendBack(null))).toBeNull()
    const unnamed = rec('send_back_1', 'send_back', {
      revisionId: 'revision_1',
      reason: 'Too long',
      by: stamp,
    })
    expect(at(linked, unnamed)).toBeNull()
    expect(at({ ...linked, revisionId: 'revision_1' }, oldRevision, sendBack(null))?.id).toBe(
      'send_back_1',
    )
  })

  it('reads a pointer to a record of the wrong kind, or a missing one, as null', () => {
    const c = current({ ...linked, sourceId: 'facts_1', factsId: 'nope_9' }, records(...base))
    expect(c.source).toBeNull()
    expect(c.facts).toBeNull()
    expect(c.drafts).toBeNull()
  })
})

describe('wordingCheck: the check "Use the source’s wording" reads a claim from (criterion 104)', () => {
  const drafts = rec('drafts_2', 'drafts', { factsId: 'facts_1', items: [] })
  const notFound = rec('source_check_2', 'source_check', {
    revisionId: 'revision_2',
    claims: [{ slide: 2, slot: 'body', text: 'x', result: 'not_found' }],
    replays: [],
  })
  // An approved post as the Text step's Checks tab shows it: the revision's check counts.
  const approved: Pointers = {
    ...linked,
    draftsId: 'drafts_2',
    picked: 0,
    sourceCheckId: 'source_check_2',
  }
  // The same post as the edit sees it once moved back to the text (server/commands/shared.ts
  // movedBack): everything from the revision cleared, the check still named.
  const movedBack: Pointers = {
    ...emptyPointers(),
    sourceId: 'source_1',
    factsId: 'facts_1',
    draftsId: 'drafts_2',
    picked: 0,
    sourceCheckId: 'source_check_2',
  }
  const read = (pointers: Pointers, ...list: Artifact[]) => {
    const all = records(source, facts, drafts, ...list)
    return wordingCheck(pointers, current(pointers, all), all)?.id ?? null
  }

  it('reads the check that counts', () => {
    expect(read(approved, ...base, notFound)).toBe('source_check_2')
  })

  it('reads the revision’s check the Checks tab showed on a post moved back from Images, where none counts (18 Oct: stuck)', () => {
    const all = records(source, facts, drafts, revision, notFound)
    expect(current(movedBack, all).sourceCheck).toBeNull()
    expect(read(movedBack, revision, notFound)).toBe('source_check_2')
  })

  it('reads none for a revision on other facts, a check that is not one, or none named', () => {
    const otherFacts = rec('revision_2', 'revision', { factsId: 'facts_0', themeId: 't' })
    expect(read(movedBack, otherFacts, notFound)).toBeNull()
    expect(read(movedBack, revision)).toBeNull()
    expect(read({ ...movedBack, sourceCheckId: null }, revision, notFound)).toBeNull()
    const stale = rec('source_check_2', 'source_check', {
      revisionId: null,
      draft: { draftsId: 'drafts_1', index: 0 },
      claims: [],
      replays: [],
    })
    expect(read(movedBack, revision, stale)).toBeNull()
  })

  it('reads none for an older revision’s check while a revision is current', () => {
    const old = rec('source_check_2', 'source_check', {
      revisionId: 'revision_1',
      claims: [],
      replays: [],
    })
    expect(read(approved, ...base, oldRevision, old)).toBeNull()
  })
})
