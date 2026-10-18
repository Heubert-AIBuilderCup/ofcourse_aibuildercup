// The pure parts of scripts/copy-content.ts: its arguments read and checked, the target refused
// when remote, URLs masked, the asset ids and user ids found in a record's JSON, the user ids
// remapped to the target's account, and the checks run before anything is written. No database:
// the script does the rest.

/** What a run copies, read from its arguments. `from` null: the DATABASE_URL Bun loaded. */
export type CopyArgs = {
  from: string | null
  to: string
  as: string
  posts: string[]
  updates: { all: true } | { all: false; names: string[] } | null
  dryRun: boolean
  yesRemote: boolean
}

const VALUED = ['--from', '--to', '--as', '--posts', '--updates'] as const
const FLAGS = ['--dry-run', '--yes-remote'] as const
const LOCAL_HOSTS = ['127.0.0.1', 'localhost', '::1', '[::1]']
/** Longer strings are text, never an id: the asset lookup leaves them out. */
const ID_MAX = 128

const commaList = (value: string): string[] => [
  ...new Set(
    value
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean),
  ),
]

const postgresUrl = (value: string): URL | null => {
  try {
    const url = new URL(value)
    return url.protocol === 'postgres:' || url.protocol === 'postgresql:' ? url : null
  } catch {
    return null
  }
}

/** The database a URL names, as host:port/name: never its user or password. */
export function maskUrl(value: string): string {
  const url = postgresUrl(value)
  if (!url) return '(not a postgres URL)'
  return `${url.hostname}:${url.port || '5432'}${url.pathname}`
}

const sameDatabase = (a: string, b: string): boolean => maskUrl(a) === maskUrl(b)

/** The arguments read and checked; every problem named, never a URL echoed. */
export function parseArgs(
  argv: readonly string[],
): { ok: true; value: CopyArgs } | { ok: false; errors: string[] } {
  const errors: string[] = []
  const values = new Map<string, string>()
  const flags = new Set<string>()
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if ((VALUED as readonly string[]).includes(arg)) {
      const value = argv[i + 1]
      if (value === undefined || value.startsWith('--')) errors.push(`${arg} needs a value.`)
      else {
        values.set(arg, value)
        i++
      }
    } else if ((FLAGS as readonly string[]).includes(arg)) flags.add(arg)
    else errors.push(`Unknown argument: ${arg.startsWith('--') ? arg : JSON.stringify(arg)}.`)
  }

  const from = values.get('--from') ?? null
  const to = values.get('--to')
  const as = values.get('--as')?.trim()
  if (from !== null && !postgresUrl(from)) errors.push('--from is not a postgres:// URL.')
  if (to === undefined) errors.push('--to is required.')
  else if (!postgresUrl(to)) errors.push('--to is not a postgres:// URL.')
  if (!as) errors.push('--as (the target account’s email) is required.')
  if (from && to && postgresUrl(from) && postgresUrl(to) && sameDatabase(from, to))
    errors.push('--from and --to name the same database.')

  const posts = commaList(values.get('--posts') ?? '')
  const updatesArg = values.get('--updates')
  const names = updatesArg === undefined ? [] : commaList(updatesArg)
  const updates: CopyArgs['updates'] =
    updatesArg === undefined || names.length === 0
      ? null
      : names.length === 1 && names[0] === 'all-live'
        ? { all: true }
        : { all: false, names }
  if (posts.length === 0 && updates === null && !errors.some((e) => e.startsWith('--posts')))
    errors.push('Nothing to copy: give --posts <id,…>, --updates <all-live|title,…> or both.')

  if (errors.length > 0 || !to || !as) return { ok: false, errors }
  return {
    ok: true,
    value: {
      from,
      to,
      as,
      posts,
      updates,
      dryRun: flags.has('--dry-run'),
      yesRemote: flags.has('--yes-remote'),
    },
  }
}

/** Why the target is refused (not this machine, and no --yes-remote), or null. */
export function targetRefusal(to: string, yesRemote: boolean): string | null {
  const url = postgresUrl(to)
  if (!url) return '--to is not a postgres:// URL.'
  if (LOCAL_HOSTS.includes(url.hostname) || yesRemote) return null
  return `Refusing ${url.hostname}: not 127.0.0.1 or localhost (pass --yes-remote to mean it).`
}

/** A message with every credential of these URLs taken out, and each URL shown masked. */
export function scrub(message: string, urls: readonly string[]): string {
  let out = message
  for (const value of urls) {
    const url = postgresUrl(value)
    if (!url) continue
    out = out.split(value).join(maskUrl(value))
    for (const part of [url.password, decodeURIComponent(url.password)]) {
      if (part) out = out.split(part).join('***')
    }
    if (url.username) out = out.split(`${url.username}:`).join('***:')
  }
  return out
}

/** Every value in a JSON tree, depth first. */
function* leaves(value: unknown): Generator<unknown> {
  if (Array.isArray(value)) for (const item of value) yield* leaves(item)
  else if (value !== null && typeof value === 'object')
    for (const item of Object.values(value)) yield* leaves(item)
  else yield value
}

/** The strings of a record's JSON short enough to be an asset id, each once (keys are not values). */
export function assetCandidates(value: unknown): string[] {
  const found = new Set<string>()
  for (const leaf of leaves(value))
    if (typeof leaf === 'string' && leaf.length <= ID_MAX) found.add(leaf)
  return [...found]
}

/** Every object in a JSON tree, depth first. */
function* objects(value: unknown): Generator<Record<string, unknown>> {
  if (Array.isArray(value)) for (const item of value) yield* objects(item)
  else if (value !== null && typeof value === 'object') {
    yield value as Record<string, unknown>
    for (const item of Object.values(value)) yield* objects(item)
  }
}

/** The user id of every stamp (`{ userId, name, at }`) in a record's JSON. */
export function stampUserIds(value: unknown): string[] {
  const found = new Set<string>()
  for (const o of objects(value)) if (typeof o.userId === 'string') found.add(o.userId)
  return [...found]
}

/** Source user id to the target's account. */
export type UserMap = ReadonlyMap<string, { id: string; name: string }>

/**
 * A copy of a record's JSON with every string that is a mapped source user id replaced by the
 * target's id, and a stamp whose userId is mapped naming the target. The input is left as it is.
 */
export function remapJson(value: unknown, map: UserMap): unknown {
  if (typeof value === 'string') return map.get(value)?.id ?? value
  if (Array.isArray(value)) return value.map((item) => remapJson(item, map))
  if (value === null || typeof value !== 'object') return value
  const source = value as Record<string, unknown>
  const out: Record<string, unknown> = {}
  for (const [key, item] of Object.entries(source)) out[key] = remapJson(item, map)
  const target = typeof source.userId === 'string' ? map.get(source.userId) : undefined
  if (target && typeof source.name === 'string') out.name = target.name
  return out
}

/** A row with its user columns mapped to the target; a non-null id the map lacks is refused. */
export function mappedUserColumns<R extends Record<string, unknown>>(
  row: R,
  columns: readonly (keyof R & string)[],
  map: UserMap,
): { ok: true; row: R } | { ok: false; error: string } {
  const out: Record<string, unknown> = { ...row }
  for (const column of columns) {
    const value = row[column]
    if (value === null || value === undefined) continue
    const target = typeof value === 'string' ? map.get(value) : undefined
    if (!target) return { ok: false, error: `${column} names a user the copy cannot map.` }
    out[column] = target.id
  }
  return { ok: true, row: out as R }
}

type Slugged = { id: string; slug: string | null }

/** Each slug of the copy another post already holds in the target, or two posts of the copy share. */
export function slugConflicts(writing: readonly Slugged[], taken: readonly Slugged[]): string[] {
  const conflicts: string[] = []
  const holder = new Map(taken.flatMap((t) => (t.slug ? [[t.slug, t.id] as const] : [])))
  for (const post of writing) {
    if (!post.slug) continue
    const other = holder.get(post.slug)
    if (other !== undefined && other !== post.id)
      conflicts.push(`Slug "${post.slug}" of post ${post.id} is held by post ${other}.`)
    else holder.set(post.slug, post.id)
  }
  return conflicts
}

/**
 * Posts with a blog link the target will not have (its blog neither copied nor already there)
 * unlinked, so the foreign key holds; each unlinking named. A blog shows on the feed only while it
 * is live, so this changes what a reader sees only when the blog left behind is live.
 */
export function withPresentBlogs<P extends { id: string; blogId: string | null }>(
  posts: readonly P[],
  present: ReadonlySet<string>,
): { rows: P[]; unlinked: string[] } {
  const unlinked: string[] = []
  const rows = posts.map((p) => {
    if (p.blogId === null || present.has(p.blogId)) return p
    unlinked.push(`Post ${p.id} unlinked from blog ${p.blogId}, which the target will not have.`)
    return { ...p, blogId: null }
  })
  return { rows, unlinked }
}
