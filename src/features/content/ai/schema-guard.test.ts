import { describe, expect, it } from 'bun:test'
import { z } from 'zod'
import { ALLOWED_KEYWORDS, toModelSchema } from './schema-guard'

function keywordsIn(node: unknown, out = new Set<string>()): Set<string> {
  if (Array.isArray(node)) for (const item of node) keywordsIn(item, out)
  else if (node !== null && typeof node === 'object') {
    for (const [key, value] of Object.entries(node)) {
      if (key === 'properties') {
        for (const child of Object.values(value as object)) keywordsIn(child, out)
      } else {
        out.add(key)
        keywordsIn(value, out)
      }
    }
  }
  return out
}

describe('toModelSchema', () => {
  it('passes objects, arrays, enums and nullables, using only allowed keywords', () => {
    const schema = z.object({
      title: z.string().describe('The headline'),
      tags: z.array(z.enum(['a', 'b'])).max(3),
      count: z.number().nullable(),
      nested: z.object({ ok: z.boolean() }).nullable(),
      items: z.array(z.object({ text: z.string(), ref: z.string().nullable() })),
    })
    const out = toModelSchema(schema)
    const allowed = new Set<string>(ALLOWED_KEYWORDS)
    for (const key of keywordsIn(out)) expect(allowed.has(key)).toBe(true)
    expect(out).toMatchObject({
      type: 'object',
      required: ['title', 'tags', 'count', 'nested', 'items'],
    })
  })

  it('strips $schema and a closed additionalProperties', () => {
    const out = toModelSchema(z.object({ a: z.string() })) as Record<string, unknown>
    expect(out.$schema).toBeUndefined()
    expect(out.additionalProperties).toBeUndefined()
  })

  it('refuses a record, naming the keyword', () => {
    expect(() => toModelSchema(z.record(z.string(), z.string()))).toThrow(
      /additionalProperties|propertyNames/,
    )
  })

  it('refuses a regex, naming pattern', () => {
    expect(() => toModelSchema(z.object({ a: z.string().regex(/x/) }))).toThrow(/pattern/)
  })

  it('refuses a string length limit, naming maxLength', () => {
    expect(() => toModelSchema(z.string().max(3))).toThrow(/maxLength/)
  })

  // gemini-3.8-flash answers 400 INVALID_ARGUMENT to maxItems on a list inside a list (the draft's
  // slides and slots, measured 9 Oct 2026); either alone is accepted. Code enforces the lengths.
  it('never sends list lengths to the model, while the zod schema still enforces them', () => {
    const schema = z.object({
      slides: z.array(z.object({ slots: z.array(z.string()).min(1).max(8) })).max(10),
    })
    const out = toModelSchema(schema)
    expect(keywordsIn(out).has('maxItems')).toBe(false)
    expect(keywordsIn(out).has('minItems')).toBe(false)
    const tooMany = { slides: Array.from({ length: 11 }, () => ({ slots: ['a'] })) }
    expect(schema.safeParse(tooMany).success).toBe(false)
  })
})
