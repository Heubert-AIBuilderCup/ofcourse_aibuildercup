// Exact-match demo replays. Pure: no server-only, no database.

import type { z } from 'zod'
import { DEMO_SOURCES } from '../demo-sources'
import type { AiResult } from './client'
import { REPLAYS } from './replays/index'

const FAKE_MARKER = /\[fake:[^\]]*\]/g

function paragraphs(text: string): string[] {
  return text
    .replace(/\r\n?/g, '\n')
    .split(/\n[^\S\n]*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
}

function sameParagraphs(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((p, i) => p === b[i])
}

/**
 * The demo source this paste is, or null. Exact: the title and every paragraph must equal the demo
 * source's after trimming each paragraph and unifying line endings; any changed word means null.
 * Only when AI_PROVIDER is 'fake' are `[fake:…]` test markers removed first.
 */
export function demoKeyFor(
  title: string,
  text: string,
  env: Record<string, string | undefined> = process.env,
): string | null {
  const strip = env.AI_PROVIDER === 'fake'
  const clean = (s: string) => (strip ? s.replace(FAKE_MARKER, '') : s)
  const pasteTitle = clean(title).trim()
  const pasteParagraphs = paragraphs(clean(text))
  for (const source of DEMO_SOURCES) {
    if (pasteTitle === source.title && sameParagraphs(pasteParagraphs, paragraphs(source.text))) {
      return source.key
    }
  }
  return null
}

export function readReplay<S extends z.ZodType>(
  demoKey: string,
  step: string,
  schema: S,
): z.infer<S> | null {
  const recording = REPLAYS[demoKey]?.[step]
  if (recording === undefined) return null
  const parsed = schema.safeParse(recording)
  return parsed.success ? parsed.data : null
}

let listener: ((demoKey: string, step: string, value: unknown) => void) | null = null

/** While set, each live success on a demo source is reported (the recorder, Task 21). */
export function onLiveResult(
  fn: ((demoKey: string, step: string, value: unknown) => void) | null,
): void {
  listener = fn
}

/** Live first. On a demo source only, a failed live step serves the recording, marked replay. */
export async function withReplay<T>(
  demoKey: string | null,
  step: string,
  schema: z.ZodType<T>,
  run: () => Promise<AiResult<T>>,
): Promise<{ ok: true; value: T; replay: boolean } | { ok: false; error: string }> {
  const live = await run()
  if (live.ok) {
    if (demoKey !== null) listener?.(demoKey, step, live.value)
    return { ok: true, value: live.value, replay: false }
  }
  if (demoKey !== null) {
    const recorded = readReplay(demoKey, step, schema)
    if (recorded !== null) return { ok: true, value: recorded, replay: true }
  }
  return { ok: false, error: live.error }
}
