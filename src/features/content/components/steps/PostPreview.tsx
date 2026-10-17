'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useId, useState } from 'react'
import { Button } from '@/shared/components/ui/button'
import { Label } from '@/shared/components/ui/label'
import { NativeSelect } from '@/shared/components/ui/native-select'
import { Spin, Working } from '@/shared/components/Working'
import type { Staff } from '@/shared/lib/auth/access'
import { cardSourceLine, excerptOf } from '../../lib/feed'
import { liveLine } from '../../lib/lines'
import { actionError } from '../../lib/workflow'
import { MARKETS, type MarketId } from '../../markets'
import type { Body } from '../../model/artifacts'
import { PhoneFeedCard } from '../PhoneFeedCard'
import {
  DownloadSlides,
  MarketSlides,
  marketName,
  movesWait,
  RenderedSlides,
  type Shown,
  shownOptions,
  Toggle,
} from '../parts'
import { usePostAction } from '../usePostAction'
import type { WorkbenchActions, WorkbenchView } from '../Workbench'

export type MarketControlsProps = {
  view: WorkbenchView
  viewer: Staff
  actions: Pick<WorkbenchActions, 'makeMarketAction' | 'rewordMarketAction'>
  /** Which version the preview beside shows (useShownMarket), switched here. */
  shown: Shown
  onShow: (shown: Shown) => void
}

type PreviewView = 'slides' | 'context'

const PREVIEW_VIEWS: { value: PreviewView; label: string }[] = [
  { value: 'slides', label: 'Slides' },
  { value: 'context', label: 'Preview in context' },
]

/**
 * Which version the Market switch starts on: the market version when the page was opened for it
 * (the board's market card links with ?market=<its market id>), the default otherwise.
 */
export function useShownMarket(market: { body: { market: string } } | null) {
  const searchParams = useSearchParams()
  return useState<Shown>(() =>
    market && searchParams?.get('market') === market.body.market ? 'market' : 'default',
  )
}

/** The post in a phone-sized feed card, built from the stored cover and what was approved, with the settings summary beside it. */
function ContextPreview({ view, render }: { view: WorkbenchView; render: Body<'render'> }) {
  const { revision, layout, settings } = view.current
  const cover = render.slides[0]
  return (
    <div className="flex flex-wrap items-start gap-8">
      <PhoneFeedCard
        coverSrc={`/admin/assets/${encodeURIComponent(cover.pngAssetId)}`}
        title={view.title}
        excerpt={revision ? excerptOf(revision.body.structure) : ''}
        settings={settings?.body ?? null}
        sourceLine={cardSourceLine(layout?.body.slides ?? [])}
      />
      <p className="text-caption">{settings ? liveLine(settings.body) : 'No feed settings yet'}</p>
    </div>
  )
}

/**
 * The market versions of a rendered post, as the Settings step's last panel, a look post's or one
 * from before the looks (criteria 56–61, 85, 87, 110): the Market switch between the stored slides
 * and the post's one market version (the preview beside shows the one chosen), "Make market
 * version" for the market the select names while the post has none (made at once by code), and
 * "Reword for <market>" as the optional extra until it is reworded. Once the post has moved on,
 * the switch shows only the versions that exist.
 */
export function MarketControls({ view, viewer, actions, shown, onShow }: MarketControlsProps) {
  const ids = useId()
  const { pending, run, error } = usePostAction()
  /** A refusal, said beside the button that was pressed (a toast alone is easily missed). */
  const refused = !pending && error && (
    <p role="alert" className="basis-full text-caption text-destructive">
      {error}
    </p>
  )
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { render, market } = view.current
  /** The market the select names for a new version: the file's first until the editor picks. */
  const [marketId, setMarketId] = useState<MarketId>(MARKETS[0].id)
  if (!render) return null

  // One market version per post (ADR-123); rewording by the model is the optional extra once it
  // exists, until it has been reworded (110).
  const marketGate = actionError('market', viewer, view.stage)
  const making = view.running.includes('market') || pending
  const offerMarket = !market && marketGate === null
  const offerReword = market !== null && !(market.body.reworded ?? false) && marketGate === null
  /** Opens the page on the market version, as the board's market card does. */
  const openOnMarket = (id: MarketId) => {
    const params = new URLSearchParams(searchParams?.toString())
    params.set('market', id)
    router.replace(`${pathname}?${params}`, { scroll: false })
  }
  const makeMarket = () =>
    run(
      () => actions.makeMarketAction(view.id, view.version, marketId),
      `${marketName(marketId)} version made · linked card on the board`,
      () => openOnMarket(marketId),
    )
  const rewordMarket = (id: MarketId) =>
    run(
      () => actions.rewordMarketAction(view.id, view.version),
      `${marketName(id)} version reworded`,
      () => openOnMarket(id),
    )

  return (
    <div className="flex flex-col gap-4">
      <Toggle
        legend="Market"
        showLegend
        options={shownOptions(market?.body)}
        value={shown}
        onChange={onShow}
      />
      {offerMarket && (
        <div className="flex flex-wrap items-center gap-3">
          <Label htmlFor={`${ids}-market`}>For market</Label>
          <NativeSelect
            id={`${ids}-market`}
            className="w-auto"
            value={marketId}
            disabled={making}
            onChange={(e) => setMarketId(e.target.value as MarketId)}
          >
            {MARKETS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </NativeSelect>
          {making ? (
            <>
              <Button variant="outline" disabled>
                <Spin />
                Running…
              </Button>
              <Working words={movesWait(['market']) ?? ''} />
            </>
          ) : (
            <Button variant="outline" onClick={makeMarket}>
              Make market version
            </Button>
          )}
          {refused}
        </div>
      )}
      {offerReword && market && (
        <div className="flex flex-wrap items-center gap-3">
          {making ? (
            <>
              <Button variant="outline" disabled>
                <Spin />
                Running…
              </Button>
              <Working words={movesWait(['market']) ?? ''} />
            </>
          ) : (
            <Button variant="outline" onClick={() => rewordMarket(market.body.market)}>
              {`Reword for ${marketName(market.body.market)}`}
            </Button>
          )}
          {refused}
        </div>
      )}
    </div>
  )
}

/**
 * A rendered post as it goes out, on the Settings step beside its panels (criteria 55, 85): the
 * version the market versions' panel chose, the stored slides or the market version's, the
 * selected one over a filmstrip (SlideStage), and "Preview in context", the post as a feed card.
 * Nothing here changes a slide: the pictures are on Images.
 */
export function PostPreview({ view, shown }: { view: WorkbenchView; shown: Shown }) {
  const ids = useId()
  const { render, layout, market } = view.current
  const [seen, setSeen] = useState<PreviewView>('slides')
  if (!render) return null
  const shownVersion = shown === 'market' ? market : null

  return (
    <section
      aria-labelledby={`${ids}-heading`}
      // From @5xl it takes the height of its area, so the slide on the stage fits the step frame.
      className="flex flex-col gap-4 @5xl:min-h-0 @5xl:flex-1"
    >
      <h2 id={`${ids}-heading`} className="text-h4">
        Preview
      </h2>
      {!shownVersion && (
        <Toggle legend="View" options={PREVIEW_VIEWS} value={seen} onChange={setSeen} />
      )}
      {shownVersion ? (
        <MarketSlides market={shownVersion.body} stage />
      ) : seen === 'context' ? (
        <ContextPreview view={view} render={render.body} />
      ) : (
        <RenderedSlides
          render={render.body}
          layout={layout?.body.slides}
          stage
          below={() => <DownloadSlides postId={view.id} />}
        />
      )}
    </section>
  )
}
