import Link from 'next/link'
import { Blueprint } from '@/shared/components/Blueprint'
import { cn } from '@/shared/lib/utils'
import { type LanguageId, labelledLanguage } from '../languages'
import type { STUDIO_LINKS } from '../lib/lines'
import type { FeedSettings } from '../model/types'
import { tag } from './classes'

/** The call to action each Studio link shows on a card, as the design words it. */
const STUDIO_CTAS: Record<(typeof STUDIO_LINKS)[number], string> = {
  'Work rights weight': 'Open your Studio · Work rights weighted',
  'Compare view': 'Compare your ranked routes',
}

/** The tag a layer shows on a card: Personal reads "For you", General has none. */
export const LAYER_TAGS: Record<FeedSettings['layer'], string | null> = {
  general: null,
  featured: 'Featured',
  personal: 'For you',
}

/** The 1080 × 1350 canvas of a stored slide, so the card keeps the cover's shape while it loads. */
const COVER_WIDTH = 1080
const COVER_HEIGHT = 1350

type PhoneFeedCardProps = {
  /** The stored cover PNG. */
  coverSrc: string
  /** Where the title leads (the post's page in the feed); plain text without it. */
  href?: string
  title: string
  excerpt: string
  /** Null before the editor has saved any: the card then shows the post alone. */
  settings: FeedSettings | null
  sourceLine: string | null
  /** The language the post is written in; one not English is labelled with its own name (GD40). */
  language?: LanguageId
}

/** The Studio call to action for a settings' link, or null. Text only: no Studio exists to link to. */
export function ctaOf(studioLink: string | null): string | null {
  return STUDIO_CTAS[studioLink as keyof typeof STUDIO_CTAS] ?? null
}

/** A post or blog's language as a tag, in its own name and marked as that language (GD40); nothing for English. */
export function LanguageTag({ language }: { language: LanguageId | undefined }) {
  const labelled = labelledLanguage(language)
  if (!labelled) return null
  return (
    <p lang={labelled.id} className={cn(tag, 'self-start')}>
      {labelled.nativeLabel}
    </p>
  )
}

/**
 * The post as a student would meet it in the feed: a phone-sized frame (360 px, `w-90`) with the
 * layer tag, its language when it is not English (GD40), the stored cover, title and excerpt, the
 * why line, the Studio call to action and the source line. Only what the editor already approved or set; nothing is drawn here.
 */
export function PhoneFeedCard({
  coverSrc,
  href,
  title,
  excerpt,
  settings,
  sourceLine,
  language,
}: PhoneFeedCardProps) {
  const layer = settings ? LAYER_TAGS[settings.layer] : null
  const cta = ctaOf(settings?.studioLink ?? null)
  return (
    <Blueprint className="flex w-90 max-w-full flex-col gap-3 p-3 wrap-anywhere">
      {layer && <p className={cn(tag, 'self-start')}>{layer}</p>}
      <LanguageTag language={language} />
      {/* The PNG is the final render from a route behind the session: nothing to optimise. */}
      {/* biome-ignore lint/performance/noImgElement: next/image would re-encode the exact render. */}
      <img
        src={coverSrc}
        alt={`Cover of ${title}`}
        width={COVER_WIDTH}
        height={COVER_HEIGHT}
        className="block h-auto w-full border"
      />
      <h3 className="text-h4">
        {href ? (
          <Link href={href} className="underline-offset-4 hover:underline">
            {title}
          </Link>
        ) : (
          title
        )}
      </h3>
      {excerpt && <p className="text-caption">{excerpt}</p>}
      {settings?.whyLine && <p className="text-caption text-accent-700">{settings.whyLine}</p>}
      {cta && <p className="border px-3 py-2 font-heading text-caption">{cta}</p>}
      {sourceLine && <p className="text-caption text-muted-foreground">{sourceLine}</p>}
    </Blueprint>
  )
}
