// Model-facing schemas stay simple: objects, arrays, strings, numbers, booleans, enums and
// nullables. Lengths, patterns and records are enforced by code on the answer, never asked of the
// model, so a keyword Gemini might not honour cannot reach it.

import { z } from 'zod'

export const ALLOWED_KEYWORDS = [
  'type',
  'properties',
  'required',
  'items',
  'enum',
  'description',
  'anyOf',
] as const

const allowed = new Set<string>(ALLOWED_KEYWORDS)
// List lengths are allowed in a schema but left out of what the model sees: gemini-3.8-flash
// refuses maxItems on a list inside a list (400 INVALID_ARGUMENT), and code checks every answer
// against the full zod schema, lengths included, then retries with the problems.
const DROPPED = new Set(['minItems', 'maxItems'])

function clean(node: unknown, path: string): unknown {
  if (Array.isArray(node)) return node.map((item, i) => clean(item, `${path}[${i}]`))
  if (node === null || typeof node !== 'object') return node
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(node)) {
    if (key === '$schema' || DROPPED.has(key)) continue
    // A closed object is the default for the model; an open one (a record) is refused below.
    if (key === 'additionalProperties' && value === false) continue
    if (!allowed.has(key)) {
      throw new Error(`Model schema uses "${key}" at ${path || '(root)'}, outside the allowlist`)
    }
    if (key === 'properties') {
      const props: Record<string, unknown> = {}
      for (const [name, child] of Object.entries(value as Record<string, unknown>)) {
        props[name] = clean(child, `${path}.${name}`)
      }
      out[key] = props
    } else if (key === 'items' || key === 'anyOf') {
      out[key] = clean(value, `${path}.${key}`)
    } else {
      out[key] = value
    }
  }
  return out
}

/** z.toJSONSchema, minus $schema and additionalProperties; throws naming any keyword outside the allowlist. */
export function toModelSchema(schema: z.ZodType): object {
  return clean(z.toJSONSchema(schema), '') as object
}
