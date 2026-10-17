import type { ReactNode } from 'react'
import { CITIES } from '@/features/engine'
import type {
  CourseJob,
  CardDetails as Details,
  FieldNear,
  JobMarketRow,
} from '@/features/roads/client'
import { MockTag } from './MockTag'
import { WhatChanges } from './WhatChanges'

const KIND = {
  placement: 'Placement',
  'part-time': 'Part-time',
  'graduate-program': 'Graduate program',
} as const

const DEMAND = { low: 'low demand', moderate: 'moderate demand', high: 'high demand' } as const

const LIST = 'm-0 flex list-none flex-col gap-1.5 p-0'

const SAMPLE = 'OfCourse sample data'

/** The level a section title is drawn at: h2 on the board, one under the card title elsewhere. */
export type HeadingLevel = 'h2' | 'h3' | 'h4'

/** A block of the card: its title, its lines, and the source line with the mock tag beside it. */
function Section({
  title,
  source = 'OfCourse preview data',
  headingLevel: Heading = 'h2',
  children,
}: {
  title: string
  source?: string
  headingLevel?: HeadingLevel
  children: ReactNode
}) {
  return (
    <section className="flex flex-col gap-1">
      <Heading className="m-0 font-sans text-overline font-normal text-muted-foreground uppercase">
        {title}
      </Heading>
      {children}
      <p className="m-0 flex items-center gap-1 text-caption text-muted-foreground">
        Source: {source} ·
        <MockTag />
      </p>
    </section>
  )
}

/** A labelled line: "Majors: …". */
function Line({ label, items }: { label: string; items: string[] }) {
  return items.length ? (
    <p className="m-0">
      <span className="text-muted-foreground">{label}:</span> {items.join(', ')}
    </p>
  ) : null
}

const cityName = (id: string): string => CITIES.find((c) => c.id === id)?.name ?? id

/** "620 openings · AUD 104–142k starting · Sydney". */
const marketLine = (m: JobMarketRow): string =>
  `${m.openings.toLocaleString('en-AU')} openings · AUD ${m.payLowK}–${m.payHighK}k starting · ${cityName(m.cityId)}`

/**
 * Each job with its sample openings and starting pay in the city, where there is a sample row,
 * under `title` (a found course's subject, "Psychology roles") and an optional muted `note`.
 */
export function JobMarketSection({
  jobs,
  headingLevel,
  title = 'Job market (sample data)',
  note,
}: {
  jobs: CourseJob[]
  headingLevel?: HeadingLevel
  title?: string
  note?: string
}) {
  return (
    <Section title={title} source={SAMPLE} headingLevel={headingLevel}>
      {note ? <p className="m-0 text-caption text-muted-foreground">{note}</p> : null}
      <ul className={LIST}>
        {jobs.map((j) => (
          <li key={j.code}>
            <span className="font-medium">{j.name}</span>
            <span className="block text-caption text-muted-foreground">
              {j.market ? marketLine(j.market) : 'No sample figures for this city'}
            </span>
          </li>
        ))}
      </ul>
    </Section>
  )
}

/** The fields one step from this one on the field graph, each defined. */
export function FieldsNearSection({
  fields,
  headingLevel,
}: {
  fields: FieldNear[]
  headingLevel?: HeadingLevel
}) {
  return (
    <Section title="Fields close to this one" source={SAMPLE} headingLevel={headingLevel}>
      <ul className={LIST}>
        {fields.map((f) => (
          <li key={f.name}>
            <span className="font-medium">{f.name}</span>: {f.definition}
          </li>
        ))}
      </ul>
    </Section>
  )
}

/**
 * What a card adds under its guide (criteria 29 to 33): a course's majors, units and conditions
 * (entry and course ones alike, so not called "to get in"); the work beside it; the graduate jobs
 * and occupations after it; whether its occupation is on the state's list; on the stack and the
 * alternative, the field next to hers its course is in, defined; and, with the course detail on,
 * each course card's job market per occupation and the fields close to its own (sample data). With
 * compare on, the other-city and other-course cards open on "What changes". A section with
 * nothing in it is not drawn. Nothing is ranked: the catalogue's order.
 */
export function CardDetails({ details }: { details: Details }) {
  const { subjects, work, graduate, occupations, listStatus, related, fieldsNear, compare } =
    details
  const markets = occupations?.filter((o) => o.market) ?? []
  return (
    <div className="flex flex-col gap-4">
      {compare ? <WhatChanges {...compare} /> : null}

      {subjects ? (
        <Section title="What you would study">
          <Line label="Majors" items={subjects.majors} />
          <Line label="Units" items={subjects.units} />
          <Line label="Conditions" items={subjects.conditions} />
        </Section>
      ) : null}

      {work?.length ? (
        <Section title="Work beside your course">
          <ul className={LIST}>
            {work.map((o) => (
              <li key={`${o.employer}-${o.title}`}>
                <span className="font-medium">{o.title}</span> · {o.employer}
                <span className="block text-caption text-muted-foreground">
                  {KIND[o.kind]} · {DEMAND[o.demand]}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {graduate?.length ? (
        <Section title="Graduate jobs after it">
          <ul className={LIST}>
            {graduate.map((g) => (
              <li key={`${g.employer}-${g.title}`}>
                <span className="font-medium">{g.title}</span> · {g.employer}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {occupations?.length ? (
        <Section title="Occupations it leads to">
          <ul className={LIST}>
            {occupations.map((o) => (
              <li key={o.code}>
                {o.name} <span className="text-caption text-muted-foreground">ANZSCO {o.code}</span>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {markets.length ? <JobMarketSection jobs={markets} /> : null}

      {fieldsNear?.length ? <FieldsNearSection fields={fieldsNear} /> : null}

      {listStatus ? (
        <Section title="On the state's list?">
          <ul className={LIST}>
            {listStatus.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </Section>
      ) : null}

      {related ? (
        <Section title="Related to what you picked">
          <p className="m-0">
            <span className="font-medium">{related.field}</span>: {related.definition}
          </p>
        </Section>
      ) : null}
    </div>
  )
}
