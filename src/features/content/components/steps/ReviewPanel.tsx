'use client'

import { useRouter } from 'next/navigation'
import { type ReactNode, useId, useState } from 'react'
import { Button } from '@/shared/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import type { Staff } from '@/shared/lib/auth/access'
import { liveLine, tagsLine } from '../../lib/lines'
import { paragraphSite } from '../../lib/sites'
import { postPath, stepOfNote, stepOfStage, stepPath } from '../../lib/steps'
import {
  ACTION_STAGES,
  actionError,
  publishError,
  sendBackError,
  WORKFLOW_ERRORS,
} from '../../lib/workflow'
import { type Body, SEND_BACK_STEPS, type SendBackStep } from '../../model/artifacts'
import type { Fact } from '../../model/types'
import { findSlideSpec } from '../../templates'
import { firstChars } from '../../text/script'
import { FactChip } from '../FactChip'
import {
  Control,
  DownloadSlides,
  MarketSlides,
  Move,
  marketName,
  movesWait,
  RenderedSlides,
  StepAction,
  StepAreas,
  Toggle,
} from '../parts'
import { type ActionTab, type SlideHold, StepTabs, type TabHold, useHolds } from '../stage'
import { usePostAction } from '../usePostAction'
import type { WorkbenchActions, WorkbenchView } from '../Workbench'
import { ClaimRows } from './SourceCheckPanel'

export type ReviewPanelProps = {
  view: WorkbenchView
  viewer: Staff
  actions: Pick<WorkbenchActions, 'approvePublishAction' | 'sendBackAction' | 'withdrawAction'>
  /** A blog's article (BR5), in place of the slides. */
  article?: ReactNode
  /** The selected slide, held above the screen's version key (Workbench), so a save keeps it (GD24). */
  slide?: SlideHold
  /** The open tab beside the slides, held there too. */
  tab?: TabHold
}

const subheading = 'text-overline uppercase text-muted-foreground'

/** The tabs beside the slides: the facts each slot rests on, the source check, the feed settings. */
const FACTS_TAB = 'Facts'
const CHECK_TAB = 'Source check'
const SETTINGS_TAB = 'Feed settings'

/** The steps a request for changes names, as the reviewer picks them (criterion 120). */
const STEP_LABELS: Record<SendBackStep, string> = {
  structures: 'Text versions',
  covers: 'Covers',
  settings: 'Settings',
}

/** The facts each factual slot of the revision rests on, slide by slide, each naming its link (GD19). */
function FactRows(props: {
  revision: Body<'revision'>
  facts: Fact[]
  source: Body<'source'> | null
  checkedAt: string
}) {
  const { source } = props
  const byId = new Map(props.facts.map((f) => [f.id, f]))
  const { structure, template } = props.revision
  return (
    <ul className="flex flex-col gap-3">
      {structure.slides.flatMap((slide, i) => {
        const number = i + 1
        const spec = findSlideSpec(template, slide)
        return (spec?.slots ?? []).flatMap((slotSpec) => {
          const slot = slide.slots[slotSpec.key]
          const facts = (slot?.factIds ?? []).flatMap((id) => byId.get(id) ?? [])
          if (facts.length === 0) return []
          return [
            <li key={`${number}-${slotSpec.key}`} className="flex flex-col gap-1">
              <span className={subheading}>{`Slide ${number} · ${slotSpec.label}`}</span>
              {facts.map((f) => (
                <FactChip
                  key={f.id}
                  fact={f}
                  sourceTitle={source?.title ?? ''}
                  site={source ? paragraphSite(source, f.ref) : null}
                  checkedAt={props.checkedAt}
                />
              ))}
            </li>,
          ]
        })
      })}
    </ul>
  )
}

/**
 * The review (criteria 44–48, 60, 103): the stored slides, beside the market version's when there
 * is one, the fact chips, the source check and the feed settings, read-only. "Approve and publish"
 * makes the post live; "Request changes" asks for the step and a one-line note (criterion 120).
 * No slide vision check is shown or waited on. Nothing here changes the wording, the structure or
 * the settings. An editor may take the post back with "Withdraw from review" (criterion 115),
 * which waits while a step runs (122); once live, the panel is a summary. Each version shows on
 * its own stage, the same slide selected in both; the facts, the source check and the feed settings
 * are one tab each beside them.
 */
export function ReviewPanel({
  view,
  viewer,
  actions,
  article,
  slide: heldSlide,
  tab: heldTab,
}: ReviewPanelProps) {
  const { pending, run } = usePostAction()
  const ids = useId()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [step, setStep] = useState<SendBackStep | null>(null)
  // The slide shown, in both versions at once, and the open tab beside them: the workbench's when
  // it passes them, so a save keeps them (GD24).
  const { at: slide, onSelect: setSlide, tab } = useHolds(heldSlide, heldTab)
  const { render, revision, facts, source, sourceCheck, settings, market, layout } = view.current

  // Past the review (a live post) the panel is its summary: no decision is offered (criterion 111).
  const deciding = ACTION_STAGES.approvePublish.includes(view.stage)
  const canWithdraw = actionError('withdraw', viewer, view.stage) === null
  const approveGate = actionError('approvePublish', viewer, view.stage)
  const approveReason = approveGate ?? publishError(viewer)
  const sendBackGate = actionError('sendBack', viewer, view.stage)
  const reasonError = sendBackError(reason)
  const line = settings ? liveLine(settings.body) : null
  /** The market version's market by name, for its labels, when there is one (criterion 87). */
  const marketLabel = market ? marketName(market.body.market) : ''

  // Each decision moves the post on or back: the screen of the step it is then at opens (GD27).
  const router = useRouter()
  const goTo = (stage: 'live' | 'rendered') =>
    router.push(stepPath(view.id, stepOfStage(stage, false)))
  const approve = () =>
    run(
      () => actions.approvePublishAction(view.id, view.version),
      line ? `Published · ${line}` : 'Published',
      () => goTo('live'),
    )
  const sendBack = (named: SendBackStep) =>
    run(
      () => actions.sendBackAction(view.id, view.version, reason.trim(), named),
      'Changes requested',
      () => {
        setOpen(false)
        setReason('')
        setStep(null)
        // The step the note names opens; one naming none opens the post where it now is.
        const noted = stepOfNote(named)
        router.push(noted ? stepPath(view.id, noted) : postPath(view.id))
      },
    )

  // What the reviewer reads beside the slides, one tab at a time, the facts first.
  const tabs: ActionTab[] = [
    ...(revision && facts
      ? [
          {
            name: FACTS_TAB,
            body: (
              <FactRows
                revision={revision.body}
                facts={facts.body.facts}
                source={source?.body ?? null}
                checkedAt={view.createdAt}
              />
            ),
          },
        ]
      : []),
    {
      name: CHECK_TAB,
      body: sourceCheck ? (
        <ClaimRows claims={sourceCheck.body.claims} />
      ) : (
        <p className="text-muted-foreground">Not run on this version.</p>
      ),
    },
    {
      name: SETTINGS_TAB,
      body: (
        <div className="flex flex-col gap-2">
          <p className="text-caption">{line ?? 'No settings yet.'}</p>
          {settings && <p className="text-caption">{tagsLine(settings.body)}</p>}
          {settings?.body.whyLine && <p className="text-caption">{settings.body.whyLine}</p>}
        </div>
      ),
    },
  ]

  return (
    <section aria-labelledby={`${ids}-heading`} className="flex flex-col gap-8">
      <h2 id={`${ids}-heading`} className="sr-only">
        Review
      </h2>
      {canWithdraw && (
        <div className="flex items-center gap-2">
          <Move
            className="ml-auto items-end"
            label="Withdraw from review"
            waiting={movesWait(view.running)}
            pending={pending}
            onGo={() =>
              run(
                () => actions.withdrawAction(view.id, view.version),
                'Withdrawn from review',
                () => goTo('rendered'),
              )
            }
          />
        </div>
      )}

      <StepAreas
        slides={
          article ??
          (render && market ? (
            // Side by side while the area allows, each version on its own stage, the same slide
            // selected in both; from @5xl the rows share the frame's height, so each slide fits.
            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(20rem,100%),1fr))] gap-6 @5xl:min-h-0 @5xl:flex-1 @5xl:auto-rows-fr">
              <section
                aria-labelledby={`${ids}-default`}
                className="flex min-w-0 flex-col gap-2 @5xl:min-h-0"
              >
                <h3 id={`${ids}-default`} className={subheading}>
                  Default
                </h3>
                <RenderedSlides
                  render={render.body}
                  layout={layout?.body.slides}
                  stage
                  selected={slide}
                  onSelect={setSlide}
                />
              </section>
              <section
                aria-labelledby={`${ids}-market`}
                className="flex min-w-0 flex-col gap-2 @5xl:min-h-0"
              >
                <h3 id={`${ids}-market`} className={subheading}>
                  {marketLabel}
                </h3>
                <MarketSlides market={market.body} stage selected={slide} onSelect={setSlide} />
              </section>
            </div>
          ) : render ? (
            <RenderedSlides
              render={render.body}
              layout={layout?.body.slides}
              stage
              selected={slide}
              onSelect={setSlide}
            />
          ) : (
            <p className="text-muted-foreground">No render on this version.</p>
          ))
        }
        actions={
          <>
            <StepTabs label="Review panels" tabs={tabs} open={tab.open} onOpen={tab.onOpen} />
            {/* The default version's slides as a zip, in the step bar before the decision (18 Oct). */}
            {render && !article && <DownloadSlides postId={view.id} />}

            {deciding &&
              (approveGate !== WORKFLOW_ERRORS.notAuthorised ||
                sendBackGate !== WORKFLOW_ERRORS.notAuthorised) && (
                <StepAction>
                  <Control
                    reason={
                      approveGate === WORKFLOW_ERRORS.notAuthorised ? sendBackGate : approveReason
                    }
                  >
                    {approveGate !== WORKFLOW_ERRORS.notAuthorised && (
                      <Button disabled={pending || approveReason !== null} onClick={approve}>
                        Approve and publish
                      </Button>
                    )}
                    {sendBackGate !== WORKFLOW_ERRORS.notAuthorised && (
                      <Button
                        variant="outline"
                        disabled={pending || sendBackGate !== null}
                        onClick={() => setOpen(true)}
                      >
                        Request changes
                      </Button>
                    )}
                  </Control>
                </StepAction>
              )}
          </>
        }
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-h4">Request changes</DialogTitle>
            <DialogDescription className="text-caption text-muted-foreground">
              The post returns to Settings · check & send with your note beside the step you name.
              Its wording and settings stay as they are.
            </DialogDescription>
          </DialogHeader>
          <Toggle
            legend="Step"
            showLegend
            options={SEND_BACK_STEPS.map((value) => ({ value, label: STEP_LABELS[value] }))}
            value={step ?? ''}
            onChange={(v) => setStep(v === '' ? null : v)}
          />
          <div className="flex flex-col gap-2">
            <Label htmlFor={`${ids}-reason`}>Note</Label>
            <Input
              id={`${ids}-reason`}
              value={reason}
              onChange={(e) => setReason(firstChars(e.target.value, 200))}
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={pending || reasonError !== null || step === null}
              onClick={() => step && sendBack(step)}
            >
              Request changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}
