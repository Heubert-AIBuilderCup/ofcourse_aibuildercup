/**
 * A read kept in this process for `ttlMs`: `fresh` always reads and keeps what it read, `recent`
 * returns what was read less than `ttlMs` before `now`, else reads afresh. Each server instance
 * keeps its own copy, so what is kept must be the same for every caller.
 */
export function keptFor<T>(ttlMs: number, read: (now: Date) => Promise<T>) {
  let kept: { at: number; value: T } | null = null
  const fresh = async (now: Date): Promise<T> => {
    const value = await read(now)
    kept = { at: now.getTime(), value }
    return value
  }
  const recent = (now: Date): Promise<T> =>
    kept && now.getTime() - kept.at < ttlMs ? Promise.resolve(kept.value) : fresh(now)
  return { fresh, recent }
}
