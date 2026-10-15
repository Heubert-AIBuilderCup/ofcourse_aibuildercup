// Canonical JSON and content hashes. No `server-only`: nothing secret here, and no client
// component imports it.

import { createHash } from 'node:crypto'
import type { ArtifactKind } from '../model/artifacts'

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys)
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const key of Object.keys(value).sort()) {
      const item = (value as Record<string, unknown>)[key]
      if (item !== undefined) out[key] = sortKeys(item)
    }
    return out
  }
  return value
}

/** JSON with object keys sorted at every depth, no whitespace: the same value always gives the same text. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortKeys(value))
}

export function sha256Hex(data: string | Uint8Array): string {
  return createHash('sha256').update(data).digest('hex')
}

/** "<kind>_<first 32 hex of sha256(canonicalJson({ kind, postId, body }))>" */
export function artifactId(kind: ArtifactKind, postId: string, body: unknown): string {
  return `${kind}_${sha256Hex(canonicalJson({ kind, postId, body })).slice(0, 32)}`
}

/** "a_<first 32 hex of sha256(bytes)>": identical bytes are one asset. */
export function assetId(bytes: Uint8Array): string {
  return `a_${sha256Hex(bytes).slice(0, 32)}`
}
