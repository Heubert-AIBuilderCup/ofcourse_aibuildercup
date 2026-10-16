'use client'

import { useId, useState, useTransition } from 'react'
import { Button } from '@/shared/components/ui/button'
import { Working } from '@/shared/components/Working'
import type { Staff } from '@/shared/lib/auth/access'
import { cn } from '@/shared/lib/utils'
import type { SupportingSource } from '../../ai/search'
import { actionError, editWaitError, type PostAction, WORKFLOW_ERRORS } from '../../lib/workflow'
import type { ClaimResult } from '../../model/types'
import type { Researched, Saved } from '../../server/commands'
import { Control, movesWait, reasonText, tag } from '../parts'
import { usePostAction } from '../usePostAction'
import type { WorkbenchActions, WorkbenchView } from '../Workbench'

export type SourceCheckPanelProps = {
  view: WorkbenchView
  viewer: Staff
  actions: Pick<
    WorkbenchActions,
    | 'checkSourceAction'
    | 'markOpinionAction'
    | 'removeClaimAction'
    | 'applySourceWordingAction'
    | 'researchClaimAction'
    | 'addResearchSourceAction'
  >
}

/** The source check's step, as server/commands/check.ts runs it. */
const CHECK_STEP = 'source_check'

const RESULT_LABEL = (c: ClaimResult) =>
  c.result === 'found'
    ? `Found ${c.ref ?? ''}`.trim()
    : c.result === 'opinion'
      ? 'Editorial opinion'
      : 'Not found'

/** What a workbench control says when the action itself could not be reached. */
const NETWORK_ERROR = 'Could not reach the server. Please try again.'

/** "Research this" on one sentence: a search when pressed, and "Add as a source" for a page it finds. */
type ResearchControl = {
  shown: boolean
  reason: string | null
  find: (claim: ClaimResult) => Promise<Researched>
  add: (claim: ClaimResult, page: SupportingSource) => void
  addReason: string | null
}

/**
 * "Research this" (BR14) under a sentence not found: one search per press, with the loader while
 * it runs, then the pages found, each with its title and site, the sentence on it that supports
 * the claim, "Add as a source" and "Dismiss", and Google's search entry point in a sandboxed frame,
 * as its grounding display rules require. Nothing is searched until pressed.
 */
function Research({
  claim,
  control,
  pending,
}: {
  claim: ClaimResult
  control: ResearchControl
  pending: boolean
}) {
  const [found, setFound] = useState<{
    sources: SupportingSource[]
    entryPoint: string | null
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [searching, startSearching] = useTransition()

  const search = () => {
    setError(null)
    setFound(null)
    startSearching(async () => {
      try {
        const res = await control.find(claim)
        if (res.ok) setFound({ sources: res.sources, entryPoint: res.entryPoint })
        else setError(res.error)
      } catch {
        setError(NETWORK_ERROR)
      }
    })
  }
  // The last page dismissed: back to "Research this", as before any press.
  const dismiss = (url: string) =>
    setFound((was) => {
      const sources = was?.sources.filter((s) => s.url !== url) ?? []
      return was && sources.length > 0 ? { ...was, sources } : null
    })

  if (searching) return <Working words="Searching Google for support…" />
  return (
    <div className="flex flex-col gap-3">
      {found === null && (
        <Control reason={control.reason}>
          <Button
            variant="outline"
            size="sm"
            disabled={pending || control.reason !== null}
            onClick={search}
          >
            Research this
          </Button>
          {error && (
            <p role="alert" className="text-caption text-destructive">
              {error}
            </p>
          )}
        </Control>
      )}
      {found && found.sources.length === 0 && (
        <p className="text-caption text-muted-foreground">
          No page found that supports this sentence.
        </p>
      )}
      {found && found.sources.length > 0 && (
        <ul aria-label="Pages that support it" className="flex flex-col gap-3">
          {found.sources.map((s) => (
            <li key={s.url} className="flex flex-col gap-2">
              <p className="text-caption wrap-anywhere">
                {/* The resolved address is https by the reader (server/fetch-page.ts); anything else is shown as text. */}
                {s.url.startsWith('https://') ? (
                  <a href={s.url} target="_blank" rel="noopener noreferrer" className="underline">
                    {s.title}
                  </a>
                ) : (
                  s.title
                )}
                <span className="text-muted-foreground">{` · ${s.site}`}</span>
              </p>
              <p className={cn(reasonText, 'wrap-anywhere')}>{`“${s.sentence}”`}</p>
              <Control reason={control.addReason}>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pending || control.addReason !== null}
                  onClick={() => control.add(claim, s)}
                >
                  Add as a source
                </Button>
                <Button variant="ghost" size="sm" onClick={() => dismiss(s.url)}>
                  Dismiss
                </Button>
              </Control>
            </li>
          ))}
        </ul>
      )}
      {found?.entryPoint && (
        // Google's markup in its own document: no script and no access to this page; its
        // search chips open in a new tab.
        <iframe
          title="Google Search suggestions"
          sandbox="allow-popups allow-popups-to-escape-sandbox"
          srcDoc={`<base target="_blank">${found.entryPoint}`}
          className="h-20 w-full"
        />
      )}
    </div>
  )
}

type ClaimControl = { shown: boolean; reason: string | null; run: (claim: number) => void }
type ClaimControls = {
  pending: boolean
  wording: ClaimControl
  remove: ClaimControl
  opinion: ClaimControl
  research?: ResearchControl
}

/**
 * Every claim of the post as the source check read it: "Found ¶n", "Not found" or "Editorial
 * opinion" (criteria 42, 43). A claim not found shows the source sentence it should match
 * (criterion 104). With controls, it offers "Use the source's wording", "Remove", "Mark as
 * editorial opinion" and "Research this" (BR14); without, the list is read-only (the reviewer's view). With `only`, it lists
 * just the claims that pass it, each still named by its place in the check, as the actions take it.
 */
export function ClaimRows({
  claims,
  controls,
  only,
}: {
  claims: ClaimResult[]
  controls?: ClaimControls
  only?: (claim: ClaimResult) => boolean
}) {
  const button = (control: ClaimControl, claim: number, label: string) =>
    controls &&
    control.shown && (
      <Control reason={control.reason}>
        <Button
          variant="outline"
          size="sm"
          disabled={controls.pending || control.reason !== null}
          onClick={() => control.run(claim)}
        >
          {label}
        </Button>
      </Control>
    )
  return (
    <ul className="flex flex-col gap-3">
      {claims.map((c, i) =>
        only && !only(c) ? null : (
          <li
            // biome-ignore lint/suspicious/noArrayIndexKey: a claim is its position in the check, as the actions name it.
            key={i}
            data-testid="check-row"
            className="flex flex-col gap-2"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex min-w-0 flex-col gap-1">
                <span className="text-overline uppercase text-muted-foreground">
                  {`Slide ${c.slide} · ${c.slot}`}
                </span>
                <span className="text-caption wrap-anywhere">{c.text}</span>
              </div>
              <span
                className={cn(
                  tag,
                  'shrink-0',
                  c.result === 'not_found' && 'border-destructive text-destructive',
                )}
              >
                {RESULT_LABEL(c)}
              </span>
            </div>
            {c.result === 'not_found' && c.suggestion && (
              <p
                className={cn(reasonText, 'wrap-anywhere')}
              >{`Source ${c.suggestion.ref}: ${c.suggestion.text}`}</p>
            )}
            {controls && c.result === 'not_found' && (
              <div className="flex flex-wrap gap-3">
                {c.suggestion && button(controls.wording, i, "Use the source's wording")}
                {button(controls.remove, i, 'Remove')}
                {button(controls.opinion, i, 'Mark as editorial opinion')}
              </div>
            )}
            {controls?.research?.shown && c.result === 'not_found' && (
              <Research claim={c} control={controls.research} pending={controls.pending} />
            )}
          </li>
        ),
      )}
    </ul>
  )
}

/** "2 found in the article · 1 not found · 1 opinion": the check summed up. */
function checkSummary(claims: ClaimResult[]): string {
  const count = (result: ClaimResult['result']) => claims.filter((c) => c.result === result).length
  return `${count('found')} found in the article · ${count('not_found')} not found · ${count('opinion')} opinion`
}

const notFound = (c: ClaimResult) => c.result === 'not_found'

/** The summary, the sentences not found with their fixes, and the rest under a closed disclosure. */
function CheckList({ claims, controls }: { claims: ClaimResult[]; controls: ClaimControls }) {
  const rest = claims.some((c) => !notFound(c))
  return (
    <div className="flex flex-col gap-4">
      <p className="text-caption">{checkSummary(claims)}</p>
      {claims.some(notFound) && <ClaimRows claims={claims} controls={controls} only={notFound} />}
      {rest && (
        <details>
          <summary className="cursor-pointer text-caption text-muted-foreground">
            All checked sentences
          </summary>
          <div className="mt-3">
            <ClaimRows claims={claims} only={(c) => !notFound(c)} />
          </div>
        </details>
      )}
    </div>
  )
}

/**
 * The rendered version's source check, which runs by itself after approval and after each text
 * change (criterion 98): summed up first, then only the sentences not found, each with its fixes,
 * and every other sentence under a closed "All checked sentences"; "Try again" only when no check
 * of this version has landed.
 */
export function SourceCheckPanel({ view, viewer, actions }: SourceCheckPanelProps) {
  const { pending, run } = usePostAction()
  const [busy, setBusy] = useState<PostAction | null>(null)
  const ids = useId()
  const check = view.current.sourceCheck
  const checking = view.running.includes(CHECK_STEP) || (pending && busy === 'sourceCheck')

  const gate = (action: PostAction) => {
    const error = actionError(action, viewer, view.stage)
    return { shown: error !== WORKFLOW_ERRORS.notAuthorised, reason: error }
  }
  const act = (action: PostAction, work: () => Promise<Saved>, success: string) => {
    setBusy(action)
    run(work, success)
  }
  const retryGate = gate('sourceCheck')
  const control = (
    action: PostAction,
    work: (claim: number) => Promise<Saved>,
    success: string,
  ) => ({
    ...gate(action),
    run: (claim: number) => act(action, () => work(claim), success),
  })

  return (
    <section aria-labelledby={`${ids}-heading`} className="flex flex-col gap-6">
      <div className="flex items-center gap-2">
        <h2 id={`${ids}-heading`} className="text-h3">
          Source check
        </h2>
        {check && check.body.replays.length > 0 && <span className={tag}>Replay</span>}
      </div>

      {checking ? (
        <Working words="Checking against the source…" />
      ) : check ? (
        <CheckList
          claims={check.body.claims}
          controls={{
            pending,
            wording: control(
              'sourceWording',
              (claim) => actions.applySourceWordingAction(view.id, view.version, claim),
              "Source's wording used",
            ),
            remove: control(
              'removeClaim',
              (claim) => actions.removeClaimAction(view.id, view.version, claim),
              'Claim removed',
            ),
            opinion: control(
              'markOpinion',
              (claim) => actions.markOpinionAction(view.id, view.version, claim),
              'Marked as editorial opinion',
            ),
            research: {
              ...gate('researchClaim'),
              find: (claim) => actions.researchClaimAction(view.id, view.version, claim.text),
              add: (claim, page) =>
                act(
                  'addResearchSource',
                  () =>
                    actions.addResearchSourceAction(view.id, view.version, {
                      claim: claim.text,
                      url: page.url,
                      sentence: page.sentence,
                    }),
                  'Source added',
                ),
              addReason: editWaitError(
                'addResearchSource',
                viewer,
                view.stage,
                movesWait(view.running),
              ),
            },
          }}
        />
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-muted-foreground">
            {view.failed?.includes(CHECK_STEP)
              ? 'The source check failed. Your text is kept.'
              : 'Not checked on this version yet.'}
          </p>
          {retryGate.shown && (
            <Control reason={retryGate.reason}>
              <Button
                variant="outline"
                disabled={pending || retryGate.reason !== null}
                onClick={() =>
                  act(
                    'sourceCheck',
                    () => actions.checkSourceAction(view.id, view.version),
                    'Source check done',
                  )
                }
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
