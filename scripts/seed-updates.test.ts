import { describe, expect, it } from 'bun:test'
import { type FeedRoadmap, feedUpdates } from '../src/features/updates/lib/feed-updates'
import samplesFile from './updates/samples.json'

const { parseSamples, pickActor, remoteRefusal, stepsFor } = await import('./seed-updates')

const samples = parseSamples(samplesFile)

/** A roadmap as the feed's match reads it. */
const roadmap = (over: Partial<FeedRoadmap>): FeedRoadmap => ({
  id: 'r',
  name: 'r',
  universities: [],
  country: null,
  courseTopics: [],
  interestTopics: [],
  hasRoad: true,
  ...over,
})

describe('the sample updates (scripts/updates/samples.json)', () => {
  it('labels every title and source as mock, and gives each a title of its own', () => {
    for (const s of samples) {
      expect(s.value.title, s.id).toContain('(mock)')
      expect(s.value.sourceTitle, s.id).toContain('(mock)')
    }
    expect(new Set(samples.map((s) => s.value.title)).size).toBe(samples.length)
  })

  it('covers rule changes, opportunities and deadlines, across the eight categories', () => {
    const kinds = new Set(samples.map((s) => s.value.kind))
    expect([...kinds].sort()).toEqual(['intake', 'opportunity', 'rule_change'])
    expect(samples.some((s) => s.value.applyBy !== null)).toBe(true)
    const categories = new Set(samples.map((s) => s.value.category))
    for (const c of [
      'Visa',
      'Graduate visa',
      'English test',
      'Fees',
      'Scholarship',
      'Intake',
      'Accommodation',
      'Work rights',
    ]) {
      expect(categories.has(c), c).toBe(true)
    }
  })

  it('reaches every institution, one institution, and one home country', () => {
    const audiences = samples.map((s) => s.value.audience)
    expect(audiences.some((a) => a.institution === 'All institutions')).toBe(true)
    for (const i of ['UniSA', 'ECU', 'Monash']) {
      expect(
        audiences.some((a) => a.institution === i),
        i,
      ).toBe(true)
    }
    for (const c of ['Nepal', 'India']) {
      expect(
        audiences.some((a) => a.homeCountry === c),
        c,
      ).toBe(true)
    }
  })

  it('gives a student with Adelaide roadmaps (graduate-entry Nursing, Cyber Security at UniSA) at least four, from Nepal or India', () => {
    const live = samples.map((s, i) => ({ ...s.value, id: `u${i}`, status: 'live' as const }))
    for (const country of ['Nepal', 'India']) {
      const roadmaps = [
        roadmap({ id: 'nursing', universities: ['UniSA'], country, courseTopics: ['health'] }),
        roadmap({ id: 'cyber', universities: ['UniSA'], country, courseTopics: ['cyber', 'it'] }),
      ]
      expect(feedUpdates(live, roadmaps).length, country).toBeGreaterThanOrEqual(4)
    }
  })

  it('refuses a file whose update the form would refuse, naming it', () => {
    const bad = {
      mock: true,
      updates: [{ ...samplesFile.updates[0], id: 'broken', institution: 'Nowhere' }],
    }
    expect(() => parseSamples(bad)).toThrow('broken')
  })
})

describe('stepsFor (running the script twice adds nothing)', () => {
  it('creates, sends to review and approves a new one, finishes one left half way, and leaves a live one', () => {
    expect(stepsFor(undefined)).toEqual(['create', 'review', 'approve'])
    expect(stepsFor('draft')).toEqual(['review', 'approve'])
    expect(stepsFor('in_review')).toEqual(['approve'])
    expect(stepsFor('live')).toEqual([])
  })
})

describe('pickActor (who publishes them)', () => {
  const user = (email: string, role: string, editor = false, reviewer = false) => ({
    id: email,
    email,
    role,
    editor,
    reviewer,
  })
  const users = [
    user('student@x.test', 'user'),
    user('admin@x.test', 'admin'),
    user('both@x.test', 'admin', true, true),
    user('super@x.test', 'superadmin'),
  ]

  it('takes the first account that may both write and approve, without --as', () => {
    expect(pickActor(users, null)).toEqual({ ok: true, actor: users[2] })
  })

  it('takes the account --as names, and refuses one that may not publish, or none', () => {
    expect(pickActor(users, 'super@x.test')).toEqual({ ok: true, actor: users[3] })
    expect(pickActor(users, 'admin@x.test').ok).toBe(false)
    expect(pickActor(users, 'nobody@x.test').ok).toBe(false)
    expect(pickActor([users[0]], null).ok).toBe(false)
  })
})

describe('remoteRefusal: only the local dev database unless asked', () => {
  it('lets this machine through, by name or address', () => {
    expect(remoteRefusal('postgres://app:dev@127.0.0.1:5433/app', false)).toBe(null)
    expect(remoteRefusal('postgres://app:dev@localhost:5433/app', false)).toBe(null)
  })

  it('refuses another host unless --allow-remote, naming the host and never the password', () => {
    const refusal = remoteRefusal('postgres://u:secret@db.example.com:5432/x', false)
    expect(refusal).toContain('db.example.com')
    expect(refusal).toContain('--allow-remote')
    expect(refusal).not.toContain('secret')
    expect(remoteRefusal('postgres://u:secret@db.example.com:5432/x', true)).toBe(null)
  })
})
