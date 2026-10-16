import { afterEach, describe, expect, it } from 'bun:test'
import { z } from 'zod'
import { DEMO_SOURCES } from '../demo-sources'
import { demoKeyFor, onLiveResult, readReplay, withReplay } from './replays'
import { REPLAYS } from './replays/index'

const paidWork = DEMO_SOURCES.find((s) => s.key === 'paid-work')
const twin = DEMO_SOURCES.find((s) => s.key === 'paid-work-twin')
if (!paidWork || !twin) throw new Error('demo sources missing')

const FAKE = { AI_PROVIDER: 'fake' }
const VERTEX = { AI_PROVIDER: 'vertex' }

describe('demoKeyFor', () => {
  it('knows both demo sources by title and text', () => {
    expect(demoKeyFor(paidWork.title, paidWork.text, VERTEX)).toBe('paid-work')
    expect(demoKeyFor(twin.title, twin.text, VERTEX)).toBe('paid-work-twin')
  })

  it('has five paragraphs in the paid-work source and the twin differs only in the title and the third', () => {
    const a = paidWork.text.split('\n\n')
    const b = twin.text.split('\n\n')
    expect(a).toHaveLength(5)
    expect(b.filter((p, i) => p !== a[i])).toEqual([
      'Above 20 hours a week, pass rates fell by 9 percentage points. The drop was largest in the first year of study.',
    ])
    expect(twin.title).not.toBe(paidWork.title)
  })

  it('ignores Windows line endings and trailing spaces', () => {
    const text = paidWork.text
      .split('\n\n')
      .map((p) => `${p}   `)
      .join('  \r\n\r\n')
    expect(demoKeyFor(`${paidWork.title} `, text, VERTEX)).toBe('paid-work')
  })

  it('is null when one word changes, in the text or in the title', () => {
    expect(
      demoKeyFor(paidWork.title, paidWork.text.replace('11 percentage', '12 percentage'), VERTEX),
    ).toBeNull()
    expect(
      demoKeyFor(paidWork.title, paidWork.text.replace('similar', 'identical'), VERTEX),
    ).toBeNull()
    expect(demoKeyFor('Hours of paid work and later results', paidWork.text, VERTEX)).toBeNull()
  })

  it('is null for an added or a missing paragraph', () => {
    expect(demoKeyFor(paidWork.title, `${paidWork.text}\n\nOne more thing.`, VERTEX)).toBeNull()
    expect(
      demoKeyFor(paidWork.title, paidWork.text.split('\n\n').slice(0, 4).join('\n\n'), VERTEX),
    ).toBeNull()
  })

  it('removes [fake:...] markers only when the provider is fake', () => {
    const marked = `${paidWork.text} [fake:fail-extract]`
    expect(demoKeyFor(paidWork.title, marked, FAKE)).toBe('paid-work')
    expect(demoKeyFor(paidWork.title, marked, VERTEX)).toBeNull()
    expect(demoKeyFor(paidWork.title, marked, {})).toBeNull()
  })
})

const schema = z.object({ n: z.number() })
const failing = async () => ({ ok: false as const, error: 'down', reason: 'failed' as const })

afterEach(() => {
  delete REPLAYS['paid-work']
  onLiveResult(null)
})

describe('readReplay and withReplay', () => {
  it('reads a recording that fits the schema, and ignores one that does not', () => {
    REPLAYS['paid-work'] = { extract: { n: 3 }, draft: { n: 'x' } }
    expect(readReplay('paid-work', 'extract', schema)).toEqual({ n: 3 })
    expect(readReplay('paid-work', 'draft', schema)).toBeNull()
    expect(readReplay('paid-work', 'missing', schema)).toBeNull()
    expect(readReplay('nope', 'extract', schema)).toBeNull()
  })

  it('serves the recording, marked replay, when a live step fails on a demo source', async () => {
    REPLAYS['paid-work'] = { extract: { n: 3 } }
    expect(await withReplay('paid-work', 'extract', schema, failing)).toEqual({
      ok: true,
      value: { n: 3 },
      replay: true,
    })
  })

  it('returns the failure when there is no demo key', async () => {
    REPLAYS['paid-work'] = { extract: { n: 3 } }
    expect(await withReplay(null, 'extract', schema, failing)).toEqual({ ok: false, error: 'down' })
  })

  it('returns the failure when the recording fails its schema or is absent', async () => {
    REPLAYS['paid-work'] = { extract: { n: 'bad' } }
    expect(await withReplay('paid-work', 'extract', schema, failing)).toEqual({
      ok: false,
      error: 'down',
    })
    expect(await withReplay('paid-work', 'draft', schema, failing)).toEqual({
      ok: false,
      error: 'down',
    })
  })

  it('prefers the live value and marks it not a replay', async () => {
    REPLAYS['paid-work'] = { extract: { n: 3 } }
    const live = async () => ({ ok: true as const, value: { n: 9 }, cached: false })
    expect(await withReplay('paid-work', 'extract', schema, live)).toEqual({
      ok: true,
      value: { n: 9 },
      replay: false,
    })
  })
})

describe('onLiveResult', () => {
  const live = async () => ({ ok: true as const, value: { n: 9 }, cached: false })

  it('reports a live success on a demo key once, never for null, and never after it is cleared', async () => {
    const seen: unknown[][] = []
    onLiveResult((key, step, value) => seen.push([key, step, value]))
    await withReplay('paid-work', 'extract', schema, live)
    await withReplay(null, 'extract', schema, live)
    await withReplay('paid-work', 'extract', schema, failing)
    expect(seen).toEqual([['paid-work', 'extract', { n: 9 }]])
    onLiveResult(null)
    await withReplay('paid-work', 'extract', schema, live)
    expect(seen).toHaveLength(1)
  })
})
