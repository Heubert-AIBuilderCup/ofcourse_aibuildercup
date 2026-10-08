/**
 * The band in the primary colour that opens a student page: an overline, a title and an optional
 * sub. Its phone layout queries the nearest `@container`, so place it inside one.
 */
export function Hero({ overline, title, sub }: { overline: string; title: string; sub?: string }) {
  return (
    // Marked light: the band keeps its steel in a dark page, as the steel panels do.
    <header
      data-theme="light"
      className="bg-primary-strong px-gutter py-section text-primary-strong-foreground @max-[35rem]:px-5 @max-[35rem]:py-8"
    >
      <div className="flex max-w-2xl flex-col gap-2">
        <p className="m-0 text-overline uppercase">{overline}</p>
        <h1 className="m-0 font-heading text-h1 font-semibold">{title}</h1>
        {sub ? <p className="m-0 text-lead">{sub}</p> : null}
      </div>
    </header>
  )
}
