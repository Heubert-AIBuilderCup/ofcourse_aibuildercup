import type { ReactNode } from 'react'
import { AdminPageHeader } from '@/features/admin'
import { Blueprint } from '@/shared/components/Blueprint'
import { cn } from '@/shared/lib/utils'
import { barRows, cacheShare, dimensionBars, type PerformanceRow } from '../lib/overview'
import type { OVERVIEW } from '../overview'
import type { WeekFigures } from '../server/overview'
import { EvidenceGaps } from './EvidenceGaps'

const overline = 'text-overline text-muted-foreground uppercase'
const caption = 'text-caption text-muted-foreground'
const n = (value: number) => value.toLocaleString('en-AU')

type Overview = typeof OVERVIEW

/**
 * The Insights overview: what is happening, read-only. Real where the app keeps the figures (the
 * week's renders and AI calls, the live posts' titles, an update's reach once one is live); every
 * other figure is the overview file's and says "mock".
 */
export function InsightsOverview({
  data,
  week,
  gaps,
  performance,
  livePosts,
  reach,
  editable,
}: {
  data: Overview
  week: WeekFigures
  gaps: Parameters<typeof EvidenceGaps>[0]['gaps']
  performance: PerformanceRow[]
  /** Whether the performance rows name real live posts (their figures are mock either way). */
  livePosts: boolean
  /** The latest live update's reach, or the mock one. */
  reach: { title: string; matched: number; mock: boolean }
  editable: boolean
}) {
  const reuse = cacheShare(week)
  const { scope } = data
  return (
    <div className="@container flex flex-col gap-6">
      <AdminPageHeader
        kicker="Students, in aggregate"
        title="Insights"
        lede={`${scope.country} · ${scope.window} · ${n(scope.students)} students · aggregated (mock)`}
      />

      <Blueprint
        as="section"
        aria-labelledby="insights-ai"
        className="grid grid-cols-[repeat(auto-fit,minmax(min(12rem,100%),1fr))] gap-6 p-4"
      >
        <h2 id="insights-ai" className={overline}>
          AI cost and reuse · 7 days
        </h2>
        <Stat value={String(data.ai.callsPerSession)}>AI calls per student per session (mock)</Stat>
        <Stat value={reuse === null ? '—' : `${reuse}%`}>
          {reuse === null
            ? 'AI calls answered from the cache: no calls this week'
            : 'AI calls answered from the cache, no new call'}
        </Stat>
        <Stat value={n(week.renders)}>{`renders a week · ${n(week.calls)} AI calls`}</Stat>
        <Stat value={`AUD ${data.ai.costPerStudentWeekAud.toFixed(2)}`}>
          AI cost per active student a week (mock)
        </Stat>
      </Blueprint>

      <Blueprint as="section" aria-labelledby="insights-gaps" className="flex flex-col gap-3 p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
          <h2 id="insights-gaps" className={overline}>
            Evidence gaps · claims shown with weak or no evidence (mock)
          </h2>
          <p className={caption}>
            Ranked by students who saw the claim. Students see "we're not sure about this yet".
          </p>
        </div>
        <EvidenceGaps gaps={gaps} editable={editable} />
        <p className={caption}>
          Attaching a source updates every future card and route that uses the claim. Research tasks
          also go to the Ideas queue.
        </p>
      </Blueprint>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(20rem,100%),1fr))] gap-6">
        <Panel id="insights-dimensions" title="Most-weighted dimensions (mock)">
          <p className={caption}>Share of students weighting each one high</p>
          <Bars rows={dimensionBars(data.dimensions).map((b) => ({ key: b.id, ...b }))} />
        </Panel>
        <Panel id="insights-routes" title="Most-ranked routes (mock)">
          <p className={caption}>Students with the route in their ranked list · ranked 1st</p>
          <ol className="flex flex-col">
            {data.routes.map((r, i) => (
              <li
                key={r.route}
                className="grid grid-cols-[1.5rem_minmax(0,1fr)_auto_3rem] gap-2 border-b py-2 text-caption"
              >
                <span className="text-muted-foreground">{i + 1}</span>
                <span>{r.route}</span>
                <span className="text-right">{n(r.students)}</span>
                <span className="text-right text-muted-foreground">{`${r.firstShare}%`}</span>
              </li>
            ))}
          </ol>
        </Panel>
        <Panel id="insights-blockers" title="Why courses are not yet reachable (mock)">
          <p className={caption}>Share of sealed courses, by first blocker</p>
          <Bars rows={barRows(data.blockers).map((b) => ({ key: b.label, ...b }))} />
        </Panel>
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(24rem,100%),1fr))] gap-6">
        <Panel id="insights-performance" title="Content performance · portal feed">
          <p className={caption}>
            {livePosts
              ? 'Live posts; views, saves and completion are mock.'
              : 'No post is live yet: mock rows.'}
          </p>
          <table className="w-full text-caption">
            <thead>
              <tr className={cn(overline, 'border-b text-left')}>
                <th className="py-2 font-normal">Post</th>
                <th className="py-2 text-right font-normal">Views</th>
                <th className="py-2 text-right font-normal">Saves</th>
                <th className="py-2 text-right font-normal">Completion</th>
                <th className="py-2 text-right font-normal">Into the studio</th>
              </tr>
            </thead>
            <tbody>
              {performance.map((row) => (
                <tr key={row.key} className="border-b">
                  <td className="py-2 pr-2">{row.title}</td>
                  <td className="py-2 text-right">{n(row.views)}</td>
                  <td className="py-2 text-right">{n(row.saves)}</td>
                  <td className="py-2 text-right">{`${row.completion}%`}</td>
                  <td className="py-2 text-right">{n(row.intoStudio)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
        <Panel
          id="insights-reach"
          title={`Update reach · ${reach.title}${reach.mock ? ' (mock)' : ''}`}
        >
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-caption">Matched</span>
            <span className="font-heading text-h3">{n(reach.matched)}</span>
          </div>
        </Panel>
      </div>
    </div>
  )
}

function Stat({ value, children }: { value: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="font-heading text-h2">{value}</span>
      <span className="text-caption">{children}</span>
    </div>
  )
}

function Panel({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <Blueprint as="section" aria-labelledby={id} className="flex flex-col gap-3 p-4">
      <h2 id={id} className={overline}>
        {title}
      </h2>
      {children}
    </Blueprint>
  )
}

function Bars({ rows }: { rows: { key: string; label: string; share: number; width: string }[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {rows.map((r) => (
        <li
          key={r.key}
          className="grid grid-cols-[minmax(0,8rem)_minmax(0,1fr)_3rem] items-center gap-3 text-caption"
        >
          <span>{r.label}</span>
          <span className="h-2 bg-muted">
            <span className="block h-full bg-primary" style={{ width: r.width }} />
          </span>
          <span className="text-right text-muted-foreground">{`${r.share}%`}</span>
        </li>
      ))}
    </ul>
  )
}
