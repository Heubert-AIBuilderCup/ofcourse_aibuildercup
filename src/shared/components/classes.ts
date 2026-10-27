// Class strings more than one feature shares, in a module with no client directive, so server and
// client components read the same strings.

/** A one-word status in a hairline tag (Industry: "Status is one word in a tag"). */
export const tag = 'border px-2 py-0.5 text-caption'

/**
 * The admin's hairline table (the design's a2-table): a heavy rule on top, hairlines between
 * rows, no frame and no corner marks. Below @xl each row stacks into a block of its own and the
 * head hides. The parts go on plain table elements or on shadcn's Table parts, whose own classes
 * they override; `wrap` is for a plain table (shadcn's Table brings its own scroller).
 */
export const hairlineTable = {
  wrap: 'overflow-x-auto',
  table: 'w-full border-collapse border-t-2 border-foreground text-base @max-xl:block',
  head: '@max-xl:hidden',
  body: '@max-xl:block',
  th: 'h-auto border-b px-3 py-3 text-left font-heading text-overline font-medium tracking-widest whitespace-nowrap text-muted-foreground uppercase',
  tr: 'border-b hover:bg-accent-100/45 @max-xl:block @max-xl:py-3 @max-xl:hover:bg-transparent',
  td: 'px-3 py-3 align-middle @max-xl:block @max-xl:px-0 @max-xl:py-0.75',
} as const

/** Where a list or a column has nothing to show: a dashed box with one line. */
export const emptyBox =
  'flex min-h-18 items-center border border-dashed border-foreground/30 px-4 text-caption text-muted-foreground'

/** A filter's label beside its select. */
export const filterLabel =
  'font-heading text-caption font-medium tracking-widest text-muted-foreground uppercase'
