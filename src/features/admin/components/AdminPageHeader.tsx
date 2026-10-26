import type { ReactNode } from 'react'

/**
 * A page's title as the design's page top draws it: the kicker over the h1, one line on what the
 * page is for, and the page's own actions on the right (below @xl, under it, full width).
 */
export function AdminPageHeader({
  kicker,
  title,
  lede,
  children,
}: {
  kicker: string
  title: string
  lede?: ReactNode
  children?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-6 @max-xl:flex-col @max-xl:items-stretch @max-xl:gap-4">
      <div className="flex min-w-0 flex-col gap-1.5">
        <p className="font-heading text-caption font-medium tracking-widest text-accent-700 uppercase">
          {kicker}
        </p>
        <h1 className="text-h1 leading-none font-semibold wrap-anywhere">{title}</h1>
        {lede ? <p className="mt-1 max-w-prose text-lead text-muted-foreground">{lede}</p> : null}
      </div>
      {children ? <div className="flex flex-wrap items-center gap-3">{children}</div> : null}
    </div>
  )
}
