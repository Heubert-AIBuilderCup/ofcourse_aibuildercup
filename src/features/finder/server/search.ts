// The finder's search: her words' embedding, then two queries on course_doc at once, the nearest
// courses by meaning (cosine distance, pgvector) and, for the engine room, the keyword search's
// best for the same words (Postgres full text). Each hit carries the hard filters it fails, its
// subjects and whether two of her stated interests each reach one of them, and, with the course
// detail on, its related fields, jobs and job market in its own city. Text of fewer than
// FINDER_MIN_WORDS content words is nothing close, with nothing embedded or queried.
// The caller's signal bounds the embedding call; the action bounds the whole search. Errors
// propagate; the action maps them. Nothing here logs the text (criterion 11).

import 'server-only'
import { cosineDistance, desc, sql } from 'drizzle-orm'
import type { FieldId, Level } from '@/features/engine/types'
import { DRAWN_TO_AREAS, PARTICULAR } from '@/features/opening/model/questions'
import { areaFields, FIELD_OF_OPTION, FIELDS } from '@/features/roads/data/fields'
import { db } from '@/shared/lib/db'
import { courseDoc } from '@/shared/lib/db/schema'
import type { QuestionKey, StoredAnswers } from '@/shared/types/student'
import { FINDER_EXTRAS } from '../data/catalogue'
import { FINDER_FLOOR, FINDER_MIN_WORDS, FINDER_TOP } from '../model/config'
import { failedFilters } from '../model/filters'
import type { FinderHit, FinderResult } from '../model/types'
import { contentWords } from '../model/words'
import { courseDetailOn } from '../switch'
import { courseDetail } from './detail'
import { embedModelName, embedQuery } from './embed'

/** The keyword search's results shown beside the meaning search's. */
const KEYWORD_TOP = 5

const definitionOf = new Map(FIELDS.filter((f) => f.niche).map((f) => [f.id, f.definition]))
const fieldsOf = new Map(FINDER_EXTRAS.map((e) => [e.courseId, e.fields]))

/**
 * A hit's subjects, from the catalogue's extras (its own field alone for a course outside it), and
 * whether it fits two of her stated interests (fitsBoth).
 */
export function subjectsOf(
  courseId: string,
  field: FieldId,
  answers: StoredAnswers,
): Pick<FinderHit, 'fields' | 'fitsBoth'> {
  const fields = fieldsOf.get(courseId) ?? [field]
  return { fields, fitsBoth: fitsBoth(fields, answers) }
}

/** What she said to a question: an answer stored as assumed (a default she never picked) is none. */
const stated = (answers: StoredAnswers, key: QuestionKey) => {
  const answer = answers[key]
  return answer?.state === 'stated' ? answer.value : undefined
}

/**
 * Her stated interests, each as the fields it reaches: every area she is drawn to, or the one field
 * she named when she knows what she wants. Assumed answers are none.
 */
function interestsOf(answers: StoredAnswers): (readonly string[])[] {
  const know = stated(answers, 'know')
  if (know === DRAWN_TO_AREAS) {
    const areas = stated(answers, 'areas')
    return Array.isArray(areas) ? areas.map(areaFields) : []
  }
  if (know === PARTICULAR) {
    const field = stated(answers, 'field')
    const id = typeof field === 'string' ? FIELD_OF_OPTION[field] : undefined
    return id ? [[id]] : []
  }
  return []
}

/** At least two of her stated interests each reach one of the course's fields. */
export function fitsBoth(fields: readonly string[], answers: StoredAnswers): boolean {
  const reaching = interestsOf(answers).filter((reach) => reach.some((f) => fields.includes(f)))
  return reaching.length >= 2
}

/** The nearest courses to her words, filtered by her answers, or nothing close. */
export async function searchCourses(
  userId: string,
  text: string,
  answers: StoredAnswers,
  signal?: AbortSignal,
): Promise<FinderResult> {
  const started = performance.now()
  const searched = { query: text, model: embedModelName() }
  if (contentWords(text).length < FINDER_MIN_WORDS)
    return { ...searched, cached: false, searchMs: 0, keyword: [], kind: 'nothing-close', best: 0 }

  const { vector, cached } = await embedQuery(userId, text, signal)

  const distance = cosineDistance(courseDoc.embedding, vector)
  const document = sql`to_tsvector('english', ${courseDoc.name} || ' ' || ${courseDoc.description})`
  const query = sql`plainto_tsquery('english', ${text})`
  const rank = sql<number>`ts_rank(${document}, ${query})`

  const [nearest, keywordRows] = await Promise.all([
    db
      .select({
        courseId: courseDoc.id,
        name: courseDoc.name,
        university: courseDoc.university,
        cityId: courseDoc.cityId,
        level: courseDoc.level,
        years: courseDoc.years,
        feeK: courseDoc.feeK,
        field: courseDoc.field,
        graphField: courseDoc.graphField,
        niche: courseDoc.niche,
        description: courseDoc.description,
        distance,
      })
      .from(courseDoc)
      .orderBy(distance)
      .limit(FINDER_TOP),
    // An exact scan, parsing every row's text on each search: accepted below 1,000 rows (ADR-117).
    // A larger catalogue gets a generated tsvector column with a GIN index instead.
    db
      .select({ courseId: courseDoc.id, name: courseDoc.name, rank })
      .from(courseDoc)
      .where(sql`${document} @@ ${query}`)
      .orderBy(desc(rank))
      .limit(KEYWORD_TOP),
  ])

  const withDetail = courseDetailOn(process.env)
  const hits: FinderHit[] = nearest.map(({ distance, ...row }) => {
    const level = row.level as Level
    const field = row.field as FieldId
    const detail = withDetail ? courseDetail(row.courseId, row.cityId) : null
    return {
      ...row,
      level,
      field,
      ...subjectsOf(row.courseId, field, answers),
      definition: row.niche ? (definitionOf.get(row.graphField) ?? null) : null,
      score: Math.round((1 - Number(distance)) * 1000) / 1000,
      failed: failedFilters(answers, { level, feeK: row.feeK, cityId: row.cityId }),
      ...(detail ? { detail } : {}),
    }
  })

  const result = {
    ...searched,
    cached,
    searchMs: Math.round(performance.now() - started),
    keyword: keywordRows.map((r) => ({ ...r, rank: Number(r.rank) })),
  }
  const best = hits[0]?.score ?? 0
  if (best < FINDER_FLOOR) return { ...result, kind: 'nothing-close', best }
  return { ...result, kind: 'results', hits }
}
