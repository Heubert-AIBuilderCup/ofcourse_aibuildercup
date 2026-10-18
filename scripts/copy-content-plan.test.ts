import { describe, expect, it } from 'bun:test'
import {
  assetCandidates,
  type CopyArgs,
  checkedUpdate,
  mappedUserColumns,
  maskUrl,
  parseArgs,
  remapJson,
  scrub,
  slugConflicts,
  stampUserIds,
  targetRefusal,
  withPresentBlogs,
} from './copy-content-plan'

const DEV = 'postgres://app:dev-secret@127.0.0.1:5433/app'
const PROD = 'postgres://ofcourse:prod-secret@127.0.0.1:5435/ofcourse'
const BASE = ['--from', DEV, '--to', PROD, '--as', 'nikhil@heubert.com']

const parsed = (argv: string[]): CopyArgs => {
  const result = parseArgs(argv)
  if (!result.ok) throw new Error(result.errors.join('; '))
  return result.value
}
const errorsOf = (argv: string[]): string => {
  const result = parseArgs(argv)
  return result.ok ? '' : result.errors.join('; ')
}

describe('parseArgs', () => {
  it('takes posts as a comma list, trimmed and each once, and all live updates', () => {
    const args = parsed([...BASE, '--posts', ' p1, p2 ,p1,', '--updates', 'all-live'])
    expect(args.posts.join('|')).toBe('p1|p2')
    expect(args.updates).toEqual({ all: true })
    expect(args.dryRun).toBe(true)
    expect(args.yesRemote).toBe(false)
    expect(args.as).toBe('nikhil@heubert.com')
  })

  it('takes updates named by title or id, and the dry-run and remote flags', () => {
    const args = parsed([...BASE, '--updates', 'First title,u-2', '--dry-run', '--yes-remote'])
    expect(args.posts.length).toBe(0)
    expect(args.updates).toEqual({ all: false, names: ['First title', 'u-2'] })
    expect(args.dryRun).toBe(true)
    expect(args.yesRemote).toBe(true)
  })

  it('leaves --from to the environment when it is not given', () => {
    const args = parsed(['--to', PROD, '--as', 'a@b.c', '--posts', 'p1'])
    expect(args.from).toBe(null)
  })

  it('refuses a missing --to or --as, and a run that copies nothing', () => {
    expect(errorsOf(['--as', 'a@b.c', '--posts', 'p1'])).toContain('--to')
    expect(errorsOf(['--to', PROD, '--posts', 'p1'])).toContain('--as')
    expect(errorsOf([...BASE])).toContain('--posts')
    expect(errorsOf([...BASE, '--posts', ' , '])).toContain('--posts')
  })

  it('refuses an unknown flag, a stray word and a flag without its value', () => {
    expect(errorsOf([...BASE, '--posts', 'p1', '--force'])).toContain('--force')
    expect(errorsOf([...BASE, '--posts', 'p1', 'extra'])).toContain('extra')
    expect(errorsOf([...BASE, '--posts'])).toContain('--posts')
    expect(errorsOf([...BASE, '--posts', '--dry-run'])).toContain('--posts')
  })

  it('refuses a database URL that is not postgres, never echoing it', () => {
    const errors = errorsOf(['--from', 'mysql://u:hunter2@h/db', '--to', PROD, '--as', 'a@b.c'])
    expect(errors).toContain('--from')
    expect(errors).not.toContain('hunter2')
  })

  it('is a dry run unless --write is passed', () => {
    expect(parsed([...BASE, '--posts', 'p1']).dryRun).toBe(true)
    expect(parsed([...BASE, '--posts', 'p1', '--dry-run']).dryRun).toBe(true)
    expect(parsed([...BASE, '--posts', 'p1', '--write', '--target', 'ofcourse']).dryRun).toBe(false)
    expect(
      errorsOf([...BASE, '--posts', 'p1', '--write', '--dry-run', '--target', 'ofcourse']),
    ).toContain('--write')
  })

  it('writes only to the database --target names, the --to URL’s own, never echoing the URL', () => {
    const write = [...BASE, '--posts', 'p1', '--write']
    expect(errorsOf(write)).toContain('--target')
    const wrong = errorsOf([...write, '--target', 'app'])
    expect(wrong).toContain('--target')
    expect(wrong).not.toContain('prod-secret')
    expect(errorsOf([...write, '--target', 'ofcourse'])).toBe('')
    // A dry run writes nothing for good, but a --target given is still checked.
    expect(errorsOf([...BASE, '--posts', 'p1', '--target', 'app'])).toContain('--target')
    expect(errorsOf([...BASE, '--posts', 'p1'])).toBe('')
  })

  it('refuses copying a database onto itself', () => {
    expect(errorsOf(['--from', PROD, '--to', PROD, '--as', 'a@b.c', '--posts', 'p'])).toContain(
      'same database',
    )
  })
})

describe('targetRefusal', () => {
  it('lets a local target through, by name or address', () => {
    expect(targetRefusal(PROD, false)).toBe(null)
    expect(targetRefusal('postgres://u:p@localhost:5432/x', false)).toBe(null)
  })

  it('refuses a remote target unless --yes-remote is passed, naming only its host', () => {
    const refusal = targetRefusal('postgres://u:secret@db.example.com:5432/x', false)
    expect(refusal).toContain('db.example.com')
    expect(refusal).not.toContain('secret')
    expect(targetRefusal('postgres://u:secret@db.example.com:5432/x', true)).toBe(null)
  })
})

describe('maskUrl and scrub', () => {
  it('shows host, port and database, never the user or password', () => {
    expect(maskUrl(PROD)).toBe('127.0.0.1:5435/ofcourse')
  })

  it('removes every secret of the URLs from a message', () => {
    const message = `connect failed for ${PROD} (password prod-secret)`
    const clean = scrub(message, [DEV, PROD])
    expect(clean).not.toContain('prod-secret')
    expect(clean).not.toContain('ofcourse:')
    expect(clean).toContain('connect failed')
  })
})

describe('assetCandidates', () => {
  it('finds every short string at any depth, each once, and no key and no number', () => {
    const body = {
      slides: [{ pngAssetId: 'a_1', svgAssetId: 'a_2' }, { pngAssetId: 'a_1' }],
      art: { 'a_key-not-value': 3, nested: [['a_3']] },
      text: 'x'.repeat(500),
    }
    expect(assetCandidates(body).sort().join(',')).toBe('a_1,a_2,a_3')
  })
})

const SRC_A = 'srcUserA'
const SRC_B = 'srcUserB'
const TARGET = { id: 'targetUser', name: 'Nikhil' }

describe('stampUserIds', () => {
  it('finds the user id of every stamp, at any depth', () => {
    const body = { by: { userId: SRC_A, name: 'A', at: 'x' }, list: [{ userId: SRC_B }] }
    expect(stampUserIds(body).sort().join(',')).toBe(`${SRC_A},${SRC_B}`)
  })
})

describe('remapJson', () => {
  const map = new Map([
    [SRC_A, TARGET],
    [SRC_B, TARGET],
  ])

  it('replaces every source user id by the target, and a stamp names the target', () => {
    const body = {
      by: { userId: SRC_A, name: 'Someone Else', at: '2026-10-18T06:00:00.000Z' },
      reviewers: [SRC_B, 'keep-me'],
      note: 'not an id',
    }
    const out = remapJson(body, map) as typeof body
    expect(out.by.userId).toBe(TARGET.id)
    expect(out.by.name).toBe(TARGET.name)
    expect(out.by.at).toBe('2026-10-18T06:00:00.000Z')
    expect(out.reviewers.join(',')).toBe(`${TARGET.id},keep-me`)
    expect(out.note).toBe('not an id')
  })

  it('leaves the name of an object that is not a mapped user alone, and never mutates', () => {
    const body = { userId: 'unknown', name: 'Keep' }
    const out = remapJson(body, map) as typeof body
    expect(out.name).toBe('Keep')
    expect(body.userId).toBe('unknown')
    const stamped = { by: { userId: SRC_A, name: 'A' } }
    remapJson(stamped, map)
    expect(stamped.by.userId).toBe(SRC_A)
  })
})

describe('mappedUserColumns', () => {
  const map = new Map([[SRC_A, TARGET]])

  it('maps every named user column, keeping a null as null', () => {
    const row = { id: 'p1', createdByUserId: SRC_A, assigneeUserId: null, title: SRC_A }
    const result = mappedUserColumns(row, ['createdByUserId', 'assigneeUserId'], map)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.row.createdByUserId).toBe(TARGET.id)
    expect(result.row.assigneeUserId).toBe(null)
    expect(result.row.title).toBe(SRC_A)
  })

  it('refuses a user id it cannot map, naming the column', () => {
    const row = { id: 'p1', createdByUserId: 'ghost' }
    const result = mappedUserColumns(row, ['createdByUserId'], map)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toContain('createdByUserId')
  })
})

describe('slugConflicts', () => {
  it('names each slug another post holds in the target', () => {
    const writing = [
      { id: 'p1', slug: 'taken' },
      { id: 'p2', slug: 'free' },
      { id: 'p3', slug: null },
    ]
    const conflicts = slugConflicts(writing, [{ id: 'other', slug: 'taken' }])
    expect(conflicts.length).toBe(1)
    expect(conflicts[0]).toContain('taken')
    expect(conflicts[0]).toContain('p1')
    expect(conflicts[0]).toContain('other')
  })

  it('refuses two posts of the copy sharing a slug', () => {
    const writing = [
      { id: 'p1', slug: 'same' },
      { id: 'p2', slug: 'same' },
    ]
    expect(slugConflicts(writing, []).length).toBe(1)
  })
})

describe('withPresentBlogs', () => {
  it('keeps a blog link the target will have and unlinks one it will not, reporting it', () => {
    const posts = [
      { id: 'p1', blogId: 'b-copied' },
      { id: 'p2', blogId: 'b-missing' },
      { id: 'p3', blogId: null },
    ]
    const { rows, unlinked } = withPresentBlogs(posts, new Set(['b-copied']))
    expect(rows.map((r) => r.blogId).join(',')).toBe('b-copied,,')
    expect(unlinked.length).toBe(1)
    expect(unlinked[0]).toContain('p2')
    expect(unlinked[0]).toContain('b-missing')
  })
})

describe('checkedUpdate', () => {
  const row = {
    id: 'u-1',
    kind: 'opportunity',
    category: 'Scholarship',
    institution: 'ECU',
    title: '  ECU scholarship (mock)  ',
    body: '20% off tuition (mock).',
    applyBy: '2026-11-30',
    sourceTitle: 'ECU scholarships page (mock)',
    sourceCheckedAt: '2026-10-01',
    audience: { institution: 'ECU', homeCountry: null },
    status: 'live',
    createdByUserId: 'u',
  }

  it('passes an update the form would take, as the form keeps it, its other columns as they are', () => {
    const checked = checkedUpdate(row)
    if (!checked.ok) throw new Error(checked.error)
    expect(checked.row.title).toBe('ECU scholarship (mock)')
    expect(checked.row.audience.topic).toBe('All topics')
    expect(`${checked.row.id} ${checked.row.status} ${checked.row.createdByUserId}`).toBe(
      'u-1 live u',
    )
  })

  it('refuses one the form would refuse, naming the update', () => {
    const checked = checkedUpdate({ ...row, kind: 'gossip' })
    expect(checked.ok ? '' : checked.error).toContain('u-1')
    expect(checkedUpdate({ ...row, body: 'x'.repeat(601) }).ok).toBe(false)
  })
})
