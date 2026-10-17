// Near-duplicate courses in the sample catalogue: two whose embedded texts sit closer than the
// threshold say the same thing, so only the first is kept. Pure.

export type Dropped = { id: string; keptId: string; similarity: number }

function cosine(a: readonly number[], b: readonly number[]): number {
  let dot = 0
  let aa = 0
  let bb = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    aa += a[i] * a[i]
    bb += b[i] * b[i]
  }
  return aa === 0 || bb === 0 ? 0 : dot / Math.sqrt(aa * bb)
}

/**
 * Walks the ids in order and keeps each one unless a course already kept is more similar than
 * `threshold`; a dropped id names the kept course it duplicates.
 */
export function dropNearDuplicates(
  ids: readonly string[],
  vectors: readonly (readonly number[])[],
  threshold: number,
): { kept: string[]; dropped: Dropped[] } {
  const kept: number[] = []
  const dropped: Dropped[] = []
  for (let i = 0; i < ids.length; i++) {
    let nearest = -1
    let best = -1
    for (const k of kept) {
      const similarity = cosine(vectors[i], vectors[k])
      if (similarity > best) {
        best = similarity
        nearest = k
      }
    }
    if (nearest >= 0 && best > threshold)
      dropped.push({ id: ids[i], keptId: ids[nearest], similarity: best })
    else kept.push(i)
  }
  return { kept: kept.map((k) => ids[k]), dropped }
}
