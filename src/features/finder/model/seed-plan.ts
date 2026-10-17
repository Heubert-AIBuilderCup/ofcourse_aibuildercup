// What a finder seed must do (scripts/finder-seed.ts): embed the courses that are new, whose text
// changed or that another model embedded; keep the rest; remove stored rows the catalogue dropped.
// Pure: no database, no model.

export type SeedPlan = { embed: string[]; keep: string[]; remove: string[] }

export function seedPlan(
  catalogue: readonly { id: string; textHash: string }[],
  stored: readonly { id: string; textHash: string; embeddingModel: string }[],
  model: string,
): SeedPlan {
  const byId = new Map(stored.map((row) => [row.id, row]))
  const embed: string[] = []
  const keep: string[] = []
  for (const course of catalogue) {
    const row = byId.get(course.id)
    if (row && row.textHash === course.textHash && row.embeddingModel === model)
      keep.push(course.id)
    else embed.push(course.id)
  }
  const inCatalogue = new Set(catalogue.map((course) => course.id))
  const remove = stored.filter((row) => !inCatalogue.has(row.id)).map((row) => row.id)
  return { embed, keep, remove }
}
