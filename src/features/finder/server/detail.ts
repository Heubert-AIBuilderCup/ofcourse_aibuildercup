// A finder card's detail (criteria 23 and 24): the fields one step from the course's field on the
// graph, its jobs grouped by every subject it combines (its `fields`, primary first: the primary's
// are the jobs its extras name, each other's that field's occupations not already listed), and
// each job's sample market in a city. Reads the generated catalogue's extras (1.5 MB), so it stays
// on the server (`server-only`): a card gets the result, not the catalogue.

import 'server-only'
import { FIELDS } from '@/features/roads/data/fields'
import { jobMarketFor } from '@/features/roads/data/job-market'
import { OCCUPATIONS } from '@/features/roads/data/occupations'
import { fieldsNear } from '@/features/roads/model/details'
import { FINDER_EXTRAS } from '../data/catalogue'
import { FIELD_OCCUPATIONS } from '../data/field-occupations'
import type { CourseDetailData } from '../model/types'

const extraOf = new Map(FINDER_EXTRAS.map((x) => [x.courseId, x]))
const occupationName = new Map(OCCUPATIONS.map((o) => [o.code, o.name]))
const fieldName = new Map(FIELDS.map((f) => [f.id, f.name]))

/** A finder course's related fields and jobs, with the job market in a city; null when unknown. */
export function courseDetail(courseId: string, cityId: string): CourseDetailData | null {
  const extra = extraOf.get(courseId)
  if (!extra) return null
  const listed = new Set<string>()
  return {
    fieldsNear: fieldsNear(extra.graphField),
    jobGroups: extra.fields.map((field, i) => {
      const codes = i === 0 ? extra.occupationCodes : FIELD_OCCUPATIONS[field]
      const fresh = codes.filter((code) => !listed.has(code))
      for (const code of fresh) listed.add(code)
      return {
        field,
        name: fieldName.get(field) ?? field,
        primary: i === 0,
        jobs: fresh.flatMap((code) => {
          const name = occupationName.get(code)
          return name ? [{ code, name, market: jobMarketFor(code, cityId) }] : []
        }),
      }
    }),
  }
}
