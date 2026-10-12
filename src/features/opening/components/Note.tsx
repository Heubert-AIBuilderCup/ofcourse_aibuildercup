import { ArrowRight, Info } from 'lucide-react'
import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/shared/lib/utils'

type Tone = 'impact' | 'limit' | 'hint'

const TONES: Record<Tone, string> = {
  /** What a change does: the accent line. */
  impact: 'border-l-2 border-accent-700 bg-accent-100/70 px-4 py-3',
  /** What cannot be done, or what holds: the grey line. */
  limit: 'border-l-2 border-neutral-600 bg-neutral-100 px-3.5 py-2.5',
  /** A quiet caption under the content. */
  hint: 'text-caption text-muted-foreground',
}

const ICON = 'icon-on-line-sm size-icon-sm shrink-0'
const ICONS: Record<Tone, ReactNode> = {
  impact: <ArrowRight aria-hidden="true" className={cn(ICON, 'text-accent-700')} />,
  limit: <Info aria-hidden="true" className={cn(ICON, 'text-neutral-700')} />,
  hint: <Info aria-hidden="true" className={ICON} />,
}

/**
 * A note on a step: its icon, then its words. `icon` replaces the tone's own; `null` leaves it out,
 * and a limit or hint without one is plain text. An impact note's words are a paragraph, so they
 * may hold a tag or an sr-only lead; the others are a line. `className` adds the place's size or
 * motion.
 */
export function Note({
  tone,
  icon,
  className,
  children,
  ...props
}: HTMLAttributes<HTMLElement> & { tone: Tone; icon?: ReactNode }) {
  const mark = icon === undefined ? ICONS[tone] : icon
  if (tone === 'impact') {
    return (
      <div className={cn('flex items-start gap-2.5', TONES.impact, className)} {...props}>
        {mark}
        <p className="m-0">{children}</p>
      </div>
    )
  }
  return (
    <p className={cn('m-0', mark && 'flex items-start gap-2', TONES[tone], className)} {...props}>
      {mark}
      {mark ? <span>{children}</span> : children}
    </p>
  )
}
