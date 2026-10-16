import type { ReactNode } from 'react'
import type { CardDetails as Details } from '@/features/roads/client'
import { MockTag } from './MockTag'

const KIND = {
  placement: 'Placement',
  'part-time': 'Part-time',
  'graduate-program': 'Graduate program',
} as const

const DEMAND = { low: 'low demand', moderate: 'moderate demand', high: 'high demand' } as const

const LIST = 'm-0 flex list-none flex-col gap-1.5 p-0'

/** A block of the card: its title, its lines, and the source line with the mock tag beside it. */
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-1">
      <h2 className="m-0 font-sans text-overline font-normal text-muted-foreground uppercase">
        {title}
      </h2>
      {children}
      <p className="m-0 flex items-center gap-1 text-caption text-muted-foreground">
        Source: OfCourse preview data ·
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

/**
 * What a card adds under its guide (criteria 29 to 33): a course's majors, units and conditions
 * (entry and course ones alike, so not called "to get in"); the work beside it; the graduate jobs
 * and occupations after it; whether its occupation is on the state's list; and, on the stack and
 * the alternative, the field next to hers its course is in, defined. A section with nothing in it
 * is not drawn. Nothing is ranked: the catalogue's order.
 */
export function CardDetails({ details }: { details: Details }) {
  const { subjects, work, graduate, occupations, listStatus, related } = details
  return (
    <div className="flex flex-col gap-4">
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
