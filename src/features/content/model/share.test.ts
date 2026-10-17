import { describe, expect, it } from 'bun:test'
import { BODIES } from './artifacts'
import { SHARE_ACCOUNTS, SHARE_ERRORS, shareChoice, sharedMessage, shareLine } from './share'

// Sharing a live feed post to the pages' accounts (criteria 9–11): which accounts there are, which
// choices a share takes, and how a share reads in its toast and in the post's list.

const RAE = { userId: 'u1', name: 'Rae', at: '2026-10-17T09:12:00.000Z' }

describe('SHARE_ACCOUNTS', () => {
  it('lists every page’s Instagram account by its handle, and the main page as the one LinkedIn page (9)', () => {
    expect(SHARE_ACCOUNTS.instagram).toEqual([
      { id: 'main', label: '@ofcourse_ai' },
      { id: 'cerebral', label: '@ofcourse_philosophy' },
      { id: 'infographics', label: '@ofcourse_selfhelp' },
      { id: 'comics', label: '@ofcourse_comics' },
    ])
    expect(SHARE_ACCOUNTS.linkedin).toEqual([{ id: 'main', label: 'OfCourse' }])
  })
})

describe('shareChoice', () => {
  it('takes several Instagram accounts and the LinkedIn page, in the order listed, each once (9)', () => {
    expect(
      shareChoice({ instagram: ['cerebral', 'main', 'cerebral'], linkedin: ['main'] }),
    ).toEqual({ ok: true, accounts: { instagram: ['main', 'cerebral'], linkedin: ['main'] } })
    expect(shareChoice({ instagram: [], linkedin: ['main'] })).toEqual({
      ok: true,
      accounts: { instagram: [], linkedin: ['main'] },
    })
  })

  it('refuses a share with no account ticked (11)', () => {
    expect(shareChoice({ instagram: [], linkedin: [] })).toEqual({
      ok: false,
      error: SHARE_ERRORS.none,
    })
  })

  it('refuses an account that is not listed', () => {
    for (const accounts of [
      { instagram: ['main', 'feed'], linkedin: [] },
      { instagram: [], linkedin: ['cerebral'] },
      { instagram: ['MAIN'], linkedin: [] },
    ]) {
      expect(shareChoice(accounts)).toEqual({ ok: false, error: SHARE_ERRORS.unknown })
    }
  })
})

describe('sharedMessage', () => {
  it('says where the post went: the Instagram handles, and/or LinkedIn (10)', () => {
    expect(sharedMessage({ instagram: ['main', 'cerebral'], linkedin: [] })).toBe(
      'Shared to Instagram: @ofcourse_ai, @ofcourse_philosophy',
    )
    expect(sharedMessage({ instagram: [], linkedin: ['main'] })).toBe('Shared to LinkedIn')
    expect(sharedMessage({ instagram: ['comics'], linkedin: ['main'] })).toBe(
      'Shared to Instagram: @ofcourse_comics · LinkedIn',
    )
  })
})

describe('shareLine', () => {
  it('lists a share with its accounts and who shared it (10)', () => {
    expect(shareLine({ instagram: ['main', 'cerebral'], linkedin: ['main'], by: RAE })).toBe(
      'Shared to Instagram: @ofcourse_ai, @ofcourse_philosophy · LinkedIn: OfCourse · by Rae',
    )
    expect(shareLine({ instagram: [], linkedin: ['main'], by: RAE })).toBe(
      'Shared to LinkedIn: OfCourse · by Rae',
    )
    expect(shareLine({ instagram: ['infographics'], linkedin: [], by: RAE })).toBe(
      'Shared to Instagram: @ofcourse_selfhelp · by Rae',
    )
  })

  it('names an account no longer listed by its id, so an old share still reads', () => {
    expect(shareLine({ instagram: ['retired'], linkedin: [], by: RAE })).toBe(
      'Shared to Instagram: retired · by Rae',
    )
  })
})

describe('the share record', () => {
  it('holds at least one account, and who shared (10, 11)', () => {
    expect(BODIES.share.safeParse({ instagram: ['main'], linkedin: [], by: RAE }).success).toBe(
      true,
    )
    expect(BODIES.share.safeParse({ instagram: [], linkedin: [], by: RAE }).success).toBe(false)
    expect(BODIES.share.safeParse({ instagram: ['main'], linkedin: [] }).success).toBe(false)
  })
})
