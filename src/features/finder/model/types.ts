// The finder's shapes, defined once: the catalogue's extras beside each Course, a search's hits
// and its engine room, and a card's why. Client-safe: types only.

import type { FieldId, Level } from '@/features/engine/types'

/** What the finder knows about a catalogue course beyond the engine's Course row. */
export type FinderExtra = {
  courseId: string
  /** 2–4 sentences on what the course teaches: what is embedded and what a why may quote. */
  description: string
  /** Its field in the field graph (FIELDS in src/features/roads/data/fields.ts). */
  graphField: string
  niche: boolean
  /**
   * The broad subjects it belongs to: its primary field (Course.field) first, then every broad
   * field its graph field combines or is (FIELD_EDGES). Visa, work rights and PR follow the first.
   */
  fields: FieldId[]
  subjects: { majors: string[]; units: string[] }
  /** ANZSCO codes from OCCUPATIONS, assigned by its FieldId (FIELD_OCCUPATIONS). */
  occupationCodes: string[]
}

/** A hard filter a course can fail. */
export type FilterKey = 'level' | 'fee' | 'destination'

/** One of the nearest courses to her words; a card shows it only when `failed` is empty. */
export type FinderHit = {
  courseId: string
  name: string
  university: string
  cityId: string
  level: Level
  years: number
  feeK: number
  field: FieldId
  /** Its subjects, the primary `field` first (FinderExtra.fields). */
  fields: FieldId[]
  /** At least two of her stated interests each reach one of its subjects (search.ts fitsBoth). */
  fitsBoth: boolean
  graphField: string
  niche: boolean
  /** The niche field's one-line definition; null for a field that is not niche. */
  definition: string | null
  description: string
  /** Cosine similarity, 0–1, rounded to 3 places. */
  score: number
  failed: FilterKey[]
}

/** A course the keyword search found for the same words, for the engine room. */
export type KeywordHit = { courseId: string; name: string; rank: number }

type Searched = {
  query: string
  model: string
  /** Her words' embedding came from the in-process cache. */
  cached: boolean
  searchMs: number
  keyword: KeywordHit[]
}

/** A search: the nearest courses, or nothing close enough (best score under FINDER_FLOOR). */
export type FinderResult =
  | (Searched & { kind: 'results'; hits: FinderHit[] })
  | (Searched & { kind: 'nothing-close'; best: number })

/** A card's why: the model's, with the passage it quoted, else the template. */
export type FinderWhy = {
  courseId: string
  text: string
  quote: string | null
  source: 'model' | 'template'
  ms: number
}
