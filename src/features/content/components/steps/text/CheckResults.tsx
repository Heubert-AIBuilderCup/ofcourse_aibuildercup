'use client'

import { useId } from 'react'
import { Button } from '@/shared/components/ui/button'
import { Spin, Working } from '@/shared/components/Working'
import { cn } from '@/shared/lib/utils'
import type { LanguageId } from '../../../languages'
import type { VersionProblem, VersionStatus } from '../../../lib/version-status'
import type { ClaimResult, Fact, FitCheck } from '../../../model/types'
import { sourceWordingRefusal } from '../../../text/script'
import { Control, reasonText } from '../../parts'
import { type CheckState, type Gate, type Item, slideStep } from './shared'
import { CheckStatus, FitChecks, FixUnbound } from './VersionDetails'

/** "Shorten it" pressed and running on a slide, or a slide chip: as StructuresStep holds the press. */
type Rewriting = { slide?: number; nudge?: string; via?: 'shorten' | 'chip' } | null

export type CheckResultsProps = {
  /** The picked version's status (lib/version-status.ts): its problems, each with its fix where one exists. */
  status: VersionStatus
  /** Why "Approve text" is refused when no problem above says it ("Choose a theme first."), or null. */
  blocking: string | null
  /** The picked version, whose slots name the fit table's rows. */
  item: Item
  /** Its fit rows, every one. */
  checks: FitCheck[]
  /** Its source check's results, for the source sentence a flagged one should match. */
  claims: ClaimResult[]
  facts: Fact[]
  check: CheckState
  /** The steps of the post running now (a slide's chip waits while its slide is rewritten). */
  running: string[]
  pending: boolean
  rewriting?: Rewriting
  nudgeGate: Gate
  fixGate: Gate
  onNudge: (slide: number, nudge: string, label: string, via: 'shorten' | 'chip') => void
  onFix: (slide: number, slot: string, factId: string) => void
  /** Opens another of the Text step's tabs: Style for colours too faint, Versions for text too small. */
  onOpenTab: (tab: string) => void
  /** The post's language: the source's wording is offered only in its script. */
  language?: LanguageId
  /** Opens Your version at a slide, to edit a sentence the source's wording cannot replace. */
  onEditSlide: (slide: number) => void
}

/**
 * The picked version's checks, in the Text step's last tab, "Checks" (17 Oct), in three sections:
 * "To fix" first, one card per problem saying where it is ("Slide 3 · Body"), what is wrong, its
 * evidence (the length against its limit, the sentence at fault, the source's paragraph it should
 * match) and its fix where one exists ("Shorten it", "Fix unbound claim", the source's wording,
 * or the tab where colours and versions are chosen);
 * then the source check in one line, its sentences not found being in To fix already; then the
 * fit table, slide by slide. With nothing to fix it says every check passes.
 */
export function CheckResults(props: CheckResultsProps) {
  const ids = useId()
  const problems: VersionProblem[] = [
    ...(props.blocking ? [{ text: props.blocking }] : []),
    ...props.status.problems,
  ]
  return (
    <div className="flex min-w-0 flex-col gap-8">
      {problems.length > 0 ? (
        <section aria-labelledby={`${ids}-fix`} className="flex flex-col gap-4">
          <h3 id={`${ids}-fix`} className="text-h4">
            To fix
          </h3>
          <ul aria-label="To fix" className="flex flex-col gap-3">
            {problems.map((problem) => (
              <li key={problem.text} className="flex flex-col gap-2 border p-3">
                {problem.where && (
                  <span className="text-overline uppercase text-muted-foreground">
                    {problem.where}
                  </span>
                )}
                <p className="text-caption font-semibold text-destructive wrap-anywhere">
                  {problem.what ?? problem.text}
                </p>
                {problem.evidence?.map((line) => (
                  <p key={line} className={cn(reasonText, 'wrap-anywhere')}>
                    {line}
                  </p>
                ))}
                <ProblemFixControl {...props} problem={problem} />
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <p className="text-caption">All checks pass</p>
      )}
      <CheckStatus check={props.check} pending={props.pending} />
      <FitChecks item={props.item} checks={props.checks} />
    </div>
  )
}

/** The press that fixes one problem, by its kind, or nothing when it has none or the viewer may not. */
function ProblemFixControl({ problem, ...props }: CheckResultsProps & { problem: VersionProblem }) {
  const fix = problem.fix
  if (!fix) return null
  if (fix.kind === 'bind') {
    if (!props.fixGate.shown) return null
    return (
      <FixUnbound
        supported={props.facts.filter((f) => f.supported)}
        reason={props.fixGate.reason}
        pending={props.pending}
        onFix={(factId) => props.onFix(fix.slide, fix.slot, factId)}
      />
    )
  }
  if (fix.kind === 'open') {
    return (
      <Button
        variant="outline"
        size="sm"
        className="self-start"
        onClick={() => props.onOpenTab(fix.tab)}
      >
        {fix.tab === 'Style' ? 'Pick other colours in Style' : 'Pick another version in Versions'}
      </Button>
    )
  }
  if (fix.kind === 'wording') {
    const suggestion = props.claims[fix.claim]?.suggestion
    const gate = props.check.wordingGate
    // The source's sentence itself is the card's evidence.
    if (!suggestion || !gate.shown) return null
    // Not in the post's script (an English source on a Thai post): she edits the slide instead.
    const refused = sourceWordingRefusal(suggestion.text, props.language)
    const slide = props.claims[fix.claim]?.slide
    if (refused) {
      return (
        <div className="flex flex-col items-start gap-2">
          <p className={reasonText}>{refused}</p>
          {slide !== undefined && (
            <Button variant="outline" size="sm" onClick={() => props.onEditSlide(slide)}>
              Edit the slide
            </Button>
          )}
        </div>
      )
    }
    return (
      <Control reason={gate.reason}>
        <Button
          variant="outline"
          size="sm"
          disabled={props.pending || gate.reason !== null}
          onClick={() => props.check.onUseWording(fix.claim)}
        >
          Use the source&apos;s wording
        </Button>
      </Control>
    )
  }
  if (!props.nudgeGate.shown) return null
  const busy = props.running.includes(slideStep(fix.slide))
  const rewriting = props.rewriting ?? null
  const shortening =
    rewriting?.via === 'shorten' && rewriting.slide === fix.slide && rewriting.nudge === fix.nudge
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        variant="outline"
        size="sm"
        className="self-start"
        disabled={props.pending || busy || props.nudgeGate.reason !== null}
        onClick={() => props.onNudge(fix.slide, fix.nudge, 'Shorter', 'shorten')}
      >
        {shortening && <Spin />}
        {shortening ? 'Running…' : 'Shorten it'}
      </Button>
      {shortening && <Working words="Rewriting this slide…" />}
    </div>
  )
}
