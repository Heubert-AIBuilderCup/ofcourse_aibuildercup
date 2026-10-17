'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { type ReactNode, useId, useState } from 'react'
import { Button } from '@/shared/components/ui/button'
import { Checkbox } from '@/shared/components/ui/checkbox'
import { Label } from '@/shared/components/ui/label'
import { NativeSelect } from '@/shared/components/ui/native-select'
import { Spin, Working } from '@/shared/components/Working'
import type { Staff } from '@/shared/lib/auth/access'
import { COMICS_BRAND_ID, FEED_POST_PAGES, quoteCardBrand } from '../../brands'
import { liveLine, reviewLine, tagsLine } from '../../lib/lines'
import { stepOfStage, stepPath } from '../../lib/steps'
import { actionError, WORKFLOW_ERRORS } from '../../lib/workflow'
import {
  SHARE_ACCOUNTS,
  SHARE_ERRORS,
  type ShareAccounts,
  shareChoice,
  sharedMessage,
  shareLine,
} from '../../model/share'
import { STAGE_LABELS } from '../../model/stages'
import { pageBrandFor } from '../../pages'
import type { SetVersion } from '../../server/social'
import {
  Control,
  DownloadSlides,
  MarketSlides,
  Move,
  movesWait,
  RenderedSlides,
  reasonText,
  StepAreas,
  shownOptions,
  Toggle,
} from '../parts'
import { type ActionTab, StepTabs, type TabHold } from '../stage'
import { usePostAction } from '../usePostAction'
import type { WorkbenchActions, WorkbenchView } from '../Workbench'
import { useShownMarket } from './PostPreview'

export type LivePanelProps = {
  view: WorkbenchView
  viewer: Staff
  actions: Pick<
    WorkbenchActions,
    'adaptAction' | 'makeSetAction' | 'editLiveAction' | 'sharePostAction'
  >
  /** A blog's article (BR5), in place of the slides. */
  article?: ReactNode
  /** What else the post links to: a feed post's blog (BR8), or a blog's posts (BR6). */
  links?: ReactNode
  /** The open tab beside the slides, held above the screen's version key (Workbench), so a save keeps it. */
  tab?: TabHold
}

/** The tabs beside the slides: where the post shows and who reviewed it, sharing it, its versions. */
const DETAILS_TAB = 'Details'
const SHARE_TAB = 'Share'
const SOCIAL_TAB = 'Social versions'

/** What a page's version says when it kept this post's art instead of drawing its own cover. */
const FEED_ART_NOTE = 'with this post’s art (daily image limit reached or no clean cover)'

/** "Ready to export", or where the version stopped and why; a page's version says when it kept this post's art. */
function versionLine(v: SetVersion, ownPageId: string | null): string {
  const parts = [v.stage === 'ready' ? 'Ready to export' : STAGE_LABELS[v.stage]]
  if (v.error) parts.push(v.error)
  else if (v.kind === 'page' && v.brandId !== ownPageId && !v.ownCover) parts.push(FEED_ART_NOTE)
  return parts.join(' · ')
}

/**
 * "Make the set" (criterion 108): an Instagram version for each page with a design language but
 * Comics, which takes only comics (RC7), and one quote card, each made, approved, rendered with
 * its caption and ready to export from its own page. Pages without a design language are listed
 * as such and get none. One request id per version, kept until the set is made, so a second press
 * finds the first set; new ones after, so the next press makes another.
 */
function MakeSet({ view, viewer, actions }: LivePanelProps) {
  const ids = useId()
  const { pending, run } = usePostAction()
  const [requestIds, setRequestIds] = useState<Record<string, string>>({})
  const [made, setMade] = useState<SetVersion[] | null>(null)
  const gate = actionError('adapt', viewer, view.stage)
  if (gate === WORKFLOW_ERRORS.notAuthorised) return null

  const styled = new Set(view.styledPages ?? [])
  const ownPageId = view.pointers.pageBrandId ?? null
  const keys = [...FEED_POST_PAGES.filter((b) => styled.has(b.id)).map((b) => b.id), 'quote']

  const create = () => {
    const next = { ...requestIds }
    for (const key of keys) next[key] ??= crypto.randomUUID()
    setRequestIds(next)
    run(
      async () => {
        const res = await actions.makeSetAction(view.id, view.version, { requestIds: next })
        if (res.ok) setMade(res.versions)
        return res
      },
      'Set made · linked cards on the board',
      () => setRequestIds({}),
    )
  }

  return (
    <section aria-labelledby={`${ids}-heading`} className="flex flex-col gap-4">
      <h3 id={`${ids}-heading`} className="text-h4">
        Make the set
      </h3>
      <ul aria-label="The set" className="flex flex-col gap-1">
        {FEED_POST_PAGES.map((b) => (
          <li key={b.id}>
            {b.name} · {styled.has(b.id) ? 'Instagram version' : 'No design language yet'}
          </li>
        ))}
        <li>Quote card · {quoteCardBrand(ownPageId).name}</li>
      </ul>
      <Control reason={gate}>
        <Button variant="outline" disabled={pending || gate !== null} onClick={create}>
          {pending && <Spin />}
          {pending ? 'Running…' : 'Make the set'}
        </Button>
      </Control>
      {pending && <Working words="Making a version for each page · this can take a few minutes" />}
      <p className={reasonText}>
        Each version is rendered with its caption, ready to export from its own page. A page's cover
        counts against the daily image limit; past it, the version keeps this post's art.
      </p>
      {made && (
        <ul aria-label="Versions made" className="flex flex-col gap-1 wrap-anywhere">
          {made.map((v) => (
            <li key={v.id}>
              <Link href={`/admin/posts/${v.id}`}>{v.title}</Link> · {versionLine(v, ownPageId)}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

type Platform = 'instagram' | 'linkedin'

const PLATFORMS: { value: Platform; label: string }[] = [
  { value: 'instagram', label: 'Instagram carousel' },
  { value: 'linkedin', label: 'LinkedIn post' },
]

/**
 * "Adapt" (criteria 62, 63, 88): a social version of this live post in a page brand, for a
 * platform. The page brand the rule file names for the post's theme is pre-selected (ADR-124),
 * nothing when it names none, and the editor may change it. The request id is the new post's id,
 * so a double click makes one version; a new one is drawn after each success, so the next choice
 * makes another.
 */
function Adapt({ view, viewer, actions }: LivePanelProps) {
  const ids = useId()
  const { pending, run } = usePostAction()
  const themeTag = view.current.settings?.body.tags.find((t) => t.startsWith('theme:')) ?? null
  const [brandId, setBrandId] = useState(pageBrandFor(themeTag) ?? '')
  const [platform, setPlatform] = useState<Platform>('instagram')
  const [requestId, setRequestId] = useState(() => crypto.randomUUID())
  const gate = actionError('adapt', viewer, view.stage)
  if (gate === WORKFLOW_ERRORS.notAuthorised) return null

  const create = () =>
    run(
      () => actions.adaptAction(view.id, view.version, { brandId, platform, requestId }),
      'Social version created · linked card on the board',
      () => setRequestId(crypto.randomUUID()),
    )

  return (
    <section aria-labelledby={`${ids}-heading`} className="flex flex-col gap-4">
      <h3 id={`${ids}-heading`} className="text-h4">
        Adapt
      </h3>
      <div className="grid grid-cols-2 gap-4">
        <div className="flex min-w-0 flex-col gap-2">
          <Label htmlFor={`${ids}-brand`}>Page brand</Label>
          <NativeSelect
            id={`${ids}-brand`}
            value={brandId}
            onChange={(e) => setBrandId(e.target.value)}
          >
            <option value="">Choose a page brand</option>
            {FEED_POST_PAGES.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="flex min-w-0 flex-col gap-2">
          <Label htmlFor={`${ids}-platform`}>Platform</Label>
          <NativeSelect
            id={`${ids}-platform`}
            value={platform}
            onChange={(e) => setPlatform(e.target.value as Platform)}
          >
            {PLATFORMS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>
      <Control reason={gate}>
        <Button
          variant="outline"
          disabled={pending || brandId === '' || gate !== null}
          onClick={create}
        >
          {pending ? 'Running…' : 'Create social version'}
        </Button>
      </Control>
    </section>
  )
}

const NETWORKS: { key: keyof ShareAccounts; name: string }[] = [
  { key: 'instagram', name: 'Instagram' },
  { key: 'linkedin', name: 'LinkedIn' },
]

/**
 * "Share" (criteria 9–11): the live feed post shared to any of the pages' Instagram accounts and
 * the LinkedIn page, several at once. Nothing is posted (ADR-033): the share is recorded, a toast
 * says where it went, and the post lists it. "Share" waits for a tick, saying why.
 */
function Share({ view, viewer, actions }: LivePanelProps) {
  const ids = useId()
  const { pending, run } = usePostAction()
  const [ticked, setTicked] = useState<ShareAccounts>({ instagram: [], linkedin: [] })
  const gate = actionError('share', viewer, view.stage)
  if (gate === WORKFLOW_ERRORS.notAuthorised) return null

  const choice = shareChoice(ticked)
  const reason = gate ?? (choice.ok ? null : SHARE_ERRORS.none)
  const tick = (network: keyof ShareAccounts, id: string, on: boolean) =>
    setTicked((t) => ({
      ...t,
      [network]: on ? [...t[network], id] : t[network].filter((v) => v !== id),
    }))
  const share = () => {
    if (!choice.ok) return
    run(
      () => actions.sharePostAction(view.id, view.version, choice.accounts),
      sharedMessage(choice.accounts),
    )
  }

  return (
    <section aria-labelledby={`${ids}-heading`} className="flex flex-col gap-4">
      <h3 id={`${ids}-heading`} className="text-h4">
        Share
      </h3>
      {NETWORKS.map(({ key, name }) => (
        <fieldset key={key} className="flex flex-col gap-2">
          <legend className="mb-2 text-overline uppercase text-muted-foreground">{name}</legend>
          {SHARE_ACCOUNTS[key].map((a) => (
            <div key={a.id} className="flex items-center gap-2">
              <Checkbox
                id={`${ids}-${key}-${a.id}`}
                checked={ticked[key].includes(a.id)}
                onCheckedChange={(on) => tick(key, a.id, on === true)}
              />
              <Label htmlFor={`${ids}-${key}-${a.id}`}>{a.label}</Label>
            </div>
          ))}
        </fieldset>
      ))}
      <Control reason={reason}>
        <Button variant="outline" disabled={pending || reason !== null} onClick={share}>
          {pending && <Spin />}
          {pending ? 'Sharing…' : 'Share'}
        </Button>
      </Control>
    </section>
  )
}

/** The post's shares, newest first, with who shared each (criterion 10). */
function Shares({ shares }: { shares: NonNullable<WorkbenchView['shares']> }) {
  if (shares.length === 0) return null
  return (
    <ul aria-label="Shares" className="flex flex-col gap-1 text-caption wrap-anywhere">
      {shares.map((s) => (
        <li key={s.id}>{shareLine(s.body)}</li>
      ))}
    </ul>
  )
}

/**
 * A comic's Instagram version (RC7): one, for the Comics page, the only page a comic goes on; a
 * comic has no set. The request id is the new post's id, as in Adapt.
 */
function ComicVersion({ view, viewer, actions }: LivePanelProps) {
  const { pending, run } = usePostAction()
  const [requestId, setRequestId] = useState(() => crypto.randomUUID())
  const gate = actionError('adapt', viewer, view.stage)
  if (gate === WORKFLOW_ERRORS.notAuthorised) return null

  const create = () =>
    run(
      () =>
        actions.adaptAction(view.id, view.version, {
          brandId: COMICS_BRAND_ID,
          platform: 'instagram',
          requestId,
        }),
      'Instagram version created · linked card on the board',
      () => setRequestId(crypto.randomUUID()),
    )

  return (
    <Control reason={gate}>
      <Button variant="outline" disabled={pending || gate !== null} onClick={create}>
        {pending ? 'Running…' : 'Make Instagram version for Comics'}
      </Button>
    </Control>
  )
}

/**
 * A live post (criteria 45, 46, 54, 60, 61): the slides the reviewer approved, and the market
 * version that went live with them if there is one, where it shows in the feed and who reviewed
 * it. The Market toggle offers only the versions that exist; nothing here makes one, and its
 * settings cannot change here. An editor may adapt it for a social platform, or make the set (a
 * comic only its Instagram version for Comics), or "Edit" it as a working copy while students
 * keep this version (criterion 116), which waits while a step runs (122). The slides sit on a
 * stage; beside them the details, Share and the social versions are one tab each.
 */
export function LivePanel({ view, viewer, actions, article, links, tab: heldTab }: LivePanelProps) {
  const ids = useId()
  const { render, settings, approval, market, layout } = view.current
  // The board's market card opens the post with ?market=<its market id>.
  const [shownMarket, setShownMarket] = useShownMarket(market)
  const shownVersion = shownMarket === 'market' ? market : null
  const { pending, run } = usePostAction()
  const router = useRouter()
  const canEdit = actionError('editLive', viewer, view.stage) === null
  // The open tab, the workbench's when it passes one, so a save keeps it (GD24).
  const [ownTab, setOwnTab] = useState<string | null>(null)
  const tab = heldTab ?? { open: ownTab, onOpen: setOwnTab }
  // A blog is read on the site and in the feed: it has no social versions and no shares. A comic
  // has its one Instagram version and no shares (RC7).
  const social = view.kind !== 'blog'
  const mayAdapt = actionError('adapt', viewer, view.stage) !== WORKFLOW_ERRORS.notAuthorised
  const mayShare = actionError('share', viewer, view.stage) !== WORKFLOW_ERRORS.notAuthorised
  const shares = view.shares ?? []
  const tabs: ActionTab[] = [
    {
      name: DETAILS_TAB,
      body: (
        <div className="flex flex-col gap-1">
          {settings && <p>{liveLine(settings.body, approval?.body.by.at)}</p>}
          {settings && <p className="text-caption">{tagsLine(settings.body)}</p>}
          {approval && (
            <p className="text-caption text-muted-foreground">{reviewLine(approval.body)}</p>
          )}
        </div>
      ),
    },
    ...(social && !view.courseId && (mayShare || shares.length > 0)
      ? [
          {
            name: SHARE_TAB,
            body: (
              <>
                <Share view={view} viewer={viewer} actions={actions} />
                <Shares shares={shares} />
              </>
            ),
          },
        ]
      : []),
    ...(social && mayAdapt
      ? [
          {
            name: SOCIAL_TAB,
            body: view.courseId ? (
              <ComicVersion view={view} viewer={viewer} actions={actions} />
            ) : (
              <>
                <Adapt view={view} viewer={viewer} actions={actions} />
                <MakeSet view={view} viewer={viewer} actions={actions} />
              </>
            ),
          },
        ]
      : []),
  ]
  return (
    <section aria-labelledby={`${ids}-heading`} className="flex flex-col gap-6">
      <h2 id={`${ids}-heading`} className="sr-only">
        Live in feed
      </h2>
      {canEdit && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Move
              className="ml-auto items-end"
              label="Edit"
              waiting={movesWait(view.running)}
              pending={pending}
              onGo={() =>
                run(
                  () => actions.editLiveAction(view.id, view.version),
                  'Editing a working copy · students keep the live version',
                  // The working copy is at its text versions: their screen opens (GD27).
                  () => router.push(stepPath(view.id, stepOfStage('structures', false))),
                )
              }
            />
          </div>
          <p className={reasonText}>
            Students keep seeing this version until the new one is published.
          </p>
        </div>
      )}
      <StepAreas
        slides={
          article ??
          (render && (
            // From @5xl it takes the height of its area, so the slide on the stage fits the frame.
            <div className="flex flex-col gap-4 @5xl:min-h-0 @5xl:flex-1">
              <Toggle
                legend="Market"
                showLegend
                options={shownOptions(market?.body)}
                value={shownMarket}
                onChange={setShownMarket}
              />
              {shownVersion ? (
                <MarketSlides market={shownVersion.body} stage />
              ) : (
                <RenderedSlides render={render.body} layout={layout?.body.slides} stage />
              )}
              {/* In the step bar, before the step's action (18 Oct). */}
              <DownloadSlides postId={view.id} />
            </div>
          ))
        }
        actions={
          <>
            <StepTabs label="Live panels" tabs={tabs} open={tab.open} onOpen={tab.onOpen} />
            {links}
          </>
        }
      />
    </section>
  )
}
