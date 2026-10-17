'use client'

import { useRouter } from 'next/navigation'
import { type ReactNode, useEffect, useId, useRef, useState } from 'react'
import { Blueprint } from '@/shared/components/Blueprint'
import { Button } from '@/shared/components/ui/button'
import { Checkbox } from '@/shared/components/ui/checkbox'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { NativeSelect } from '@/shared/components/ui/native-select'
import { Spin, Working } from '@/shared/components/Working'
import type { Staff } from '@/shared/lib/auth/access'
import { cn } from '@/shared/lib/utils'
import { FEED_BRAND, FEED_POST_PAGES, PAGE_BRANDS } from '../../brands'
import type { Preset } from '../../brands/guideline'
import { EMOTION_MAX, EMOTIONS, emotionById } from '../../emotions'
import { LAYOUT_LABELS } from '../../layout/relayout'
import { stepOfStage, stepPath } from '../../lib/steps'
import {
  firstReady,
  themeOrDefault,
  type VersionStatus,
  versionLetter,
  versionStatus,
} from '../../lib/version-status'
import {
  actionError,
  approveStructureError,
  editWaitError,
  type PostAction,
  WORKFLOW_ERRORS,
} from '../../lib/workflow'
import { TEXT_NUDGES } from '../../nudges'
import type { Saved } from '../../server/commands'
import { isLook, LEGACY_TEMPLATES, LOOKS, TEMPLATES, ticksLegacy } from '../../templates'
import { firstChars } from '../../text/script'
import {
  ChangesNote,
  Control,
  FailedLine,
  movesWait,
  reasonText,
  StepAction,
  StepAreas,
  StepBack,
  Toggle,
  tag,
} from '../parts'
import { SlidePreview } from '../SlidePreview'
import { type ActionTab, holdOnWork, StepTabs, shownTab, type TabHold } from '../stage'
import { usePressedAction } from '../usePostAction'
import type { WorkbenchActions, WorkbenchView } from '../Workbench'
import { CheckResults } from './text/CheckResults'
import { ChosenStage, ChosenVersion } from './text/ChosenVersion'
import { type CheckState, type Gate, type Item, statusText, wordsOf } from './text/shared'
import { VersionDetails } from './text/VersionDetails'

export type StructuresStepProps = {
  view: WorkbenchView
  viewer: Staff
  actions: Pick<
    WorkbenchActions,
    | 'tickTemplatesAction'
    | 'draftAction'
    | 'pickAction'
    | 'themeAction'
    | 'fixUnboundAction'
    | 'editSlotAction'
    | 'measureSlotAction'
    | 'redraftSlideAction'
    | 'nudgeSlideAction'
    | 'nudgeVersionAction'
    | 'setSlideLayoutAction'
    | 'setLookAction'
    | 'setPresetAction'
    | 'applySourceWordingAction'
    | 'checkSourceAction'
    | 'approveStructureAction'
    | 'choosePageAction'
  >
  /** A look post's way back to its idea cards, which keeps the versions (Workbench shows them). */
  onBackToIdeas?: () => void
  /**
   * The picked version's selected slide and its setter, held above the screen's version key
   * (Workbench) so a save does not send the editor back to slide 1 (GD24); its own when absent.
   */
  slide?: { selected: number; onSelect: (slide: number) => void }
  /** The open tab of the actions area by its name, held above the version key as `slide` is. */
  tab?: TabHold
}

/** The chosen option of a toggle (Emotion, Colours, Theme): filled with its border, as FeedChips marks one. */
const pressed = 'border-primary bg-accent-200 text-foreground'

/** The source check's step, as server/commands/check.ts runs it. */
const CHECK_STEP = 'source_check'
const DRAFT_FAILED = 'Drafting failed. Your facts are kept.'
/** A text chip on a whole version, as server/commands/structures.ts runs it (NUDGE_VERSION_STEP). */
const VERSION_STEP = 'nudge_version'

/** A look post's two colour presets (GD9), as setPreset takes them. */
const PRESET_OPTIONS: { id: Preset; label: string }[] = [
  { id: 'pop', label: 'Pop' },
  { id: 'subdued', label: 'Subdued' },
]

/**
 * A press running, by its action, and what it is on: a version's chip (`index`, `nudge`), a slide's
 * chip (`slide`, `nudge`, and `via` the one pressed, "Shorten it" or a chip under the slide) or its
 * take (`slide`).
 */
type Press = {
  action: PostAction
  index?: number
  slide?: number
  nudge?: string
  via?: 'shorten' | 'chip'
}

/**
 * The text step (GD25): a look post's versions drafted for its idea (GD2), an older post's for its
 * ticked templates (criteria 25–35, 69, 97). The screen fits the step's frame: the picked
 * version's selected slide large over its filmstrip (SlideStage) in the slides area, edited in
 * place (GD24), and beside it (GD30) the controls as tabs (StepTabs): "Your version", its text
 * with counts and the chips and layouts that change it; "Versions", each a compact card with its
 * first slide, angle, one status tag and its problems in sentences, its slot list, fact chips and
 * fit checks in a "Details" drawer (GD22, GD23); "Style", the page and the colours; "Redraft", the
 * drafting; last, "Checks", the picked version's checks, what is left to fix first, one card each
 * with its fix, counted on the tab (17 Oct). Its source check, which runs by itself after each
 * save, shows each flagged sentence with the source sentence it should match (criteria 98, 104).
 * An action bar that stays in view approves the text across the render gate; refused while
 * something is left to fix, its reason counts it and points to Checks. A look post chooses Pop or
 * Subdued (GD9); a post drafted before those choices shows the default colours as chosen, and is
 * approved in them (themeOrDefault). Past the gate the step stays
 * editable in place: an edit moves the post back to it by itself, with no "Back to" and no confirm,
 * and says what will be made again (GD28), and waits while any step of the post runs (122); a
 * viewer who may not edit sees the approved structure read-only. Versions arriving with none
 * picked get the first Ready one picked for the editor (GD29). A reviewer's request for changes naming
 * the text versions shows under the heading (criterion 120). Each control asks actionError: "Not
 * authorised." hides it, any other refusal disables it with the reason beside it.
 */
export function StructuresStep({
  view,
  viewer,
  actions,
  onBackToIdeas,
  slide,
  tab: heldTab,
}: StructuresStepProps) {
  const { pending, run, error, current: press, last } = usePressedAction<Press>()
  const router = useRouter()
  // The press running for `action`, with what it is on, or null.
  const pressing = (action: PostAction) => (press?.action === action ? press : null)
  // The slot the last edit was for, where its refusal shows (C1).
  const [edited, setEdited] = useState<{ slide: number; slot: string } | null>(null)
  const [ticks, setTicks] = useState<string[]>(view.pointers.ticked)
  // The picked version's selected slide, held by the workbench when it passes one (GD24).
  const [ownSlide, setOwnSlide] = useState(1)
  const selection = slide ?? { selected: ownSlide, onSelect: setOwnSlide }
  // The open tab, held by the workbench when it passes one, so a save keeps it.
  const [ownTab, setOwnTab] = useState<string | null>(null)
  const tab = heldTab ?? { open: ownTab, onOpen: setOwnTab }
  const ids = useId()

  const { pointers, current } = view
  const drafts = current.drafts
  const items = drafts?.body.items ?? []
  // A look post (GD4) picks an idea, a look and a preset; a post from before keeps its template
  // ticks and themes (GD8).
  const lookPost =
    items.length > 0 ? items.some((item) => isLook(item.template)) : current.ideas !== null
  const idea = drafts?.body.idea ?? null
  // "For: <angle>": the idea the versions serve (GD2), above them and on each card.
  const forLine = idea ? `For: ${idea.cards.map((c) => c.angle).join(' + ')}` : null
  // The emotion for the next draft (criterion 100): a chip, or the editor's own word in its place,
  // starting from what the drafts record stores.
  const stored = drafts?.body.emotion ?? null
  const [chip, setChip] = useState<string | null>(
    stored !== null && emotionById(stored) ? stored : null,
  )
  const [ownWord, setOwnWord] = useState(stored !== null && !emotionById(stored) ? stored : '')
  const emotion = ownWord.trim() || chip
  const facts = current.facts?.body.facts ?? []
  // A passed Text step is edited in place, the edit moving the post back by itself (GD28); a
  // viewer who may not edit sees the approved version alone.
  const editing =
    view.stage === 'structures' || actionError('editSlot', viewer, view.stage) === null
  const drafting = view.running.includes('draft') || pressing('draft') !== null
  // The last drafting failed, the one "Make post" started or one pressed (criterion 93).
  const draftFailed = !drafting && (view.failed?.includes('draft') ?? false)
  const checking = view.running.includes(CHECK_STEP) || pressing('sourceCheck') !== null

  // At a passed step every edit waits while any step of the post runs (criterion 122).
  const anyRunning = movesWait(view.running, view.progress)
  const gate = (action: PostAction): Gate => {
    const error = editWaitError(action, viewer, view.stage, anyRunning)
    return { shown: error !== WORKFLOW_ERRORS.notAuthorised, reason: error }
  }
  /** A press of `action`, run as the step's presses are (usePressedAction), `on` what it is on. */
  const act = (
    action: PostAction,
    work: () => Promise<Saved>,
    success: string,
    options: { onDone?: () => void; on?: Omit<Press, 'action'> } = {},
  ) => run(work, success, { onDone: options.onDone, press: { action, ...options.on } })

  // A post from before the looks ticks from its own templates (GD8).
  const offered = ticksLegacy(pointers.ticked) ? LEGACY_TEMPLATES : TEMPLATES
  const toggle = (id: string, on: boolean) =>
    setTicks((now) => {
      const next = on ? [...now, id] : now.filter((t) => t !== id)
      // Template order, so the same ticks always ask for the drafts in the same order.
      return offered.map((t) => t.id).filter((t) => next.includes(t))
    })
  const ticksSaved =
    ticks.length === pointers.ticked.length && ticks.every((t, i) => t === pointers.ticked[i])
  const ticksReason = ticks.length < 1 || ticks.length > 3 ? WORKFLOW_ERRORS.ticks : null

  const draft = (again: boolean) =>
    act(
      'draft',
      async () => {
        let at = view.version
        if (!ticksSaved) {
          const saved = await actions.tickTemplatesAction(view.id, at, ticks)
          if (!saved.ok) return saved
          at = saved.version
        }
        return actions.draftAction(view.id, at, again, emotion)
      },
      'Structures drafted',
    )

  const tickGate = gate('tick')
  const draftGate = gate('draft')
  const draftReason = draftGate.reason ?? ticksReason
  const themeGate = gate('theme')
  const approveGate = gate('approve')
  const themeId = themeOrDefault(pointers.themeId, items)
  const pageGate = gate('page')
  // Posts saved before pages had one carry no key (criterion 105).
  const pageId = pointers.pageBrandId ?? null
  const pageName = PAGE_BRANDS.find((b) => b.id === pageId)?.name ?? 'None'

  const editGate = gate('editSlot')
  const edit = (slide: number, slot: string, text: string) => {
    setEdited({ slide, slot })
    act(
      'editSlot',
      () => actions.editSlotAction(view.id, view.version, { slide, slot, text }),
      'Text saved',
    )
  }
  const editError = last?.action === 'editSlot' && error && edited ? { ...edited, error } : null
  // The picked version, edited on its slides before the gate (GD24), for a viewer who may edit.
  const chosenItem = pointers.picked === null ? undefined : items[pointers.picked]
  const chosen =
    editing && editGate.shown && chosenItem && pointers.picked !== null
      ? { item: chosenItem, index: pointers.picked }
      : null
  // Past the gate only the approved structure shows, and before it the picked version shows in
  // its editor instead. A template's versions sit consecutively in the flattened list (criterion
  // 97), so each run of one template is a row; `index` stays the flattened one `picked` uses.
  const rows: { templateId: string; name: string; cards: { item: Item; index: number }[] }[] = []
  for (const [index, item] of (drafts?.body.items ?? []).entries()) {
    if (!editing && index !== pointers.picked) continue
    if (chosen?.index === index) continue
    const last = rows.at(-1)
    const card = { item, index }
    if (last?.templateId === item.template.id) last.cards.push(card)
    else rows.push({ templateId: item.template.id, name: item.template.name, cards: [card] })
  }
  // The source check counts for the picked version only (criterion 98).
  const claimsOf = (index: number) =>
    index === pointers.picked && editing ? (current.sourceCheck?.body.claims ?? []) : []
  const statusOf = (index: number, item: Item) =>
    versionStatus(item, view.draftChecks[index] ?? [], facts, claimsOf(index))
  const chosenStatus = chosen ? statusOf(chosen.index, chosen.item) : null
  // Versions arrived with none picked: the first Ready one is picked for the editor, once per
  // drafts record, and they may pick another (GD29).
  const pickGate = gate('pick')
  const autoPick =
    view.stage === 'structures' &&
    pointers.picked === null &&
    !drafting &&
    !pending &&
    pickGate.reason === null
      ? firstReady(items.map((item, index) => statusOf(index, item)))
      : null
  const autoPicked = useRef<string | null>(null)
  const draftsId = drafts?.id ?? null
  useEffect(() => {
    if (autoPick === null || draftsId === null || autoPicked.current === draftsId) return
    autoPicked.current = draftsId
    run(() => actions.pickAction(view.id, view.version, autoPick), 'Version picked', {
      press: { action: 'pick' },
    })
  }, [autoPick, draftsId, run, actions, view.id, view.version])
  const fixUnbound = (slide: number, slot: string, factId: string) =>
    act(
      'fixUnbound',
      () => actions.fixUnboundAction(view.id, view.version, { slide, slot, factId }),
      'Claim bound to a supported fact',
    )
  const check: CheckState = {
    claims: current.sourceCheck?.body.claims ?? null,
    running: checking,
    failed: view.failed?.includes(CHECK_STEP) ?? false,
    wordingGate: gate('sourceWording'),
    retryGate: gate('sourceCheck'),
    onUseWording: (claim) =>
      act(
        'sourceWording',
        () => actions.applySourceWordingAction(view.id, view.version, claim),
        "Source's wording used",
      ),
    onTryAgain: () =>
      act(
        'sourceCheck',
        () => actions.checkSourceAction(view.id, view.version),
        'Source check done',
      ),
  }
  /** A version's details in their drawer, opened by "Details", with its `controls` first. */
  const details = (index: number, item: Item, controls?: ReactNode) => (
    <VersionDetails
      title={`Version ${versionLetter(index)} · ${item.angle || item.template.name}`}
      controls={controls}
      view={view}
      item={item}
      facts={facts}
      checks={view.draftChecks[index] ?? []}
      claims={claimsOf(index)}
      live={editing && index === pointers.picked}
      editing={editing}
      pending={pending}
      fixGate={gate('fixUnbound')}
      check={check}
      onFix={fixUnbound}
    />
  )

  const lookGate = gate('setLook')
  const versionNudgeGate = gate('nudgeVersion')
  const presetGate = gate('setPreset')
  const versionRunning = view.running.includes(VERSION_STEP)
  /**
   * A look version's look switch and text chips (GD4, GD10), before the gate. The chosen version
   * has the selected slide's chips instead, so it gets the look switch alone: one chip row.
   */
  const versionControls = (index: number, item: Item, chips = true): ReactNode =>
    editing && isLook(item.template) ? (
      <VersionControls
        letter={versionLetter(index)}
        look={item.template.id}
        lookGate={lookGate}
        nudgeGate={chips ? versionNudgeGate : { shown: false, reason: null }}
        running={versionRunning}
        rewriting={pressing('nudgeVersion')?.index === index ? (press?.nudge ?? null) : null}
        pending={pending}
        onLook={(look) =>
          act(
            'setLook',
            () => actions.setLookAction(view.id, view.version, { index, look }),
            `Look: ${LOOKS.find((t) => t.id === look)?.name ?? look}`,
          )
        }
        onNudge={(nudge, label) =>
          act(
            'nudgeVersion',
            () => actions.nudgeVersionAction(view.id, view.version, { index, nudge }),
            `Version ${versionLetter(index)}: ${label}`,
            { on: { index, nudge } },
          )
        }
      />
    ) : null

  // One row per template: its versions side by side (criterion 29), more scroll inside it; the
  // padding keeps frame marks unclipped.
  const versionRows = rows.map((row) => (
    <div key={`${row.templateId}-${row.cards[0].index}`} className="flex flex-col gap-4">
      <h3 className="text-h4">{row.name}</h3>
      <div className="-m-2 grid grid-flow-col auto-cols-[minmax(12rem,1fr)] items-start gap-4 overflow-x-auto p-2">
        {row.cards.map(({ item, index }) => (
          <VersionCard
            key={index}
            view={view}
            draftsId={drafts?.id ?? ''}
            index={index}
            item={item}
            status={statusOf(index, item)}
            themeId={themeId}
            editing={editing}
            pending={pending}
            pickGate={pickGate}
            idea={forLine}
            details={details(index, item, versionControls(index, item))}
            onPick={() =>
              act('pick', () => actions.pickAction(view.id, view.version, index), 'Version picked')
            }
          />
        ))}
      </div>
    </div>
  ))

  const pageControl = pageGate.shown ? (
    <div className="flex max-w-sm flex-col gap-2">
      <Label htmlFor={`${ids}-page`}>Page</Label>
      <NativeSelect
        id={`${ids}-page`}
        value={pageId ?? ''}
        aria-describedby={`${ids}-page-note`}
        disabled={pending || drafting || pageGate.reason !== null}
        onChange={(e) => {
          const next = e.target.value === '' ? null : e.target.value
          act(
            'page',
            () => actions.choosePageAction(view.id, view.version, next),
            `Page chosen · ${PAGE_BRANDS.find((b) => b.id === next)?.name ?? 'None'}`,
          )
        }}
      >
        <option value="">None</option>
        {FEED_POST_PAGES.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </NativeSelect>
      <p id={`${ids}-page-note`} className={reasonText}>
        Drafts and covers made from now on follow its design language, if it has one.
      </p>
    </div>
  ) : (
    <p className="text-caption">{`Page: ${pageName}`}</p>
  )

  const coloursControl = drafts && lookPost && (
    <div className="flex flex-col gap-4">
      <h3 className="text-h4">Colours</h3>
      {presetGate.shown ? (
        <Control reason={presetGate.reason}>
          {PRESET_OPTIONS.map((p) => (
            <Button
              key={p.id}
              variant="outline"
              aria-pressed={themeId === p.id}
              className={cn(themeId === p.id && pressed)}
              disabled={pending || presetGate.reason !== null}
              onClick={() =>
                act(
                  'setPreset',
                  () => actions.setPresetAction(view.id, view.version, p.id),
                  `Colours · ${p.label}`,
                )
              }
            >
              {p.label}
            </Button>
          ))}
        </Control>
      ) : (
        <ul className="flex flex-wrap gap-4 text-caption">
          {PRESET_OPTIONS.map((p) => (
            <li key={p.id} className={cn(tag, themeId === p.id && 'border-primary')}>
              {p.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  )

  const themeControl = drafts && !lookPost && (
    <div className="flex flex-col gap-4">
      <h3 className="text-h4">Theme</h3>
      {themeGate.shown ? (
        <Control reason={themeGate.reason}>
          {FEED_BRAND.themes.map((t) => (
            <Button
              key={t.id}
              variant="outline"
              aria-pressed={themeId === t.id}
              className={cn(themeId === t.id && pressed)}
              disabled={pending || themeGate.reason !== null}
              onClick={() =>
                act(
                  'theme',
                  () => actions.themeAction(view.id, view.version, t.id),
                  `Theme chosen · ${t.name}`,
                )
              }
            >
              {t.name}
            </Button>
          ))}
        </Control>
      ) : (
        <ul className="flex flex-wrap gap-4 text-caption">
          {FEED_BRAND.themes.map((t) => (
            <li key={t.id} className={cn(tag, themeId === t.id && 'border-primary')}>
              {t.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  )

  const draftControl = (
    <fieldset className="flex flex-col gap-4">
      <legend className="mb-4 text-h4">{lookPost ? 'Draft' : 'Templates'}</legend>
      {lookPost ? null : tickGate.shown ? (
        <ul className="grid grid-cols-2 gap-x-8 gap-y-2">
          {offered.map((t) => (
            <li key={t.id} className="flex items-center gap-2">
              <Checkbox
                id={`${ids}-${t.id}`}
                checked={ticks.includes(t.id)}
                disabled={pending || drafting || tickGate.reason !== null}
                onCheckedChange={(on) => toggle(t.id, on === true)}
              />
              <Label htmlFor={`${ids}-${t.id}`}>{t.name}</Label>
              <span className={reasonText}>{t.format}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-caption">
          {pointers.ticked.length === 0
            ? 'No templates ticked'
            : `Ticked: ${offered
                .filter((t) => pointers.ticked.includes(t.id))
                .map((t) => t.name)
                .join(', ')}`}
        </p>
      )}
      {draftGate.shown && (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-overline uppercase text-muted-foreground">Emotion</legend>
          <div className="flex flex-wrap items-center gap-2">
            {EMOTIONS.map((e) => (
              <Button
                key={e.id}
                type="button"
                variant="outline"
                size="sm"
                aria-pressed={chip === e.id}
                className={cn(chip === e.id && pressed)}
                disabled={pending || drafting}
                onClick={() => {
                  setChip(chip === e.id ? null : e.id)
                  setOwnWord('')
                }}
              >
                {e.label}
              </Button>
            ))}
            <Input
              aria-label="Your own word"
              placeholder="Your own word"
              value={ownWord}
              disabled={pending || drafting}
              className="w-48"
              onChange={(e) => {
                setOwnWord(firstChars(e.target.value, EMOTION_MAX))
                setChip(null)
              }}
            />
          </div>
        </fieldset>
      )}
      {draftGate.shown && draftFailed && (
        <FailedLine words={DRAFT_FAILED} reason={view.failedReasons?.draft} />
      )}
      {draftGate.shown && (
        <Control reason={draftReason}>
          {drafting ? (
            <>
              <Button variant={drafts ? 'outline' : 'default'} disabled>
                <Spin />
                Running…
              </Button>
              <Working words={movesWait(['draft'], view.progress) ?? ''} />
            </>
          ) : (
            <>
              {!(lookPost && drafts) && (
                // Once versions exist, approving is the step's one filled action.
                <Button
                  variant={drafts ? 'outline' : 'default'}
                  disabled={pending || draftReason !== null}
                  onClick={() => draft(false)}
                >
                  {draftFailed && !drafts ? 'Try again' : 'Draft versions'}
                </Button>
              )}
              {drafts && (
                <Button
                  variant="outline"
                  disabled={pending || draftReason !== null}
                  onClick={() => draft(true)}
                >
                  Draft again
                </Button>
              )}
            </>
          )}
        </Control>
      )}
    </fieldset>
  )

  const nudgeSlide = (slide: number, nudge: string, label: string, via: 'shorten' | 'chip') =>
    act(
      'nudgeSlide',
      () => actions.nudgeSlideAction(view.id, view.version, { slide, nudge }),
      `Slide ${slide}: ${label}`,
      { on: { slide, nudge, via } },
    )
  const chosenEditor = chosen && (
    <ChosenVersion
      selected={selection.selected}
      rewriting={pressing('nudgeSlide')}
      taking={pressing('redraftSlide')?.slide ?? null}
      view={view}
      item={chosen.item}
      facts={facts}
      pending={pending}
      claims={claimsOf(chosen.index)}
      takeGate={gate('redraftSlide')}
      nudgeGate={gate('nudgeSlide')}
      layoutGate={gate('setSlideLayout')}
      editGate={editGate}
      editError={editError}
      controls={versionControls(chosen.index, chosen.item, false)}
      onEdit={edit}
      onTake={(slide) =>
        act(
          'redraftSlide',
          () => actions.redraftSlideAction(view.id, view.version, slide),
          `Another take on slide ${slide}`,
          { on: { slide } },
        )
      }
      onNudge={nudgeSlide}
      onLayout={(slide, layout) =>
        act(
          'setSlideLayout',
          () =>
            actions.setSlideLayoutAction(view.id, view.version, {
              index: chosen.index,
              slide,
              layout,
            }),
          `Slide ${slide}: ${LAYOUT_LABELS[layout]}`,
        )
      }
    />
  )

  // The picked version's checks (17 Oct): what is left to fix first, one card each with its fix,
  // then the source check and the fit table; counted on the tab, as a problem, while any is left.
  // The approval's own refusal is listed too unless it is the unbound claims, listed one by one.
  const approveProblem = approveStructureError(pointers, current)
  const blocking = approveProblem === WORKFLOW_ERRORS.unbound ? null : approveProblem
  const toFix = chosenStatus ? chosenStatus.problems.length + (blocking ? 1 : 0) : 0
  // Refused while something is left to fix: the reason counts it and points to the tab.
  const approveReason =
    approveGate.reason ??
    (approveProblem !== null && toFix > 0 ? `${toFix} to fix: open Checks` : approveProblem)
  const checkResults: ActionTab | null =
    chosen && chosenStatus
      ? {
          name: 'Checks',
          badge: toFix > 0 ? { text: `${toFix} to fix`, problem: true } : undefined,
          body: (
            <CheckResults
              status={chosenStatus}
              item={chosen.item}
              blocking={blocking}
              checks={view.draftChecks[chosen.index] ?? []}
              claims={claimsOf(chosen.index)}
              facts={facts}
              check={check}
              running={view.running}
              pending={pending}
              rewriting={pressing('nudgeSlide')}
              nudgeGate={gate('nudgeSlide')}
              fixGate={gate('fixUnbound')}
              onNudge={nudgeSlide}
              onFix={fixUnbound}
              onOpenTab={tab.onOpen}
            />
          ),
        }
      : null
  // The actions area's groups, one tab each (StepTabs): the picked version's editor, the versions,
  // the page and colours, the drafting, and last the checks. Before any versions, drafting comes first.
  const yours: ActionTab | null = chosenEditor ? { name: 'Your version', body: chosenEditor } : null
  const versions: ActionTab = {
    name: 'Versions',
    badge: { text: String(rows.reduce((n, row) => n + row.cards.length, 0)) },
    body:
      rows.length === 0 ? (
        <p className="text-muted-foreground">No versions drafted yet.</p>
      ) : (
        <div className="flex flex-col gap-8">{versionRows}</div>
      ),
  }
  const style: ActionTab | null = editing
    ? {
        name: 'Style',
        body: (
          <>
            {pageControl}
            {coloursControl}
            {themeControl}
          </>
        ),
      }
    : null
  const redraft: ActionTab | null = editing
    ? { name: drafts ? 'Redraft' : 'Draft', body: draftControl }
    : null
  const tabs = (drafts ? [yours, versions, style, redraft, checkResults] : [redraft, style]).filter(
    (t): t is ActionTab => t !== null,
  )
  // The open tab, by its name: the one the editor opened while it shows, else the first. Once a
  // version is picked, the tab shown is held when she works in the step, so tabs coming and going
  // do not take her from where she is.
  const hold = checkResults ? holdOnWork(tab, tabs[shownTab(tabs, tab.open)]?.name) : {}

  return (
    <section aria-labelledby={`${ids}-heading`} className="flex flex-col gap-8" {...hold}>
      <h2 id={`${ids}-heading`} className="sr-only">
        Text
      </h2>
      {drafts && drafts.body.replays.length > 0 && (
        <span className={`${tag} self-start`}>Replay</span>
      )}
      {current.sendBack?.body.step === 'structures' && (
        <ChangesNote sendBack={current.sendBack.body} />
      )}

      <StepAreas
        slides={
          // The picked version's slides, edited in place where the viewer may (GD24).
          chosenItem && drafts && pointers.picked !== null ? (
            <ChosenStage
              view={view}
              draftsId={drafts.id}
              index={pointers.picked}
              item={chosenItem}
              themeId={themeId}
              pending={pending}
              editGate={chosen ? editGate : { shown: false, reason: null }}
              selected={selection.selected}
              onSelect={selection.onSelect}
              onEdit={edit}
              onMeasure={async (slide, slot, text) => {
                const measured = await actions.measureSlotAction(view.id, view.version, {
                  slide,
                  slot,
                  text,
                })
                return measured.ok ? measured.rows : null
              }}
            />
          ) : (
            <p className="text-muted-foreground">
              {drafts ? 'No version picked yet: pick one in Versions.' : 'No versions drafted yet.'}
            </p>
          )
        }
        actions={
          <>
            {editing && lookPost && idea && <p className="text-lead">{forLine}</p>}
            {editing && lookPost && idea && onBackToIdeas && current.ideas && (
              <StepBack>
                <Button variant="outline" onClick={onBackToIdeas}>
                  Back to ideas
                </Button>
              </StepBack>
            )}

            {/* One group alone (a viewer reading the approved version) needs no tabs. */}
            <StepTabs label="Text controls" tabs={tabs} open={tab.open} onOpen={tab.onOpen} />

            {/* Approving is the text step's own; from a passed step an edit moves the post back first. */}
            {view.stage === 'structures' && drafts && approveGate.shown && (
              <StepAction>
                <div className="ml-auto">
                  <Control reason={approveReason}>
                    <Button
                      disabled={pending || approveReason !== null}
                      onClick={() =>
                        act(
                          'approve',
                          () => actions.approveStructureAction(view.id, view.version),
                          'Text approved · on to the images',
                          // Approved, the post is at the images: its screen opens (GD27).
                          {
                            onDone: () =>
                              router.push(stepPath(view.id, stepOfStage('approved', false))),
                          },
                        )
                      }
                    >
                      Approve text → Images
                    </Button>
                  </Control>
                </div>
              </StepAction>
            )}
          </>
        }
      />
    </section>
  )
}

type VersionCardProps = {
  view: WorkbenchView
  draftsId: string
  index: number
  item: Item
  status: VersionStatus
  themeId: string
  editing: boolean
  pending: boolean
  pickGate: Gate
  /** "For: <angle>": the idea the version serves (GD2), or null for versions from ticked templates. */
  idea: string | null
  /** Its "Details" drawer: its look switch and chips, slot list, fact chips and fit checks (VersionDetails). */
  details: ReactNode
  onPick: () => void
}

/**
 * One version, compact (GD22): its first slide small beside its angle as the title and one status
 * tag, its problems in sentences, then "Use this version" and "Details", whose drawer holds the
 * rest. A version the ladder could not get clean cannot be picked (criterion 97). A record from
 * before the angles is named by its template.
 */
function VersionCard(props: VersionCardProps) {
  const { view, draftsId, index, item, status, themeId, editing, pending } = props
  const { structure, template } = item
  const angle = item.angle ?? ''
  const picked = view.pointers.picked === index
  const left = (item.problems ?? []).length > 0
  const first = structure.slides[0]

  return (
    <Blueprint
      as="article"
      aria-label={angle ? `${template.name} · ${angle}` : template.name}
      className={cn('flex min-w-0 flex-col gap-3 p-3', picked && 'border-primary')}
    >
      <div className="flex items-start gap-3">
        {first && (
          <div className="w-16 shrink-0">
            <SlidePreview
              slide={1}
              draft={{ postId: view.id, draftsId, index, themeId }}
              text={wordsOf(item, first)}
            />
          </div>
        )}
        <div className="flex min-w-0 flex-col gap-2">
          <h4 className="text-h4 wrap-anywhere">{angle || template.name}</h4>
          {props.idea && <p className={cn(reasonText, 'wrap-anywhere')}>{props.idea}</p>}
          <div className="flex flex-wrap gap-2">
            <span className={cn(tag, !status.ready && 'border-destructive text-destructive')}>
              {statusText(status)}
            </span>
            {picked && <span className={tag}>{editing ? 'Picked' : 'Approved'}</span>}
          </div>
        </div>
      </div>

      {status.problems.length > 0 && (
        <ul className="flex flex-col gap-1">
          {status.problems.map((problem) => (
            <li key={problem.text} className="text-caption text-destructive wrap-anywhere">
              {problem.text}
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {editing && !picked && !left && props.pickGate.shown && (
          <Control reason={props.pickGate.reason}>
            <Button
              variant="outline"
              size="sm"
              disabled={pending || props.pickGate.reason !== null}
              onClick={props.onPick}
            >
              Use this version
            </Button>
          </Control>
        )}
        {props.details}
      </div>
    </Blueprint>
  )
}

/**
 * A look version's look switch, Field Notes, Data Desk or Postcard, which lays its slides out again
 * with no model call (GD4), and the text chips that redraft the whole version in one direction
 * (GD10). The chips wait while a version is being redrafted.
 */
function VersionControls(props: {
  letter: string
  look: string
  lookGate: Gate
  nudgeGate: Gate
  running: boolean
  /** The chip pressed on this version while it is being redrafted, or null. */
  rewriting: string | null
  pending: boolean
  onLook: (look: string) => void
  onNudge: (nudge: string, label: string) => void
}) {
  const { lookGate, nudgeGate, pending, running, rewriting } = props
  if (!lookGate.shown && !nudgeGate.shown) return null
  return (
    <div className="flex flex-col gap-3">
      {lookGate.shown && (
        <Control reason={lookGate.reason}>
          <Toggle
            legend="Look"
            showLegend
            value={props.look}
            options={LOOKS.map((t) => ({
              value: t.id,
              label: t.name,
              disabled: pending || lookGate.reason !== null,
            }))}
            onChange={props.onLook}
          />
        </Control>
      )}
      {nudgeGate.shown && (
        <div className="flex flex-col gap-2">
          {running ? (
            <Working words={movesWait([VERSION_STEP]) ?? ''} />
          ) : (
            rewriting && <Working words="Rewriting this version…" />
          )}
          <Control reason={nudgeGate.reason}>
            {TEXT_NUDGES.map((n) => (
              <Button
                key={n.id}
                variant="outline"
                size="sm"
                aria-label={`${n.label} · Version ${props.letter}`}
                disabled={pending || running || nudgeGate.reason !== null}
                onClick={() => props.onNudge(n.id, n.label)}
              >
                {rewriting === n.id && <Spin />}
                {n.label}
              </Button>
            ))}
          </Control>
        </div>
      )}
    </div>
  )
}
