import Link from 'next/link'
import { Blueprint } from '@/shared/components/Blueprint'
import { type CardUpdate, KIND_LABELS, longDate } from '../lib/update'

const overline = 'text-overline text-muted-foreground uppercase'
const caption = 'text-caption text-muted-foreground'
const button = 'self-start border px-3 py-1.5 font-heading text-caption'

/**
 * A targeted update as a student sees it: what it is, what it says, why she sees it and its
 * source. On her feed its button opens the roadmap it is hers through (`href`); in the admin
 * preview, given none, the button is drawn and cannot be pressed (AD-E27).
 */
export function UpdateCard({
  update,
  badge,
  why,
  href,
}: {
  update: CardUpdate
  badge: string
  why: string
  href?: string
}) {
  return (
    <Blueprint className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <span className={caption}>{`OfCourse · ${KIND_LABELS[update.kind].toLowerCase()}`}</span>
        <span className="border border-accent-700 px-2 py-0.5 font-heading text-overline font-medium tracking-widest text-accent-700 uppercase">
          {badge}
        </span>
      </div>
      <p className={overline}>{`${update.category} · ${update.institution}`}</p>
      <h3 className="text-h4">{update.title}</h3>
      <p className="text-caption">{update.body}</p>
      {update.applyBy && (
        <p className="text-caption font-semibold">{`Apply by ${longDate(update.applyBy)}`}</p>
      )}
      <p className="border p-2 text-caption">{why}</p>
      {href ? (
        <Link href={href} className={`${button} hover:bg-accent`}>
          See it on your roadmap →
        </Link>
      ) : (
        <span className={button}>See it on your roadmap →</span>
      )}
      <p className={caption}>
        {`Source: ${update.sourceTitle} · checked ${longDate(update.sourceCheckedAt)}`}
      </p>
    </Blueprint>
  )
}
