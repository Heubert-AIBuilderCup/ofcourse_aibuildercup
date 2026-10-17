// What a tile is, in a word, and the icon printed on its top face (the reference's `lgKind` and
// `ICO`, board.js). Pure: the word and the icon come from the tile and the scene it is drawn in.

import type { Tile } from './road-data'
import type { Scene } from './scene'

/** An SVG circle as one path, as the reference's `circ`. */
const circ = (cx: number, cy: number, r: number) =>
  `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`

/** Each icon's path `d` strings on a 24×24 box, lucide-style strokes (the reference's `ICO`). */
export const ICONS = {
  you: ['M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2', circ(12, 7, 4)],
  flag: [
    'M4 22V4a1 1 0 0 1 .4-.8A6 6 0 0 1 8 2c3 0 5 2 7.333 2q2 0 3.067-.8A1 1 0 0 1 20 4v10a1 1 0 0 1-.4.8A6 6 0 0 1 16 16c-3 0-5-2-8-2a6 6 0 0 0-4 1.528',
  ],
  globe: [circ(12, 12, 10), 'M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20', 'M2 12h20'],
  city: [
    'M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z',
    'M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2',
    'M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2',
    'M10 6h4',
    'M10 10h4',
    'M10 14h4',
    'M10 18h4',
  ],
  course: [
    'M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z',
    'M22 10v6',
    'M6 12.5V16a6 3 0 0 0 12 0v-3.5',
  ],
  visa: [
    'M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z',
    'M14 2v4a2 2 0 0 0 2 2h4',
    'm9 15 2 2 4-4',
  ],
  study: [
    'M12 7v14',
    'M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z',
  ],
  work: [
    'M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16',
    'M4 6h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z',
  ],
  fork: ['M16 3h5v5', 'M8 3H3v5', 'M12 22v-8.3a4 4 0 0 0-1.172-2.872L3 3', 'm15 9 6-6'],
  more: ['M5 12h14', 'M12 5v14'],
} as const satisfies Record<string, readonly string[]>

export type IconName = keyof typeof ICONS

/** A tile's kind word (the small uppercase word over its name) and its icon. */
export type Kind = { word: string; icon: IconName }

/** The tiles her road runs through: walked, next and ahead. */
const onRoad = (scene: Scene, id: string) =>
  scene.lit.includes(id) || scene.next.includes(id) || scene.ahead.includes(id)

/** What a tile is: off her road a city or a course is the "other" one. */
export function kindOf(t: Tile, scene: Scene): Kind {
  if (t.id === 'point-a') return { word: 'You', icon: 'you' }
  if (t.kind === 'point') return { word: 'Point B', icon: 'flag' }
  if (t.state === 'unknown') return { word: 'Not picked yet', icon: 'globe' }
  if (t.kind === 'junction') return { word: 'Fork', icon: 'fork' }
  if (t.kind === 'stack') return { word: 'Not looked at', icon: 'more' }
  if (t.kind === 'job') return { word: 'Job', icon: 'work' }
  const other = t.state === 'alt' && !onRoad(scene, t.id)
  if (t.kind === 'place') {
    // A place before her cities is the country she picked.
    if (!scene.cityLine.includes(t.id)) return { word: 'Country', icon: 'globe' }
    return { word: other ? 'Other city' : 'City', icon: 'city' }
  }
  if (t.kind === 'course') return { word: other ? 'Other course' : 'Course', icon: 'course' }
  if (t.id === scene.courseStep) return { word: 'Study', icon: 'study' }
  if (t.id === 'graduate-visa-485') return { word: 'Work visa', icon: 'work' }
  return { word: 'Visa', icon: 'visa' }
}
