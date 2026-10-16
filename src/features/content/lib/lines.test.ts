import { describe, expect, it } from 'bun:test'
import { formatWhen } from '@/shared/lib/site'
import type { Body } from '../model/artifacts'
import type { FeedSettings } from '../model/types'
import { expiresAt, historyLine, liveLine, reviewLine, sendBackLine, tagsLine } from './lines'

const GENERAL_90: FeedSettings = {
  layer: 'general',
  audience: { mode: 'everyone', rules: [] },
  whyLine: null,
  expiry: { kind: 'days', days: 90 },
  studioLink: null,
  tags: [],
  sourcesAt: 'caption',
}

const RAVI = { userId: 'u-ravi', name: 'Ravi K.', at: '2026-10-05T09:12:00.000Z' }

const approval = (selfReviewed: boolean): Body<'approval'> => ({
  revisionId: 'rev1',
  renderId: 'ren1',
  sourceCheckId: 'sc1',
  settingsId: 'set1',
  visionId: null,
  overrideId: null,
  marketId: null,
  by: RAVI,
  selfReviewed,
})

describe('liveLine', () => {
  it('reads layer, audience and days left', () => {
    expect(liveLine(GENERAL_90)).toBe('General · Everyone · Leaves the feed in 90 days')
  })

  it('counts a matched audience and says when there is no expiry', () => {
    expect(
      liveLine({
        layer: 'personal',
        audience: { mode: 'matched', rules: ['Destination: Australia'] },
        whyLine: 'Because you are heading to Australia.',
        expiry: { kind: 'none' },
        studioLink: null,
        tags: [],
        sourcesAt: 'caption',
      }),
    ).toBe('Personal · 1,284 matched students · No expiry')
  })

  it('names the day a dated post leaves the feed', () => {
    expect(
      liveLine({ ...GENERAL_90, layer: 'featured', expiry: { kind: 'date', date: '2027-03-31' } }),
    ).toBe('Featured · Everyone · Leaves the feed on 31 Mar 2027')
  })
})

describe('liveLine once approved (54)', () => {
  const APPROVED = '2026-10-06T09:00:00.000Z'
  const at = (iso: string) => new Date(iso)

  it('counts the days left from the approval', () => {
    expect(liveLine(GENERAL_90, APPROVED, at('2026-10-06T09:00:01.000Z'))).toBe(
      'General · Everyone · Leaves the feed in 90 days',
    )
    expect(liveLine(GENERAL_90, APPROVED, at('2026-11-28T12:00:00.000Z'))).toBe(
      'General · Everyone · Leaves the feed in 37 days',
    )
  })

  it('says tomorrow on the last day', () => {
    expect(liveLine(GENERAL_90, APPROVED, at('2027-01-03T10:00:00.000Z'))).toBe(
      'General · Everyone · Leaves the feed tomorrow',
    )
  })

  it('says the day it left once the days are past', () => {
    expect(liveLine(GENERAL_90, APPROVED, at('2027-01-04T09:00:00.000Z'))).toBe(
      'General · Everyone · Left the feed on 4 Jan 2027',
    )
    expect(liveLine(GENERAL_90, APPROVED, at('2027-03-01T00:00:00.000Z'))).toBe(
      'General · Everyone · Left the feed on 4 Jan 2027',
    )
  })

  it('keeps "No expiry"', () => {
    expect(
      liveLine({ ...GENERAL_90, expiry: { kind: 'none' } }, APPROVED, at('2027-03-01T00:00:00Z')),
    ).toBe('General · Everyone · No expiry')
  })

  it('reads a date expiry as leaving on it, or as having left on it once it is past', () => {
    const dated: FeedSettings = { ...GENERAL_90, expiry: { kind: 'date', date: '2027-03-31' } }
    expect(liveLine(dated, APPROVED, at('2027-03-30T23:59:00.000Z'))).toBe(
      'General · Everyone · Leaves the feed on 31 Mar 2027',
    )
    expect(liveLine(dated, APPROVED, at('2027-03-31T00:00:00.000Z'))).toBe(
      'General · Everyone · Left the feed on 31 Mar 2027',
    )
  })
})

describe('tagsLine (80)', () => {
  it('reads the ticked labels in order', () => {
    expect(tagsLine({ ...GENERAL_90, tags: ['home:IN', 'theme:books-movies'] })).toBe(
      'India · Books and movies',
    )
  })

  it('is for everyone with nothing ticked', () => {
    expect(tagsLine(GENERAL_90)).toBe('For everyone')
  })

  it('skips an id the tag file no longer has (92)', () => {
    expect(tagsLine({ ...GENERAL_90, tags: ['theme:gone', 'home:NP'] })).toBe('Nepal')
    expect(tagsLine({ ...GENERAL_90, tags: ['theme:gone'] })).toBe('For everyone')
  })
})

describe('expiresAt', () => {
  const APPROVED = '2026-10-06T09:00:00.000Z'

  it('is null with no expiry', () => {
    expect(expiresAt({ kind: 'none' }, APPROVED)).toBeNull()
  })

  it('counts the days from the approval', () => {
    expect(expiresAt({ kind: 'days', days: 30 }, APPROVED)).toBe(
      Date.parse('2026-11-05T09:00:00.000Z'),
    )
  })

  it('is midnight UTC on the dated day', () => {
    expect(expiresAt({ kind: 'date', date: '2027-03-31' }, APPROVED)).toBe(
      Date.parse('2027-03-31T00:00:00.000Z'),
    )
  })
})

describe('reviewLine', () => {
  it('names the reviewer and locks the facts', () => {
    expect(reviewLine(approval(false))).toBe('Reviewed by Ravi K. · facts locked')
  })

  it('says when the maker reviewed their own post', () => {
    expect(reviewLine(approval(true))).toBe('Reviewed by Ravi K. · facts locked · self-reviewed')
  })
})

describe('sendBackLine', () => {
  it('names who asked for changes, when, and why (120)', () => {
    expect(
      sendBackLine({ revisionId: 'rev1', reason: 'Slide 2 is too long', by: RAVI, step: 'covers' }),
    ).toBe(`Changes requested by Ravi K. · ${formatWhen(RAVI.at)}: Slide 2 is too long`)
  })
})

describe('historyLine', () => {
  it('reads a stored note in sentence case, and a record with none as Saved (101)', () => {
    expect(historyLine(null)).toBe('Saved')
    expect(historyLine('Slide 2 edited')).toBe('Slide 2 edited')
    expect(historyLine('approved')).toBe('Approved')
    expect(historyLine('social: Cerebral')).toBe('Social: Cerebral')
  })

  it('spells out the terse revision notes', () => {
    expect(historyLine('light edit: phrase')).toBe('Light edit')
    expect(historyLine('reorder')).toBe('Slides reordered')
    expect(historyLine('remove claim')).toBe('Claim removed')
    expect(historyLine('source wording')).toBe('Source wording used')
  })
})
