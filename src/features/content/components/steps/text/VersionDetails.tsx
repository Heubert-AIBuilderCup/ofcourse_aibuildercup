'use client'

import { useState } from 'react'
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
import type { WorkbenchView } from '../../Workbench'
import { attentionOf, type CheckState, type Gate, type Item, slideFacts } from './shared'

const NO_SUPPORTED_FACT = 'The source has no supported fact to bind.'

/**
 * A version's "Details", closed by default (GD22): its slots slide by slide, each labelled only
 * when it needs attention ("Not in the source", "Opinion"), with "Fix unbound claim" and the
 * source's wording beside a flagged sentence on the picked version (criteria 28, 104); each fact
 * the slide binds once, as its chip (GD23); the picked version's source check; every fit row.
 */
export function VersionDetails(props: {
  /** The picked version's checks carry the id "See checks" opens. */
  id?: string
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
    <details id={props.id} aria-label="Details" className="group flex flex-col gap-4">
      <summary className="cursor-pointer font-heading text-caption text-muted-foreground hover:text-foreground">
        Details
      </summary>
      <div className="mt-4 flex flex-col gap-6">
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
                            reason={
                              props.fixGate.reason ??
                              (live ? null : WORKFLOW_ERRORS.noPick) ??
                              (supported.length === 0 ? NO_SUPPORTED_FACT : null)
                            }
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

        <div className="flex flex-col gap-2">
          <h4 className="text-overline uppercase text-muted-foreground">Fit checks</h4>
          <ul className="flex flex-col gap-1">
            {props.checks.map((c) => (
              <li
                key={c.label}
                className={cn(
                  'flex items-start justify-between gap-2 text-caption',
                  !c.pass && 'text-destructive',
                )}
              >
                <span>{c.label}</span>
                <span className={cn(tag, 'shrink-0')}>{c.pass ? 'Pass' : 'Fail'}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </details>
  )
}

/**
 * The picked version's source check: running, every sentence found, or how many were not; when it
 * failed or has not run on this text, "Try again" (criterion 98). It runs by itself after each
 * save, so there is no button to start it.
 */
function CheckStatus({ check, pending }: { check: CheckState; pending: boolean }) {
  const notFound = (check.claims ?? []).filter((c) => c.result === 'not_found').length
  return (
    <div className="flex flex-col gap-2">
      <h4 className="text-overline uppercase text-muted-foreground">Source check</h4>
      {check.running ? (
        <Working words="Checking against the source…" />
      ) : check.claims ? (
        <p className={cn('text-caption', notFound > 0 && 'text-destructive')}>
          {notFound === 0
            ? 'Every sentence found in the source'
            : `${notFound} not found in the source`}
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
    </div>
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

/** "Fix unbound claim": a supported fact from the source in the slot's place (criterion 28). */
function FixUnbound(props: {
  supported: Fact[]
  reason: string | null
  pending: boolean
  onFix: (factId: string) => void
}) {
  const [factId, setFactId] = useState(props.supported[0]?.id ?? '')
  return (
    <div className="flex flex-col gap-2">
      <NativeSelect
        aria-label="Supported fact"
        value={factId}
        disabled={props.pending || props.reason !== null}
        onChange={(e) => setFactId(e.target.value)}
      >
        {props.supported.map((f) => (
          <option key={f.id} value={f.id}>
            {`${f.ref} · ${f.text}`}
          </option>
        ))}
      </NativeSelect>
      <Control reason={props.reason}>
        <Button
          variant="outline"
          size="sm"
          disabled={props.pending || props.reason !== null || factId === ''}
          onClick={() => props.onFix(factId)}
        >
          Fix unbound claim
        </Button>
      </Control>
    </div>
  )
}
