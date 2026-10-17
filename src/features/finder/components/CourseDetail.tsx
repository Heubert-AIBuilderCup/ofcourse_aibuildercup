import { FieldsNearSection, JobMarketSection } from '@/features/road/client'
import type { CourseDetailData } from '../model/types'

/**
 * A finder card's expandable detail (criteria 23 and 24): the jobs the course leads to with their
 * sample market in its city, one section per subject it combines ("Psychology roles · Job market
 * (sample data)"), each subject after the primary one with a caveat that its roles may need the
 * degree assessed for that field, and, on a combined course, once above them, the subject her visa
 * and PR route follow (its primary one); then the fields close to its own, in the board cards' sections. The server works the detail out
 * (server/detail.ts); this only draws it. A section with nothing in it is not drawn, and nothing at
 * all when every one is empty.
 */
export function CourseDetail({ detail }: { detail: CourseDetailData }) {
  const { fieldsNear } = detail
  const jobGroups = detail.jobGroups.filter((g) => g.jobs.length)
  if (!jobGroups.length && !fieldsNear.length) return null
  const primary = detail.jobGroups.find((g) => g.primary)
  const route = detail.jobGroups.length > 1 && jobGroups.length ? primary?.name : undefined
  return (
    <details>
      <summary className="cursor-pointer text-caption text-muted-foreground">
        Jobs and fields close to this one
      </summary>
      <div className="flex flex-col gap-4 pt-2">
        {route ? (
          <p className="m-0 text-caption text-muted-foreground">
            Your visa and PR route follow {route}.
          </p>
        ) : null}
        {jobGroups.map((g) => (
          <JobMarketSection
            key={g.field}
            jobs={g.jobs}
            headingLevel="h4"
            title={`${g.name} roles · Job market (sample data)`}
            note={
              g.primary
                ? undefined
                : `Roles in ${g.name} may need your degree assessed for that field.`
            }
          />
        ))}
        {fieldsNear.length ? <FieldsNearSection fields={fieldsNear} headingLevel="h4" /> : null}
      </div>
    </details>
  )
}
