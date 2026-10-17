'use client'

import { useRouter } from 'next/navigation'
import { type ReactNode, useId, useState } from 'react'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { NativeSelect } from '@/shared/components/ui/native-select'
import type { Staff } from '@/shared/lib/auth/access'
import {
  AUDIENCE_COUNTS,
  formatCount,
  LAYER_LABELS,
  liveLine,
  MATCH_RULES,
  STUDIO_LINKS,
} from '../../lib/lines'
import { defaultSettings } from '../../lib/settings-defaults'
import { stepOfStage, stepPath } from '../../lib/steps'
import {
  actionError,
  missingSettingError,
  normaliseSettings,
  type SettingName,
  sendToReviewError,
  settingsError,
  WORKFLOW_ERRORS,
} from '../../lib/workflow'
import { type FeedSettings, LAYERS, SOURCES_AT, type SourcesAt } from '../../model/types'
import { TAG_GROUP_LABELS, TAG_GROUPS, TAGS, tagsIn } from '../../tags'
import { COMIC_TEMPLATE_ID, isLook } from '../../templates'
import { firstChars } from '../../text/script'
import { ChangesNote, Control, StepAction } from '../parts'
import { holdOnWork, StepTabs, shownTab, type TabBadge, type TabHold } from '../stage'
import { usePostAction } from '../usePostAction'
import type { WorkbenchActions, WorkbenchView } from '../Workbench'

export type SettingsFormProps = {
  view: WorkbenchView
  viewer: Staff
  actions: Pick<WorkbenchActions, 'saveSettingsAction' | 'sendToReviewAction'>
  /** The panel shown, by its name, held by the workbench so that a save does not send the editor back to the first. */
  tab: TabHold
  /**
   * The source check (SourceCheckPanel), the first panel and the one place for what of it keeps
   * the post from review: its tab counts that ("Source check · 2 to fix").
   */
  check?: ReactNode
  /** The market versions (PostPreview's MarketControls), the last panel; none for a blog. */
  market?: ReactNode
}

/** One of the settings' panels, shown one at a time, and its tab's badge when it holds something to fix. */
type Panel = { name: string; problem: boolean | TabBadge; body: ReactNode }

type Layer = FeedSettings['layer']
type Expiry = 'none' | '30' | '90' | 'date'

/** The form's own state: an expiry "On a date" may still lack its date, which no saved settings can. */
type Draft = {
  layer: Layer
  matched: boolean
  whyLine: string
  expiry: Expiry
  date: string
  studioLink: string
  tags: string[]
  sourcesAt: SourcesAt
}

const LAYER_NOTES: Record<Layer, string> = {
  general: 'In the feed for its audience',
  featured: 'Pinned 72 h to everyone',
  personal: 'Shown as “For you”',
}

const EXPIRIES: { value: Expiry; label: string }[] = [
  { value: 'none', label: 'No expiry' },
  { value: '30', label: '30 days' },
  { value: '90', label: '90 days' },
  { value: 'date', label: 'On a date' },
]

/**
 * Where the sources go (GD31), each with what it puts where; the caption lists them whatever is
 * chosen.
 */
const SOURCES_CHOICES: Record<SourcesAt, { label: string; note: string }> = {
  caption: { label: 'Caption only', note: 'Nothing on the slides' },
  last_slide: { label: 'Last slide', note: 'Site names above the search line, never full links' },
  sources_slide: { label: 'A sources slide at the end', note: 'For several links' },
}

const note = 'text-caption text-muted-foreground'
const radio = 'size-4 accent-primary'
/** Every group in a panel: a fieldset under its heading, its options evenly spaced. */
const fieldset = 'flex flex-col gap-3'
const legend = 'mb-3 text-h4'
/** An option with its note beside it, the note going under it on a narrow screen. */
const optionRow = 'flex flex-wrap items-center gap-x-3 gap-y-1'
/** Ticks in columns that size themselves to the panel's width. */
const optionGrid = 'grid grid-cols-[repeat(auto-fill,minmax(min(10rem,100%),1fr))] gap-x-6 gap-y-3'

function draftOf(s: FeedSettings): Draft {
  const e = s.expiry
  return {
    layer: s.layer,
    matched: s.audience.mode === 'matched',
    whyLine: s.whyLine ?? '',
    expiry: e.kind === 'days' ? (String(e.days) as Expiry) : e.kind,
    date: e.kind === 'date' ? e.date : '',
    studioLink: s.studioLink ?? '',
    tags: s.tags,
    sourcesAt: s.sourcesAt,
  }
}

/** The settings the form has not chosen yet: an expiry "On a date" with no date. */
function missingOf(d: Draft): SettingName[] {
  return d.expiry === 'date' && d.date === '' ? ['expiry'] : []
}

/** The settings the form would save, or null while one is still unchosen. */
function settingsOf(d: Draft): FeedSettings | null {
  if (d.expiry === 'date' && d.date === '') return null
  const expiry: FeedSettings['expiry'] =
    d.expiry === 'none'
      ? { kind: 'none' }
      : d.expiry === 'date'
        ? { kind: 'date', date: d.date }
        : { kind: 'days', days: d.expiry === '30' ? 30 : 90 }
  return normaliseSettings({
    layer: d.layer,
    audience: d.matched
      ? { mode: 'matched', rules: [...MATCH_RULES] }
      : { mode: 'everyone', rules: [] },
    whyLine: d.whyLine.trim() === '' ? null : d.whyLine.trim(),
    expiry,
    studioLink: d.studioLink === '' ? null : d.studioLink,
    // In the file's order, so the same ticks always save the same list.
    tags: TAGS.filter((t) => d.tags.includes(t.id)).map((t) => t.id),
    sourcesAt: d.sourcesAt,
  })
}

/** Field by field, since stored JSON comes back with its keys in another order. */
function sameSettings(a: FeedSettings, b: FeedSettings): boolean {
  const key = (s: FeedSettings) =>
    JSON.stringify([
      s.layer,
      s.audience.mode,
      s.audience.rules,
      s.whyLine,
      s.expiry.kind,
      s.expiry.kind === 'days' ? s.expiry.days : s.expiry.kind === 'date' ? s.expiry.date : null,
      s.studioLink,
      s.tags,
      s.sourcesAt,
    ])
  return key(a) === key(b)
}

/** A native radio (one of a named group) or, with `type="checkbox"`, a tick on its own. */
function Choice(props: {
  type?: 'radio' | 'checkbox'
  name?: string
  checked: boolean
  disabled: boolean
  onChange: () => void
  label: ReactNode
  describedBy?: string
}) {
  const id = useId()
  return (
    <div className="flex items-center gap-2">
      <input
        id={id}
        type={props.type ?? 'radio'}
        name={props.name}
        className={radio}
        checked={props.checked}
        disabled={props.disabled}
        aria-describedby={props.describedBy}
        onChange={props.onChange}
      />
      <Label htmlFor={id} className="flex items-center gap-2">
        {props.label}
      </Label>
    </div>
  )
}

/**
 * How many things of the source check keep the post from review (lib/workflow.ts
 * sendToReviewError): the check, not landed yet, or each sentence not found. A comic's panels are
 * not checked.
 */
function checkProblems(current: WorkbenchView['current']): number {
  if (current.revision?.body.template.id === COMIC_TEMPLATE_ID) return 0
  const check = current.sourceCheck
  return check ? check.body.claims.filter((c) => c.result === 'not_found').length : 1
}

/** A panel's tag when it holds something to fix: one word, read as "needs attention". */
const FIX: TabBadge = { text: 'Fix', label: 'needs attention', problem: true }

const SOURCE_CHECK = 'Source check'
const WHO = 'Who sees it'
const EXPIRY = 'Expiry'

/**
 * "Send to review"'s reason, pointing to the panel that fixes it (18 Oct): the source check's
 * count, or a setting's sentence with its panel's name; any other reason as it is.
 */
function pointed(
  reason: string | null,
  where: { checkCount: number; whoError: string | null; missing: string | null },
): string | null {
  if (reason === null) return null
  const open = (text: string, panel: string) => `${text.replace(/\.$/, '')}: open ${panel}`
  if (reason === where.missing) return open(reason, EXPIRY)
  if (reason === where.whoError) return open(reason, WHO)
  if (reason === WORKFLOW_ERRORS.checkFirst || reason === WORKFLOW_ERRORS.notFound) {
    return `${Math.max(where.checkCount, 1)} to fix: open ${SOURCE_CHECK}`
  }
  return reason
}

/**
 * The panels one at a time (as a post editor's settings are): "2 of 6" over the panels as tabs
 * (StepTabs), one with something to fix marked "Fix" (the source check's counted), then "Back"
 * and "Next", or the last panel's own actions. The held panel opens, else the first, the source
 * check; the one shown is held once she works in it.
 */
function Panels({ panels, tab, last }: { panels: Panel[]; tab: TabHold; last: ReactNode }) {
  const first = panels[0]?.name
  const here = shownTab(panels, tab.open, first)
  const go = (i: number) => tab.onOpen(panels[i].name)
  return (
    <div className="flex flex-col gap-6" {...holdOnWork(tab, panels[here]?.name)}>
      <div className="flex flex-col gap-2">
        <p className={note}>{`${here + 1} of ${panels.length}`}</p>
        <StepTabs
          label="Settings panels"
          tabs={panels.map((p) => ({
            name: p.name,
            badge: p.problem === true ? FIX : p.problem || undefined,
            body: p.body,
          }))}
          open={tab.open}
          initial={first}
          onOpen={tab.onOpen}
        />
      </div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <Button variant="outline" disabled={here === 0} onClick={() => go(here - 1)}>
          Back
        </Button>
        {here === panels.length - 1 ? (
          last
        ) : (
          // The step bar holds the screen's one filled button ("Send to review").
          <Button variant="outline" onClick={() => go(here + 1)}>
            Next
          </Button>
        )}
      </div>
    </div>
  )
}

/**
 * Feed settings for a rendered post (criteria 49–53), one panel at a time beside the post: the
 * source check, who sees it (the layer with its note, the audience with its mock counts, the why
 * line unless the post is General for Everyone, an optional Studio link), the tags, where the
 * sources go, the expiry, then the market versions, whose panel ends with "Save settings";
 * "Send to review" waits in the step bar on every panel (A4). A post first at Settings starts
 * from the defaults its facts suggest (GD29). "Send to review" asks the same rule the command
 * does, about what the form shows, and saves changed settings first.
 */
export function SettingsForm({ view, viewer, actions, tab, check, market }: SettingsFormProps) {
  const { pending, run } = usePostAction()
  const router = useRouter()
  const ids = useId()
  const saved = view.current.settings?.body ?? null
  // A post first at Settings starts from the defaults its facts and language suggest, saved only on
  // Save or Send (GD29, GD40).
  const [draft, setDraft] = useState<Draft>(() =>
    draftOf(
      saved ??
        defaultSettings(view.current.facts?.body.facts ?? [], view.current.source?.body.language),
    ),
  )
  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }))
  const tick = (id: string, on: boolean) =>
    setDraft((d) => ({ ...d, tags: on ? [...d.tags, id] : d.tags.filter((t) => t !== id) }))

  const settingsGate = actionError('settings', viewer, view.stage)
  const sendGate = actionError('sendToReview', viewer, view.stage)
  // A post from before the looks keeps a source line on its slides (GD8), so it ignores the
  // last-slide and sources-slide options: it is offered the caption only.
  const template = view.current.revision?.body.template
  const sourceChoices = template && !isLook(template) ? SOURCES_AT.slice(0, 1) : SOURCES_AT

  const { sendBack } = view.current
  // A reviewer's request for changes naming the settings shows under the heading (criterion 120).
  const heading = (
    <>
      <h2 id={`${ids}-heading`} className="text-h4">
        Feed settings
      </h2>
      {sendBack?.body.step === 'settings' && <ChangesNote sendBack={sendBack.body} />}
    </>
  )
  const checkCount = checkProblems(view.current)
  const first: Panel[] = check
    ? [
        {
          name: SOURCE_CHECK,
          problem:
            checkCount > 0
              ? { text: String(checkCount), label: `${checkCount} to fix`, problem: true }
              : false,
          body: check,
        },
      ]
    : []
  const end: Panel[] = market ? [{ name: 'Market versions', problem: false, body: market }] : []
  if (settingsGate === WORKFLOW_ERRORS.notAuthorised) {
    const summary = <p className="text-caption">{saved ? liveLine(saved) : 'No settings yet.'}</p>
    return (
      <section aria-labelledby={`${ids}-heading`} className="flex flex-col gap-4">
        {heading}
        <Panels
          panels={[...first, { name: 'Settings', problem: false, body: summary }, ...end]}
          tab={tab}
          last={null}
        />
      </section>
    )
  }

  const shown = settingsOf(draft)
  const dirty = shown !== null && (saved === null || !sameSettings(shown, saved))
  const missing = shown ? null : missingSettingError(missingOf(draft))
  const saveReason = settingsGate ?? missing
  const sendReason =
    sendGate ??
    missing ??
    sendToReviewError({
      ...view.current,
      settings: shown ? { id: view.current.settings?.id ?? 'unsaved', body: shown } : null,
    })
  const sendOffered = sendGate !== WORKFLOW_ERRORS.notAuthorised
  const locked = pending || settingsGate !== null
  const featured = draft.layer === 'featured'
  const matched = draft.matched && !featured
  const whyShown = !(draft.layer === 'general' && !matched)

  const save = () => {
    if (!shown) return
    run(() => actions.saveSettingsAction(view.id, view.version, shown), 'Settings saved')
  }
  // Sent, the post is in review: its screen opens (GD27).
  const toReview = () => router.push(stepPath(view.id, stepOfStage('in_review', false)))
  const send = () =>
    run(
      async () => {
        let at = view.version
        if (dirty && shown) {
          const result = await actions.saveSettingsAction(view.id, at, shown)
          if (!result.ok) return result
          at = result.version
        }
        return actions.sendToReviewAction(view.id, at)
      },
      'Sent to review',
      toReview,
    )

  // Who sees it holds a problem when its choices alone would be refused (a why line it needs);
  // each problem is said on its own panel, where it is fixed.
  const who = settingsOf({ ...draft, expiry: 'none' })
  const whoError = who ? settingsError(who) : null
  const problemLine = (text: string | null) =>
    text && <p className="text-caption text-destructive">{text}</p>
  const panels: Panel[] = [
    ...first,
    {
      name: WHO,
      problem: whoError !== null,
      body: (
        <>
          {problemLine(whoError)}
          <fieldset className={fieldset}>
            <legend className={legend}>Layer</legend>
            {LAYERS.map((layer) => (
              <div key={layer} className={optionRow}>
                <Choice
                  name={`${ids}-layer`}
                  checked={draft.layer === layer}
                  disabled={locked}
                  onChange={() => set(layer === 'featured' ? { layer, matched: false } : { layer })}
                  label={LAYER_LABELS[layer]}
                  describedBy={`${ids}-${layer}-note`}
                />
                <span id={`${ids}-${layer}-note`} className={note}>
                  {LAYER_NOTES[layer]}
                </span>
              </div>
            ))}
          </fieldset>

          <fieldset className={fieldset}>
            <legend className={legend}>Audience</legend>
            <Choice
              name={`${ids}-audience`}
              checked={!matched}
              disabled={locked}
              onChange={() => set({ matched: false })}
              label={
                <>
                  Everyone
                  <span className={note}>{`${formatCount(AUDIENCE_COUNTS.everyone)} (mock)`}</span>
                </>
              }
            />
            <div className={optionRow}>
              <Choice
                name={`${ids}-audience`}
                checked={matched}
                disabled={locked || featured}
                onChange={() => set({ matched: true })}
                label="Matched group"
                describedBy={featured ? `${ids}-featured` : undefined}
              />
              {featured && (
                <span id={`${ids}-featured`} className={note}>
                  {WORKFLOW_ERRORS.featuredEveryone}
                </span>
              )}
            </div>
            {matched && (
              <div className="flex flex-col gap-1 pl-6">
                <ul className="flex flex-col gap-1 text-caption">
                  {MATCH_RULES.map((rule) => (
                    <li key={rule}>{rule}</li>
                  ))}
                </ul>
                <span
                  className={note}
                >{`${formatCount(AUDIENCE_COUNTS.matched)} matched (mock)`}</span>
              </div>
            )}
          </fieldset>

          {whyShown && (
            <div className={fieldset}>
              <Label htmlFor={`${ids}-why`} className="text-h4">
                Why line
              </Label>
              <Input
                id={`${ids}-why`}
                value={draft.whyLine}
                disabled={locked}
                onChange={(e) => set({ whyLine: firstChars(e.target.value, 140) })}
              />
            </div>
          )}

          <div className={fieldset}>
            <Label htmlFor={`${ids}-studio`} className="text-h4">
              Studio link
            </Label>
            <NativeSelect
              id={`${ids}-studio`}
              value={draft.studioLink}
              disabled={locked}
              onChange={(e) => set({ studioLink: e.target.value })}
            >
              <option value="">None</option>
              {STUDIO_LINKS.map((link) => (
                <option key={link} value={link}>
                  {link}
                </option>
              ))}
            </NativeSelect>
          </div>
        </>
      ),
    },
    {
      name: 'Tags',
      problem: false,
      body: (
        <>
          {TAG_GROUPS.map((group) => (
            <fieldset key={group} className={fieldset}>
              <legend className={legend}>{TAG_GROUP_LABELS[group]}</legend>
              <div className={optionGrid}>
                {tagsIn(group).map((t) => (
                  <Choice
                    key={t.id}
                    type="checkbox"
                    checked={draft.tags.includes(t.id)}
                    disabled={locked}
                    onChange={() => tick(t.id, !draft.tags.includes(t.id))}
                    label={t.label}
                  />
                ))}
              </div>
            </fieldset>
          ))}
        </>
      ),
    },
    {
      name: 'Where sources go',
      problem: false,
      body: (
        <fieldset className={fieldset}>
          <legend className={legend}>Where sources go</legend>
          {sourceChoices.map((at) => (
            <div key={at} className={optionRow}>
              <Choice
                name={`${ids}-sources`}
                checked={draft.sourcesAt === at}
                disabled={locked}
                onChange={() => set({ sourcesAt: at })}
                label={SOURCES_CHOICES[at].label}
                describedBy={`${ids}-sources-${at}`}
              />
              <span id={`${ids}-sources-${at}`} className={note}>
                {SOURCES_CHOICES[at].note}
              </span>
            </div>
          ))}
          <p className={note}>The caption always lists the sources.</p>
        </fieldset>
      ),
    },
    {
      name: EXPIRY,
      problem: missingOf(draft).length > 0,
      body: (
        <fieldset className={fieldset}>
          <legend className={legend}>Expiry</legend>
          {problemLine(missing)}
          {EXPIRIES.map((e) => (
            <Choice
              key={e.value}
              name={`${ids}-expiry`}
              checked={draft.expiry === e.value}
              disabled={locked}
              onChange={() => set({ expiry: e.value })}
              label={e.label}
            />
          ))}
          {draft.expiry === 'date' && (
            <Input
              type="date"
              aria-label="Expiry date"
              className="w-auto self-start"
              value={draft.date}
              disabled={locked}
              onChange={(e) => set({ date: e.target.value })}
            />
          )}
        </fieldset>
      ),
    },
    ...end,
  ]

  return (
    <section aria-labelledby={`${ids}-heading`} className="flex flex-col gap-4">
      {heading}
      <Panels
        panels={panels}
        tab={tab}
        last={
          // Where "Send to review" is offered, the bar says why it or a save waits: one reason line.
          <Control reason={sendOffered ? null : saveReason}>
            <Button variant="outline" disabled={pending || saveReason !== null} onClick={save}>
              Save settings
            </Button>
          </Control>
        }
      />
      {/* Sending is the step's action: in the step bar, from any panel (A4). */}
      {sendOffered && (
        <StepAction>
          <Control reason={pointed(sendReason ?? saveReason, { checkCount, whoError, missing })}>
            <Button disabled={pending || sendReason !== null} onClick={send}>
              Send to review → Review
            </Button>
          </Control>
        </StepAction>
      )}
    </section>
  )
}
