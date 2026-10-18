import { describe, expect, it } from 'bun:test'
import {
  chooseActors,
  closestFact,
  ideaTitle,
  nextFix,
  parseSpec,
  runOrder,
  scenesFor,
  settingsFor,
} from './make-posts-plan'

const IDEA = 'You can do anything, but not everything.'

describe('parseSpec', () => {
  it('takes a post from an idea, its tags written with or without their group', () => {
    const parsed = parseSpec([
      {
        idea: IDEA,
        kind: 'feed',
        look: 'pop',
        tags: { theme: ['work-study-life'], destination: ['destination:AU'], home: 'NP' },
      },
    ])
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.posts[0].tags.join(',')).toBe('destination:AU,home:NP,theme:work-study-life')
    expect(parsed.posts[0].language).toBe('en')
    expect(parsed.posts[0].featured).toBe(false)
  })

  it('refuses a spec that is not an array, or an empty one', () => {
    expect(parseSpec({ idea: IDEA, kind: 'feed' }).ok).toBe(false)
    expect(parseSpec([]).ok).toBe(false)
  })

  it('refuses a post with neither an idea nor a source, or with both, naming the post', () => {
    const neither = parseSpec([{ kind: 'feed' }])
    const both = parseSpec([{ kind: 'feed', idea: IDEA, source: 'https://example.com/a' }])
    expect(neither.ok ? '' : neither.errors.join()).toContain('Post 1')
    expect(both.ok).toBe(false)
  })

  it('refuses a source that is not an https link', () => {
    expect(parseSpec([{ kind: 'feed', source: 'ftp://example.com/a' }]).ok).toBe(false)
    expect(parseSpec([{ kind: 'feed', source: 'https://example.com/a' }]).ok).toBe(true)
  })

  it('refuses a tag the tag file does not have, naming it', () => {
    const parsed = parseSpec([{ kind: 'feed', idea: IDEA, tags: { theme: ['knitting'] } }])
    expect(parsed.ok ? '' : parsed.errors.join()).toContain('theme:knitting')
  })

  it("takes a post in any of the product's languages", () => {
    const parsed = parseSpec([
      { kind: 'feed', idea: IDEA, language: 'th', tags: { home: 'TH' } },
      { kind: 'feed', idea: IDEA, language: 'ne', tags: { home: 'NP' } },
    ])
    expect(parsed.ok ? parsed.posts.map((p) => `${p.language} ${p.tags}`).join(' | ') : '').toBe(
      'th home:TH | ne home:NP',
    )
  })

  it('refuses an unknown look, kind or language', () => {
    expect(parseSpec([{ kind: 'feed', idea: IDEA, look: 'neon' }]).ok).toBe(false)
    expect(parseSpec([{ kind: 'story', idea: IDEA }]).ok).toBe(false)
    expect(parseSpec([{ kind: 'feed', idea: IDEA, language: 'xx' }]).ok).toBe(false)
  })

  it('takes the id of a post to publish again, with or without its idea', () => {
    const id = '56a4068a-334c-43bf-af11-7b7a2de3caa9'
    expect(parseSpec([{ kind: 'feed', id }]).ok).toBe(true)
    expect(parseSpec([{ kind: 'feed', id, idea: IDEA }]).ok).toBe(true)
    expect(parseSpec([{ kind: 'feed', id: 'post-1' }]).ok).toBe(false)
  })

  it('takes a look, slide edits and our own pictures', () => {
    const parsed = parseSpec([
      {
        kind: 'feed',
        idea: IDEA,
        template: 'field-notes',
        edits: [{ slide: 2, layout: 'picture', text: { heading: 'Report card' } }],
        art: [{ slide: 2, svg: 'art/card.svg', scene: 'A blank report card' }],
      },
    ])
    expect(parsed.ok ? parsed.posts[0].art.map((a) => a.svg).join() : parsed.errors.join()).toBe(
      'art/card.svg',
    )
  })

  it('refuses an unknown look or layout, and a picture whose scene the art guard would refuse', () => {
    expect(parseSpec([{ kind: 'feed', idea: IDEA, template: 'collage' }]).ok).toBe(false)
    expect(
      parseSpec([{ kind: 'feed', idea: IDEA, edits: [{ slide: 1, layout: 'grid' }] }]).ok,
    ).toBe(false)
    const art = (scene: string) => [{ slide: 1, svg: 'a.svg', scene }]
    expect(parseSpec([{ kind: 'feed', idea: IDEA, art: art('Five flasks') }]).ok).toBe(true)
    expect(parseSpec([{ kind: 'feed', idea: IDEA, art: art('Flask 5') }]).ok).toBe(false)
    expect(parseSpec([{ kind: 'feed', idea: IDEA, art: art('A "full" flask') }]).ok).toBe(false)
  })

  it('refuses a scene hint longer than a scene may be', () => {
    const long = 'a'.repeat(201)
    expect(parseSpec([{ kind: 'feed', idea: IDEA, scenes: [{ when: 'x', scene: long }] }]).ok).toBe(
      false,
    )
  })
})

describe('runOrder', () => {
  it('runs the last post first, so the first is approved last and shows first', () => {
    const order = runOrder(['first', 'second', 'third'])
    expect(order.map((o) => `${o.at}:${o.post}`).join(' ')).toBe('3:third 2:second 1:first')
  })
})

describe('chooseActors', () => {
  const user = (
    email: string,
    more: Partial<{ role: string; editor: boolean; reviewer: boolean }>,
  ) => ({
    id: email,
    email,
    name: email,
    role: 'user',
    editor: false,
    reviewer: false,
    suspended: false,
    ...more,
  })

  it('takes the first superadmin or editor, who approves too when they may review', () => {
    const chosen = chooseActors([
      user('student@x', {}),
      user('admin@x', { role: 'superadmin' }),
      user('ed@x', { editor: true }),
    ])
    expect(chosen.ok ? `${chosen.maker.id} ${chosen.reviewer.id}` : chosen.error).toBe(
      'admin@x admin@x',
    )
  })

  it('has a second account approve when the maker may not review', () => {
    const chosen = chooseActors([user('ed@x', { editor: true }), user('rev@x', { reviewer: true })])
    expect(chosen.ok ? `${chosen.maker.id} ${chosen.reviewer.id}` : chosen.error).toBe('ed@x rev@x')
  })

  it('stops when nobody may approve', () => {
    const chosen = chooseActors([user('ed@x', { editor: true })])
    expect(chosen.ok).toBe(false)
  })

  it('refuses --as for a student, an unknown address or a suspended editor', () => {
    const users = [
      user('student@x', {}),
      { ...user('gone@x', { editor: true }), suspended: true },
      user('admin@x', { role: 'superadmin' }),
    ]
    expect(chooseActors(users, 'student@x').ok).toBe(false)
    expect(chooseActors(users, 'nobody@x').ok).toBe(false)
    expect(chooseActors(users, 'gone@x').ok).toBe(false)
    expect(chooseActors(users, 'ADMIN@x').ok).toBe(true)
  })
})

describe('settingsFor', () => {
  const facts = [{ id: 'f1', text: 'Students in Sydney juggle work.', supported: true }]

  it('keeps the default settings with exactly the tags given', () => {
    const s = settingsFor(facts as never, 'en', {
      tags: ['theme:work-study-life'],
      featured: false,
    })
    expect(`${s.layer} ${s.audience.mode} ${s.expiry.kind} ${s.tags.join(',')}`).toBe(
      'general everyone days theme:work-study-life',
    )
  })

  it('puts a featured post in the featured layer', () => {
    expect(settingsFor(facts as never, 'en', { tags: [], featured: true }).layer).toBe('featured')
  })
})

describe('scenesFor', () => {
  const hints = [
    { when: 'Semester', scene: 'A vintage report card' },
    { when: 'husband', scene: 'A blank report card' },
    { scene: 'One flask filled from a jug' },
    { scene: 'Five flasks, each barely wet' },
  ]
  const slides = (texts: string[]) => texts.map((text, i) => ({ slide: i + 1, text }))

  it('gives a slide the first hint whose words it says, in any case', () => {
    const got = scenesFor(slides(['Role: Husband, Son', 'SEMESTER 1 grades']), hints.slice(0, 2))
    expect(got.map((g) => `${g.slide}:${g.scene}`).join(' | ')).toBe(
      '1:A blank report card | 2:A vintage report card',
    )
  })

  it('gives the slides no hint names the hints without words, in order, each once', () => {
    const got = scenesFor(slides(['Semester one', 'Pick one', 'Pick two', 'Pick three']), hints)
    expect(got.map((g) => `${g.slide}:${g.scene}`).join(' | ')).toBe(
      '1:A vintage report card | 2:One flask filled from a jug | 3:Five flasks, each barely wet',
    )
  })
})

describe('nextFix', () => {
  const tooLong = {
    text: 'Slide 2 body is too long',
    fix: { kind: 'nudge' as const, nudge: 'shorter' as const, slide: 2 },
  }
  const unbound = {
    text: 'Slide 3 body is not in the source',
    fix: { kind: 'bind' as const, slide: 3, slot: 'body' },
  }
  it('shortens a slide whose words do not fit, once', () => {
    expect(nextFix([tooLong], new Set())).toEqual({ kind: 'nudge', slide: 2 })
    expect(nextFix([tooLong], new Set(['nudge:2']))).toEqual({ kind: 'next' })
  })

  it('tries the next version for a problem no press fixes here', () => {
    expect(nextFix([unbound], new Set())).toEqual({ kind: 'next' })
  })

  it('is ready with no problem', () => {
    expect(nextFix([], new Set())).toEqual({ kind: 'ready' })
  })
})

describe('ideaTitle', () => {
  it("is the idea's first sentence, so the search line that names it fits", () => {
    expect(ideaTitle('At university someone grades you. After it, nobody does.')).toBe(
      'At university someone grades you.',
    )
  })

  it('is the first 80 characters of an idea with no sentence end', () => {
    expect(ideaTitle('a'.repeat(120)).length).toBe(80)
  })
})

describe('closestFact', () => {
  const fact = (id: string, text: string, supported = true) => ({ id, text, supported })
  const facts = [
    fact('f1', 'At university someone grades you every semester.'),
    fact('f2', 'Academic Writing A, Statistics 101 C, Data Analysis C.'),
    fact('f3', 'Husband, Son, Dog parent and Citizen, then three empty rows.'),
    fact('f4', 'Husband, Son, Dog parent, Citizen, three rows.', false),
  ]

  it('is the supported fact that shares the most words with the text', () => {
    expect(closestFact('Husband, Son, Dog parent, Citizen.', facts as never)?.id).toBe('f3')
    expect(closestFact('Statistics 101 C, Data Analysis C', facts as never)?.id).toBe('f2')
  })

  it('is none when no supported fact shares a word', () => {
    expect(closestFact('Nothing alike here', facts as never)).toBeNull()
  })
})
