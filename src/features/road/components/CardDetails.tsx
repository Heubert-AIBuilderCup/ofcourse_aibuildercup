import type { ReactNode } from 'react'
import { CITIES } from '@/features/engine'
import type {
  CourseJob,
  CardDetails as Details,
  FieldNear,
  JobMarketRow,
} from '@/features/roads/client'
import { cn } from '@/shared/lib/utils'
import { MockTag } from './MockTag'
import { WhatChanges } from './WhatChanges'

const KIND = {
  placement: 'Placement',
  'part-time': 'Part-time',
  'graduate-program': 'Graduate program',
} as const

const DEMAND = { low: 'low demand', moderate: 'moderate demand', high: 'high demand' } as const

const LIST = 'm-0 flex list-none flex-col gap-1.5 p-0'

const PREVIEW = 'OfCourse preview data'
const SAMPLE = 'OfCourse sample data'

/** The fields close to a course's a card lists before "and N more". */
const FIELDS_SHOWN = 3

/** The level a section title is drawn at: h2 on the board, one under the card title elsewhere. */
export type HeadingLevel = 'h2' | 'h3' | 'h4'

/** A block of the card: its title, its lines, and one source line with the mock tag beside it. */
export function Section({
  title,
  source = PREVIEW,
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
 * The fields close to a course's, on its card: the first three, each defined, then how many more.
 * The finder's detail lists them all (FieldsNearSection).
 */
function RelatedFields({ fields }: { fields: FieldNear[] }) {
  const more = fields.length - FIELDS_SHOWN
  return (
    <Section title="Related fields" source={SAMPLE}>
      <ul className={LIST}>
        {fields.slice(0, FIELDS_SHOWN).map((f) => (
          <li key={f.name}>
            <span className="font-medium">{f.name}</span>
            <span className="block text-caption text-muted-foreground">{f.definition}</span>
          </li>
        ))}
        {more > 0 ? (
          <li className="text-caption text-muted-foreground">{`and ${more} more`}</li>
        ) : null}
      </ul>
    </Section>
  )
}

/**
 * What a card adds under its guide (criteria 29 to 33), grouped, each group with one source line:
 * Study, a course's majors and units (and its conditions where the card does not draw them
 * itself: RoadCard puts them with its condition badges); the work beside it; the graduate jobs
 * after it; Careers, the occupations it leads to, each with its sample job market in the course's
 * city when the course detail is on; Related fields, the first three fields close to its own;
 * whether its occupation is on the state's list; on the stack and the alternative, the field next
 * to hers its course is in, defined. On a step that is a visa, the visa's facts, conditions and
 * where it leads. On a job beside the 485, its code, its sample starting pay and openings in her
 * city, its state lists and its way to PR. With compare on, the other-city and other-course cards
 * open on "What changes". A section with nothing in it is not drawn. Nothing is ranked: the
 * catalogue's order.
 */
export function CardDetails({ details }: { details: Details }) {
  const {
    subjects,
    work,
    graduate,
    occupations,
    listStatus,
    related,
    fieldsNear,
    compare,
    visa,
    job,
  } = details
  const withMarket = occupations?.some((o) => o.market) ?? false
  return (
    <div className="flex flex-col gap-4">
      {/* A board card offers the new roadmap as its own primary. */}
      {compare ? <WhatChanges {...compare} pin={null} /> : null}

      {visa ? (
        <Section title="About this visa" source={visa.source}>
          <p className="m-0 font-medium">
            Subclass {visa.id} · {visa.name}
          </p>
          <p className="m-0">
            <span className="text-muted-foreground">How long:</span> {visa.years}
          </p>
          <ul className={cn(LIST, 'list-disc pl-5')}>
            {visa.conditions.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
          <Line label="Leads to" items={visa.leadsTo} />
        </Section>
      ) : null}

      {job ? (
        <>
          <Section title="Job market (sample data)" source={SAMPLE}>
            <p className="m-0">
              <span className="font-medium">{job.name}</span>{' '}
              <span className="text-caption text-muted-foreground">ANZSCO {job.code}</span>
            </p>
            <p className="m-0">
              {job.market
                ? `AUD ${job.market.payLowK}–${job.market.payHighK}k starting · ${job.market.openings.toLocaleString('en-AU')} openings in ${job.city}`
                : `No sample figures for ${job.city}`}
            </p>
          </Section>
          <Section title="On the state's list?">
            <ul className={LIST}>
              {job.lists.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            <p className="m-0 font-medium">{job.prWay}</p>
          </Section>
        </>
      ) : null}

      {subjects &&
      (subjects.majors.length || subjects.units.length || subjects.conditions.length) ? (
        <Section title="Study">
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
        <Section
          title="Careers"
          source={withMarket ? `${PREVIEW}; job market: ${SAMPLE}` : PREVIEW}
        >
          <ul className={LIST}>
            {occupations.map((o) => (
              <li key={o.code}>
                <span className="font-medium">{o.name}</span>{' '}
                <span className="text-caption text-muted-foreground">ANZSCO {o.code}</span>
                {withMarket ? (
                  <span className="block text-caption text-muted-foreground">
                    {o.market ? marketLine(o.market) : 'No sample figures for this city'}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {fieldsNear?.length ? <RelatedFields fields={fieldsNear} /> : null}

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
