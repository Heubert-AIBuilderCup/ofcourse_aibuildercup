'use client'

import { type ReactNode, useId, useState } from 'react'
import { Button } from '@/shared/components/ui/button'
import { NativeSelect } from '@/shared/components/ui/native-select'
import { Working } from '@/shared/components/Working'
import { cn } from '@/shared/lib/utils'
import { unboundSlots } from '../../../lib/claims'
import { paragraphSite } from '../../../lib/sites'
import { WORKFLOW_ERRORS } from '../../../lib/workflow'
import type { ClaimResult, Fact, FitCheck } from '../../../model/types'
import { findSlideSpec } from '../../../templates'
import { FactNumber } from '../../FactChip'
import { Control, reasonText, tag } from '../../parts'
import { SideDrawer } from '../../stage'
import type { WorkbenchView } from '../../Workbench'
import {
  attentionOf,
  type CheckState,
  claimSummary,
  fitTable,
  type Gate,
  type Item,
  slideFacts,
  WHOLE_POST,
} from './shared'

const NO_SUPPORTED_FACT = 'The source has no supported fact to bind.'

/**
 * A version's "Details", in a drawer from the right that its button opens, closed by default
 * (GD22): another version's look switch and text chips first, when it has them; then its slots
 * slide by slide, each labelled only when it needs attention ("Not in the source", "Opinion"),
 * with "Fix unbound claim" and the source's wording beside a flagged sentence on the picked
 * version (criteria 28, 104); each fact the slide binds once, as its chip (GD23); the picked
 * version's source check; every fit row.
 */
export function VersionDetails(props: {
  /** The drawer's title, naming the version ("Version B · What it costs"). */
  title: string
  /** Another version's look switch and whole-version chips (VersionControls), or null. */
  controls?: ReactNode
  view: WorkbenchView
  item: Item
  facts: Fact[]
  checks: FitCheck[]
  claims: ClaimResult[]
  /** The picked version before the gate: checked as it goes, its claims fixed here. */
  live: boolean
  editing: boolean
  pending: boolean
  fixGate: Gate
  check: CheckState
  onFix: (slide: number, slot: string, factId: string) => void
}) {
  const { view, item, facts, claims, live, pending } = props
  const unbound = unboundSlots(item.structure, item.template, facts)
  const attention = attentionOf(item, facts, claims)
  const source = view.current.source?.body
  const sourceTitle = source?.title ?? ''
  const supported = facts.filter((f) => f.supported)
  const flagged = (slide: number, slot: string) =>
    claims.flatMap((c, i) =>
      c.slide === slide && c.slot === slot && c.result === 'not_found'
        ? [{ claim: c, index: i }]
        : [],
    )

  return (
    <SideDrawer title={props.title} trigger="Details">
      <div className="flex flex-col gap-6">
        {props.controls}
        <ol className="flex flex-col gap-4">
          {item.structure.slides.map((slide, i) => {
            const number = i + 1
            const chips = slideFacts(slide, facts)
            return (
              // biome-ignore lint/suspicious/noArrayIndexKey: a slide is its position in the draft.
              <li key={i} className="flex flex-col gap-2">
                <span className="text-overline uppercase text-muted-foreground">
                  {`Slide ${number}`}
                </span>
                <ul className="flex flex-col gap-2">
                  {(findSlideSpec(item.template, slide)?.slots ?? []).flatMap((spec) => {
                    const slot = slide.slots[spec.key]
                    if (!slot) return []
                    const label = attention.get(`${number}:${spec.key}`)
                    const loose = unbound.some((u) => u.slide === number && u.slot === spec.key)
                    return [
                      <li key={spec.key} className="flex flex-col gap-1">
                        <span className="text-caption text-muted-foreground">{spec.label}</span>
                        <span className="text-caption wrap-anywhere">{slot.text}</span>
                        {label && (
                          <span className="text-caption font-semibold text-destructive">
                            {label}
                          </span>
                        )}
                        {loose && props.editing && props.fixGate.shown && (
                          <FixUnbound
                            supported={supported}
                            reason={props.fixGate.reason ?? (live ? null : WORKFLOW_ERRORS.noPick)}
                            pending={pending}
                            onFix={(factId) => props.onFix(number, spec.key, factId)}
                          />
                        )}
                        {spec.factual && (
                          <FlaggedSentences
                            flagged={flagged(number, spec.key)}
                            gate={props.check.wordingGate}
                            pending={pending}
                            onUse={props.check.onUseWording}
                          />
                        )}
                      </li>,
                    ]
                  })}
                </ul>
                {chips.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {chips.map((fact) => (
                      <FactNumber
                        key={fact.id}
                        fact={fact}
                        sourceTitle={sourceTitle}
                        site={source ? paragraphSite(source, fact.ref) : null}
                        checkedAt={view.createdAt}
                      />
                    ))}
                  </div>
                )}
              </li>
            )
          })}
        </ol>

        {live && <CheckStatus check={props.check} pending={pending} />}

        <FitChecks item={item} checks={props.checks} />
      </div>
    </SideDrawer>
  )
}

/** The fit table's columns: a slide's slots, or the whole post's checks (contrast, legibility). */
const SLOT_COLUMNS = ['Slot', 'Length', 'Limit', 'Status']
const POST_COLUMNS = ['Check', 'Value', 'Limit', 'Status']

/**
 * Every fit row of a version as a table per slide, its slots' lengths against their limits, then
 * one for the whole post (fitTable, 17 Oct): the passing rows muted, the failing ones in the
 * problem colour. A verdict, not a control: nothing to press.
 */
export function FitChecks({ item, checks }: { item: Item; checks: FitCheck[] }) {
  const ids = useId()
  const groups = fitTable(item, checks)
  return (
    <section aria-labelledby={`${ids}-fit`} className="flex flex-col gap-4">
      <h3 id={`${ids}-fit`} className="text-h4">
        Fit checks
      </h3>
      {groups.map((group) => (
        <table key={group.title} className="w-full text-caption">
          <caption className="pb-1 text-left text-overline uppercase text-muted-foreground">
            {group.title}
          </caption>
          <thead>
            <tr className="border-b">
              {(group.title === WHOLE_POST ? POST_COLUMNS : SLOT_COLUMNS).map((name) => (
                <th key={name} scope="col" className="py-1 pr-3 text-left font-normal">
                  {name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {group.rows.map((row, i) => (
              <tr
                // biome-ignore lint/suspicious/noArrayIndexKey: a row is its place in the checks.
                key={i}
                className={row.pass ? 'text-muted-foreground' : 'font-semibold text-destructive'}
              >
                <td className="py-1 pr-3 wrap-anywhere">{row.slot}</td>
                <td className="py-1 pr-3">{row.length}</td>
                <td className="py-1 pr-3">{row.limit}</td>
                <td className="py-1">{row.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ))}
    </section>
  )
}

/**
 * The picked version's source check: running, or its sentences counted in one line ("12 found · 1
 * not found · 0 opinion"; each one not found is a card in To fix); when it failed or has not run
 * on this text, "Try again" (criterion 98). It runs by itself after each save, so there is no
 * button to start it.
 */
export function CheckStatus({ check, pending }: { check: CheckState; pending: boolean }) {
  const ids = useId()
  const notFound = (check.claims ?? []).filter((c) => c.result === 'not_found').length
  return (
    <section aria-labelledby={`${ids}-source`} className="flex flex-col gap-2">
      <h3 id={`${ids}-source`} className="text-h4">
        Source check
      </h3>
      {check.running ? (
        <Working words="Checking against the source…" />
      ) : check.claims ? (
        <p className={cn('text-caption', notFound > 0 && 'text-destructive')}>
          {claimSummary(check.claims)}
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          <p className={reasonText}>
            {check.failed ? 'The source check failed. Your text is kept.' : 'Not checked yet.'}
          </p>
          {check.retryGate.shown && (
            <Control reason={check.retryGate.reason}>
              <Button
                variant="outline"
                size="sm"
                disabled={pending || check.retryGate.reason !== null}
                onClick={check.onTryAgain}
              >
                Try again
              </Button>
            </Control>
          )}
        </div>
      )}
    </section>
  )
}

/**
 * A slot's sentences the source check could not find, each beside the source sentence it should
 * match, with "Use the source's wording" to put that sentence in its place (criterion 104).
 */
function FlaggedSentences(props: {
  flagged: { claim: ClaimResult; index: number }[]
  gate: Gate
  pending: boolean
  onUse: (claim: number) => void
}) {
  if (props.flagged.length === 0) return null
  return (
    <ul className="flex flex-col gap-2">
      {props.flagged.map(({ claim, index }) => (
        <li key={index} className="flex flex-col gap-1">
          <div className="flex items-start justify-between gap-2">
            <span className="min-w-0 text-caption wrap-anywhere">{claim.text}</span>
            <span className={cn(tag, 'shrink-0 border-destructive text-destructive')}>
              Not found
            </span>
          </div>
          {claim.suggestion && (
            <>
              <p className={cn(reasonText, 'wrap-anywhere')}>
                {`Source ${claim.suggestion.ref}: ${claim.suggestion.text}`}
              </p>
              {props.gate.shown && (
                <Control reason={props.gate.reason}>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={props.pending || props.gate.reason !== null}
                    onClick={() => props.onUse(index)}
                  >
                    Use the source&apos;s wording
                  </Button>
                </Control>
              )}
            </>
          )}
        </li>
      ))}
    </ul>
  )
}

/**
 * "Fix unbound claim": a supported fact from the source in the slot's place (criterion 28), waiting
 * with the reason when the source has none.
 */
export function FixUnbound(props: {
  supported: Fact[]
  reason: string | null
  pending: boolean
  onFix: (factId: string) => void
}) {
  const [factId, setFactId] = useState(props.supported[0]?.id ?? '')
  const reason = props.reason ?? (props.supported.length === 0 ? NO_SUPPORTED_FACT : null)
  return (
    <div className="flex flex-col gap-2">
      <NativeSelect
        aria-label="Supported fact"
        value={factId}
        disabled={props.pending || reason !== null}
        onChange={(e) => setFactId(e.target.value)}
      >
        {props.supported.map((f) => (
          <option key={f.id} value={f.id}>
            {`${f.ref} · ${f.text}`}
          </option>
        ))}
      </NativeSelect>
      <Control reason={reason}>
        <Button
          variant="outline"
          size="sm"
          disabled={props.pending || reason !== null || factId === ''}
          onClick={() => props.onFix(factId)}
        >
          Fix unbound claim
        </Button>
      </Control>
    </div>
  )
}
