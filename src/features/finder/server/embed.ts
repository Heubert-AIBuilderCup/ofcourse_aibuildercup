// Text to vectors for the finder: Gemini embeddings on Vertex AI (ADR-115), or, under
// AI_PROVIDER=fake, a deterministic bag-of-words vector so tests and the fake dev mode need no model.
// The client authenticates with Application Default Credentials and is created on the first call,
// which warmUp makes at server start (src/instrumentation.ts) so a search does not wait for it.
// Nothing here logs the text (criterion 11).

import 'server-only'
import { GoogleGenAI } from '@google/genai'
import { aiConfig } from '@/features/content/ai/config'
import { sha256Hex } from '@/features/content/server/hash'
import { contentWords } from '../model/words'
import { finderOn } from '../switch'

export const EMBED_MODEL = 'gemini-embedding-001'
export const EMBED_DIMS = 768

export type EmbedTask = 'RETRIEVAL_DOCUMENT' | 'RETRIEVAL_QUERY'

type Env = Record<string, string | undefined>

/** Calls in flight at once: batching is not verified for this model, so one text per call. */
const CONCURRENCY = 4
/** Query vectors kept in memory; the oldest goes first when full. */
const CACHE_MAX = 500

/** FNV-1a, 32 bits: a word's slot in the fake vector. */
function fnv1a(word: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < word.length; i++) {
    hash ^= word.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash
}

function fakeVector(text: string): number[] {
  if (text.includes('[fake:fail-embed]')) throw new Error('The fake embedding failed on request')
  const vector = new Array<number>(EMBED_DIMS).fill(0)
  for (const word of contentWords(text)) vector[fnv1a(word) % EMBED_DIMS] += 1
  return vector
}

/** The model the vectors come from, as course_doc records it: 'fake' under the fake provider. */
export function embedModelName(env: Env = process.env): string {
  return aiConfig(env).provider === 'fake' ? 'fake' : env.GEMINI_EMBEDDING_MODEL || EMBED_MODEL
}

let client: GoogleGenAI | null = null

async function liveVector(text: string, task: EmbedTask, signal?: AbortSignal): Promise<number[]> {
  const config = aiConfig(process.env)
  client ??= new GoogleGenAI({
    vertexai: true,
    project: config.project ?? undefined,
    location: config.location,
  })
  const res = await client.models.embedContent({
    model: embedModelName(),
    contents: text,
    config: { taskType: task, outputDimensionality: EMBED_DIMS, abortSignal: signal },
  })
  const values = res.embeddings?.[0]?.values
  if (!values || values.length !== EMBED_DIMS)
    throw new Error(
      `The embedding model returned ${values?.length ?? 'no'} values, not ${EMBED_DIMS}`,
    )
  return values
}

/** The model said too many requests (429). */
const tooMany = (e: unknown) =>
  (e as { status?: unknown })?.status === 429 || /429|RESOURCE_EXHAUSTED/.test(String(e))

export type EmbedAllOptions = {
  /** Further attempts per text when the model says too many requests, each after a longer wait. */
  retries?: number
  /** Called as each text is embedded, with how many are done of how many. */
  onProgress?: (done: number, total: number) => void
  signal?: AbortSignal
}

/**
 * One vector per text, in order: one text per call, at most CONCURRENCY calls at a time, and on a
 * 429 up to `retries` more attempts (none by default), each after a longer wait.
 */
export async function embedAll(
  texts: readonly string[],
  task: EmbedTask,
  { retries = 0, onProgress, signal }: EmbedAllOptions = {},
): Promise<number[][]> {
  const fake = aiConfig(process.env).provider === 'fake'
  const embedOne = async (text: string): Promise<number[]> => {
    for (let attempt = 1; ; attempt++) {
      try {
        return fake ? fakeVector(text) : await liveVector(text, task, signal)
      } catch (e) {
        if (!tooMany(e) || attempt > retries) throw e
        const wait = 1000 * 2 ** attempt + Math.random() * 1000
        console.log(`429 · waiting ${Math.round(wait / 1000)}s (attempt ${attempt})`)
        await new Promise((resolve) => setTimeout(resolve, wait))
      }
    }
  }
  const vectors = new Array<number[]>(texts.length)
  let next = 0
  let done = 0
  const worker = async () => {
    while (next < texts.length) {
      const i = next++
      vectors[i] = await embedOne(texts[i])
      onProgress?.(++done, texts.length)
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, texts.length) }, worker))
  return vectors
}

/** One vector per text, in order, with no retry: a search cannot wait out a 429. */
export function embedTexts(
  texts: readonly string[],
  task: EmbedTask,
  signal?: AbortSignal,
): Promise<number[][]> {
  return embedAll(texts, task, { signal })
}

/** Query vectors by a hash of the student's id and her words: no text is kept as a key. */
const cache = new Map<string, number[]>()

/**
 * Her search text's vector, from the cache when she searched the same text before. Keyed per
 * student, so `cached` only ever reflects her own searches.
 */
export async function embedQuery(
  userId: string,
  text: string,
  signal?: AbortSignal,
): Promise<{ vector: number[]; cached: boolean }> {
  const said = text.trim()
  const key = sha256Hex(`${userId}\n${said}`)
  const hit = cache.get(key)
  if (hit) return { vector: hit, cached: true }
  const [vector] = await embedTexts([said], 'RETRIEVAL_QUERY', signal)
  if (cache.size >= CACHE_MAX) {
    const oldest = cache.keys().next().value
    if (oldest !== undefined) cache.delete(oldest)
  }
  cache.set(key, vector)
  return { vector, cached: false }
}

let warmed = false

/**
 * One embedding call at server start, not awaited, so the first search finds the client and its
 * credentials loaded. Once per process, and never under tests, the fake provider or with the
 * finder off. A failure is logged by its name only.
 */
export function warmUp(env: Env, embed: typeof embedTexts = embedTexts): void {
  if (warmed || env.NODE_ENV === 'test' || aiConfig(env).provider === 'fake' || !finderOn(env))
    return
  warmed = true
  embed(['warm up'], 'RETRIEVAL_QUERY').catch((err: unknown) => {
    console.error('[finder.warm-up]', err instanceof Error ? err.name : 'error')
  })
}
