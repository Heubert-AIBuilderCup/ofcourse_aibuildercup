// The phone's Road view: the road as an ordered list, top to bottom (spec §3, the reference's
// rb-road). Each step's date leads its kicker, so the road needs no date column; where she is, the
// row is her card; the two ways to PR end it side by side. Pure: rows from the road and its scene.

import { kindOf } from './kinds'
import { siblingsOf } from './press'
import type { Road, Tile } from './road-data'
import type { Scene } from './scene'

/** A step row's light: visited, next, dark (unexplored or not visited) or looked at. */
export type RowState = 'lit' | 'next' | 'fog' | 'seen'

/** A tile offered under a row: "Also: Adelaide · 17 more cities". */
export type RowAlt = { id: string; name: string }

/** One way to PR at the fork: its first step, and where it ends. */
export type Way = {
  id: string
  kicker: string
  name: string
  line: string
  end: string
  /** The thinner road off the trunk: drawn dashed. */
  thin: boolean
}

type Shown = {
  /** The tiles the row shows, its own first: a deep link to any of them scrolls to the row. */
  tiles: string[]
}

export type PhoneRow =
  | (Shown & { kind: 'here'; id: string })
  | (Shown & {
      kind: 'step'
      id: string
      state: RowState
      kicker: string
      name: string
      line: string
      alts: RowAlt[]
      /** The lesson the row offers, until it is read. */
      lesson?: string
      /** The one-time hint stands under it. */
      hint: boolean
    })
  | (Shown & { kind: 'fork'; id: 'fork'; kicker: string; ways: Way[] })

const rowState = (t: Tile): RowState =>
  t.state === 'seen'
    ? 'seen'
    : t.state === 'lit'
      ? 'lit'
      : t.state === 'next' || t.state === 'unknown'
        ? 'next'
        : 'fog'

const STATE_LEAD: Partial<Record<RowState, string>> = { next: 'Next', seen: 'Looked at' }

/** "Late 2026 · Next · Visa": the date, the state (next, looked at), then the kind word. */
function kickerOf(t: Tile, scene: Scene, state: RowState): string {
  const city = t.kind === 'place' && scene.cityLine.includes(t.id)
  const kind = kindOf(t, scene).word
  // Where she starts and the country she picked carry no state.
  const lead = t.kind === 'point' || (t.kind === 'place' && !city) ? undefined : STATE_LEAD[state]
  return [t.when, lead, kind].filter(Boolean).join(' · ')
}

/** A row's line: a place's own words, a step's guide. */
const lineOf = (road: Road, t: Tile) =>
  (t.kind === 'place' || t.kind === 'point' ? t.sub : (road.cards[t.id]?.guide ?? t.sub)) ?? ''

/** A level opens under the tile that heads it, once she has reached it or it is next. */
function altsOf(scene: Scene, t: Tile, state: RowState): RowAlt[] {
  if (state !== 'lit' && state !== 'next') return []
  const line = [scene.cityLine, scene.courseLine].find((l) => l[0] === t.id) ?? []
  return line
    .slice(1)
    .map((id) => scene.tiles.find((x) => x.id === id))
    .filter((x): x is Tile => !!x)
    .map((x) => ({ id: x.id, name: x.name }))
}

/** A span's first and last year: "2031 – 2034" starts 2031 and ends 2034. */
const startOf = (t: Tile | undefined) => t?.when?.split(' – ')[0]
const endOf = (t: Tile | undefined) => t?.when?.split(' – ').at(-1)

function way(road: Road, steps: Tile[], thin: boolean): Way {
  const first = steps[0]
  const last = steps[steps.length - 1]
  return {
    id: first.id,
    kicker: `${startOf(first)} → ${endOf(last)}`,
    name: first.name,
    line: road.cards[first.id]?.guide ?? '',
    end: last.kicker ? `${last.name} · ${last.kicker}` : last.name,
    thin,
  }
}

/** The ways to PR after the last row, from the junction: the trunk's steps, then the branch's. */
function forkOf(road: Road, scene: Scene): PhoneRow | null {
  if (!scene.fork) return null
  const after = scene.ahead
    .filter((id) => !scene.rows.includes(id))
    .map((id) => scene.tiles.find((t) => t.id === id))
    .filter((t): t is Tile => !!t)
  const junction = after.find((t) => t.kind === 'junction')
  const trunk = after.filter((t) => t !== junction)
  const branch = scene.tiles.filter((t) => t.branch)
  const lines = [trunk, branch].filter((l) => l.length > 0)
  if (lines.length === 0) return null
  const ways = lines.map((l, i) => way(road, l, i > 0))
  const from = startOf(lines[0][0])
  const to = endOf(lines[lines.length - 1].at(-1))
  const word = junction ? kindOf(junction, scene).word : undefined
  return {
    kind: 'fork',
    id: 'fork',
    kicker: [`${from} – ${to}`, word, `${ways.length} ways to PR`].filter(Boolean).join(' · '),
    ways,
    tiles: [...(junction ? [junction] : []), ...lines.flat()].map((t) => t.id),
  }
}

/** The Road view's rows, top to bottom. */
export function phoneRows(road: Road, scene: Scene): PhoneRow[] {
  const rows = scene.rows.flatMap((id): PhoneRow[] => {
    const t = scene.tiles.find((x) => x.id === id)
    if (!t) return []
    if (id === scene.here)
      return [{ kind: 'here', id, tiles: [id, ...siblingsOf(scene).map((s) => s.id)] }]
    const state = rowState(t)
    const alts = altsOf(scene, t, state)
    const lesson = state === 'seen' ? undefined : road.cards[id]?.lesson
    return [
      {
        kind: 'step',
        id,
        state,
        kicker: kickerOf(t, scene, state),
        name: t.name,
        line: lineOf(road, t),
        alts,
        ...(lesson ? { lesson } : {}),
        hint: scene.hint === id,
        tiles: [id, ...alts.map((a) => a.id)],
      },
    ]
  })
  const fork = forkOf(road, scene)
  return fork ? [...rows, fork] : rows
}

/** The row that shows a tile, if any. */
export const rowFor = (rows: PhoneRow[], tileId: string) =>
  rows.find((r) => r.tiles.includes(tileId))
