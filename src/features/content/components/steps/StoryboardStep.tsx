'use client'

import { useRouter } from 'next/navigation'
import { useId, useState } from 'react'
import { Button } from '@/shared/components/ui/button'
import type { Staff } from '@/shared/lib/auth/access'
import { cn } from '@/shared/lib/utils'
import { PRESETS } from '../../brands/guideline'
import { COMIC_PANELS, type PanelOp, panelOpsError, SCENE_MAX } from '../../lib/comic-rules'
import { runningReason } from '../../lib/running'
import { stepOfStage, stepPath } from '../../lib/steps'
import {
  actionError,
  approveStructureError,
  editWaitError,
  type PostAction,
  WORKFLOW_ERRORS,
} from '../../lib/workflow'
import type { Slide, SlotSpec } from '../../model/types'
import type { Saved } from '../../server/commands'
import { findSlideSpec } from '../../templates'
import type { EditableSlot } from '../EditableSlidePreview'
import {
  ChangesNote,
  Control,
  ReorderButtons,
  reasonText,
  Spin,
  StepAction,
  StepAreas,
  Working,
} from '../parts'
import { isLong, SlotField } from '../SlotField'
import { usePostAction } from '../usePostAction'
import type { WorkbenchActions, WorkbenchView } from '../Workbench'
import { ChosenSlides } from './text/ChosenVersion'
import { countOf, type Gate, type Item } from './text/shared'

export type StoryboardStepProps = {
  view: WorkbenchView
  viewer: Staff
  actions: Pick<
    WorkbenchActions,
    | 'editSlotAction'
    | 'measureSlotAction'
    | 'approveStructureAction'
    | 'editSceneAction'
    | 'editPanelsAction'
    | 'retryStoryAction'
  >
  /**
   * The selected panel and its setter, held above the screen's version key (Workbench) so a save
   * keeps the editor on her panel (GD24); its own when absent.
   */
  slide?: { selected: number; onSelect: (slide: number) => void }
}

const STORY_FAILED = "The story could not be written. The path's facts are kept."
/** The key the art area's slot saves under: the panel's planned scene, not a caption. */
const SCENE = 'scene'
/** A planned scene's length, as a slide's `scene` holds it. */
const SCENE_LIMIT: SlotSpec['limit'] = { unit: 'chars', min: 1, max: SCENE_MAX }

/** A panel's place on the slide, with the limit its field counts against (C1). */
type PanelSlot = EditableSlot & { limit: SlotSpec['limit'] }

/** The panel a message names ("Plan the scene for panel 4.", "Panel 2: …"), or null. */
function panelNamed(message: string): number | null {
  const n = /\bpanel (\d+)\b/i.exec(message)?.[1]
  return n === undefined ? null : Number(n)
}

/**
 * A panel's places on the slide (RC2): its caption where the template draws it, and its art area
 * holding the planned scene in words, edited like text and saved as the scene.
 */
function panelSlots(item: Item, slide: Slide): PanelSlot[] {
  const spec = findSlideSpec(item.template, slide)
  if (!spec) return []
  const captions = spec.slots.flatMap((s) => {
    const slot = slide.slots[s.key]
    return slot ? [{ key: s.key, label: s.label, box: s.box, text: slot.text, limit: s.limit }] : []
  })
  const scene: PanelSlot[] = spec.artBox
    ? [
        {
          kind: 'scene',
          key: SCENE,
          label: 'Planned scene',
          box: spec.artBox,
          text: slide.scene ?? '',
          limit: SCENE_LIMIT,
        },
      ]
    : []
  return [...scene, ...captions]
}

/** Where the panel an operation acted on is after it, counted from 1. */
function panelAfter(op: PanelOp, count: number): number {
  if (op.kind === 'add') return op.after + 2
  if (op.kind === 'move') return op.to + 1
  return Math.min(op.at + 1, count - 1)
}

/**
 * A comic's Text step, its storyboard (RC2–RC5), laid out as the chosen version's editor is (D1):
 * in the slides area the panels' film strip and the selected panel large, drawn by the server with
 * its caption where it will be drawn and its planned scene written in the art area, both edited in
 * place; beside it (GD30) the selected panel's fields with live counts (C1), its moves up and down,
 * "Add after" and its removal, within 3 to 6 panels, then the story's running, failure and "Try
 * again", and "Approve storyboard" in the step bar. A refusal shows with the panel it was for, or
 * the panel it names, and an edit's under its field. Past the gate an edit moves the post back by
 * itself (GD28); a viewer who may not edit sees the panels alone.
 */
export function StoryboardStep({ view, viewer, actions, slide }: StoryboardStepProps) {
  const { pending, run, error } = usePostAction()
  const router = useRouter()
  const ids = useId()
  const [ownPanel, setOwnPanel] = useState(1)
  const selection = slide ?? { selected: ownPanel, onSelect: setOwnPanel }
  const [busy, setBusy] = useState<PostAction | null>(null)
  // The panel the last action was for, where its refusal shows, and the field when it was an edit.
  const [actedOn, setActedOn] = useState<number | null>(null)
  const [actedSlot, setActedSlot] = useState<string | null>(null)

  const { pointers, current } = view
  const drafts = current.drafts
  const item = pointers.picked === null ? undefined : drafts?.body.items[pointers.picked]
  const slides = item?.structure.slides ?? []
  const themeId = pointers.themeId ?? PRESETS[0]

  const running = (steps: readonly string[]) =>
    runningReason(
      steps.map((step) => ({ step, progress: view.progress?.[step] })),
      { comic: true },
    )
  const anyRunning = running(view.running)
  const gate = (action: PostAction): Gate => {
    const reason = editWaitError(action, viewer, view.stage, anyRunning)
    return { shown: reason !== WORKFLOW_ERRORS.notAuthorised, reason }
  }
  const editing =
    view.stage === 'structures' || actionError('editSlot', viewer, view.stage) === null
  const drafting = view.running.includes('draft') || (pending && busy === 'draft')
  const failed = !drafting && !drafts && (view.failed?.includes('draft') ?? false)

  const act = (
    action: PostAction,
    panel: number | null,
    work: () => Promise<Saved>,
    success: string,
    onDone?: () => void,
  ) => {
    setBusy(action)
    setActedOn(panel)
    setActedSlot(null)
    run(work, success, onDone)
  }

  const editGate = gate('editSlot')
  const sceneGate = gate('editScene')
  const panelsGate = gate('editPanels')
  const approveGate = gate('approve')
  const draftGate = gate('draft')
  const approveReason = approveGate.reason ?? approveStructureError(pointers, current)

  // Each message under the panel it is for: the last refusal, and why approving waits.
  const refusals = new Map<number, Set<string>>()
  const place = (message: string | null, panel: number | null) => {
    if (message === null || panel === null) return
    refusals.set(panel, (refusals.get(panel) ?? new Set()).add(message))
  }
  // An edit's refusal shows under its field instead (C1).
  const fieldError = error && actedSlot !== null ? error : null
  if (error && !fieldError) place(error, panelNamed(error) ?? actedOn)
  if (approveGate.reason === null && approveReason) place(approveReason, panelNamed(approveReason))
  const loose = error && (panelNamed(error) ?? actedOn) === null ? error : null

  // Why a panel cannot be added or removed: said once, beside the panels.
  const limit = panelOpsError(slides.length, { kind: 'add', after: 0 })
    ? `A comic has at most ${COMIC_PANELS.max} panels.`
    : panelOpsError(slides.length, { kind: 'remove', at: 0 })
      ? `A comic has at least ${COMIC_PANELS.min} panels.`
      : null

  const opLabel = (op: PanelOp) =>
    op.kind === 'add' ? 'Panel added' : op.kind === 'remove' ? 'Panel removed' : 'Panel moved'
  // The panel acted on stays selected where it went.
  const change = (n: number, op: PanelOp) =>
    act(
      'editPanels',
      n,
      () => actions.editPanelsAction(view.id, view.version, op),
      opLabel(op),
      () => selection.onSelect(panelAfter(op, slides.length)),
    )
  const save = (n: number, slot: string, text: string) => {
    if (slot === SCENE)
      act(
        'editScene',
        n,
        () => actions.editSceneAction(view.id, view.version, { slide: n, text }),
        'Scene saved',
      )
    else
      act(
        'editSlot',
        n,
        () => actions.editSlotAction(view.id, view.version, { slide: n, slot, text }),
        'Caption saved',
      )
    setActedSlot(slot)
  }
  const measure = async (n: number, slot: string, text: string) => {
    const measured = await actions.measureSlotAction(view.id, view.version, {
      slide: n,
      slot,
      text,
    })
    return measured.ok ? measured.rows : null
  }

  const canEditText = editing && editGate.shown && editGate.reason === null
  const canEditScene = editing && sceneGate.shown && sceneGate.reason === null
  const panelOp = (op: PanelOp) =>
    pending || panelsGate.reason !== null || panelOpsError(slides.length, op) !== null

  // The selected panel, within the story, and its places as far as this viewer may edit them.
  const n = Math.max(1, Math.min(selection.selected, slides.length))
  const i = n - 1
  const shown = item ? slides[i] : undefined
  const slots =
    item && shown
      ? panelSlots(item, shown).filter((s) => (s.kind === 'scene' ? canEditScene : canEditText))
      : []

  return (
    <section aria-labelledby={`${ids}-heading`} className="flex flex-col gap-8">
      <h2 id={`${ids}-heading`} className="text-h3">
        Storyboard
      </h2>
      {current.sendBack?.body.step === 'structures' && (
        <ChangesNote sendBack={current.sendBack.body} />
      )}

      <StepAreas
        slides={
          item && drafts ? (
            <ChosenSlides
              view={view}
              draftsId={drafts.id}
              index={pointers.picked ?? 0}
              item={item}
              themeId={themeId}
              pending={pending}
              editGate={editGate}
              selected={n}
              onSelect={selection.onSelect}
              onEdit={save}
              onMeasure={measure}
              slotsOf={() => slots}
            />
          ) : drafting ? null : (
            <p className="text-muted-foreground">No storyboard yet.</p>
          )
        }
        actions={
          <>
            {shown && (
              <article aria-label={`Panel ${n}`} className="flex flex-col gap-4">
                <h3 className="text-h4">{`Panel ${n}`}</h3>
                {slots.map((s) => (
                  <SlotField
                    key={`${n}:${s.key}`}
                    label={s.label}
                    value={s.text}
                    long={isLong(s.limit)}
                    disabled={pending}
                    count={(text) => countOf(text, s.limit)}
                    error={actedOn === n && actedSlot === s.key ? fieldError : null}
                    onSave={(text) => save(n, s.key, text)}
                  />
                ))}
                {editing && panelsGate.shown && (
                  <div className="flex flex-wrap items-center gap-2">
                    <ReorderButtons
                      name={`panel ${n}`}
                      up={{
                        disabled: panelOp({ kind: 'move', at: i, to: i - 1 }),
                        onClick: () => change(n, { kind: 'move', at: i, to: i - 1 }),
                      }}
                      down={{
                        disabled: panelOp({ kind: 'move', at: i, to: i + 1 }),
                        onClick: () => change(n, { kind: 'move', at: i, to: i + 1 }),
                      }}
                      remove={{
                        disabled: panelOp({ kind: 'remove', at: i }),
                        onClick: () => change(n, { kind: 'remove', at: i }),
                      }}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      aria-label={`Add after panel ${n}`}
                      disabled={panelOp({ kind: 'add', after: i })}
                      onClick={() => change(n, { kind: 'add', after: i })}
                    >
                      Add after
                    </Button>
                  </div>
                )}
                {[...(refusals.get(n) ?? [])].map((message) => (
                  <p key={message} className={cn(reasonText, 'text-destructive')}>
                    {message}
                  </p>
                ))}
              </article>
            )}
            {drafting && <Working words={running(['draft']) ?? ''} />}
            {failed && draftGate.shown && (
              <div className="flex flex-col gap-2">
                <p className={reasonText}>{STORY_FAILED}</p>
                <Control reason={draftGate.reason}>
                  <Button
                    disabled={pending || draftGate.reason !== null}
                    onClick={() =>
                      act(
                        'draft',
                        null,
                        () => actions.retryStoryAction(view.id, view.version),
                        'Storyboard drafted',
                      )
                    }
                  >
                    {pending && busy === 'draft' && <Spin />}
                    Try again
                  </Button>
                </Control>
              </div>
            )}
            {editing && panelsGate.shown && limit && <p className={reasonText}>{limit}</p>}
            {loose && <p className={cn(reasonText, 'text-destructive')}>{loose}</p>}

            {/* Approving is the text step's own; from a passed step an edit moves the post back first. */}
            {view.stage === 'structures' && drafts && approveGate.shown && (
              <StepAction>
                <Control reason={approveReason}>
                  <Button
                    disabled={pending || approveReason !== null}
                    onClick={() =>
                      act(
                        'approve',
                        null,
                        () => actions.approveStructureAction(view.id, view.version),
                        'Storyboard approved · on to the panels',
                        () => router.push(stepPath(view.id, stepOfStage('approved', false))),
                      )
                    }
                  >
                    Approve storyboard
                  </Button>
                </Control>
              </StepAction>
            )}
          </>
        }
      />
    </section>
  )
}
