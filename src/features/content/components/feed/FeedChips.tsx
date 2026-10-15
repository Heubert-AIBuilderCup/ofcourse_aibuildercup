import Link from 'next/link'
import { cn } from '@/shared/lib/utils'
import { type Filters, filterHref, tagValue } from '../../lib/feed'
import { TAG_GROUP_LABELS, TAG_GROUPS, type TagGroup, tagsIn } from '../../tags'

/** One filter changed. A home value is a market id: the tag file refuses any other (tags/index.ts). */
const only = (group: TagGroup, value: string | null): Partial<Filters> =>
  ({ [group]: value }) as Partial<Filters>

const quiet = 'text-muted-foreground hover:text-foreground'

/**
 * Four rows of link chips from the tag file, one per group (criterion 81). The home row is also
 * the market-version switch (criterion 82). Links, so the picks live in the URL and survive the
 * move between the feed and its pages; each keeps every other filter. The active chip is
 * `aria-current`, and a row with an active chip offers Clear.
 */
export function FeedChips({ pathname, filters }: { pathname: string; filters: Filters }) {
  return (
    <nav aria-label="Filters" className="flex flex-col gap-2">
      {TAG_GROUPS.map((group) => {
        const active = filters[group]
        return (
          <fieldset key={group} className="flex min-w-0 flex-wrap items-center gap-2">
            {/* Floated, so the legend sits in the row with its chips instead of above the frame. */}
            <legend className="float-left text-overline uppercase text-muted-foreground">
              {TAG_GROUP_LABELS[group]}
            </legend>
            {tagsIn(group).map((tag) => {
              const value = tagValue(tag.id)
              const on = value === active
              return (
                <Link
                  key={tag.id}
                  href={filterHref(pathname, filters, only(group, value))}
                  aria-current={on ? 'true' : undefined}
                  className={cn(
                    'border px-3 py-1 font-heading',
                    on ? 'border-primary bg-accent-200 text-foreground' : quiet,
                  )}
                >
                  {tag.label}
                </Link>
              )
            })}
            {active && (
              <Link
                href={filterHref(pathname, filters, only(group, null))}
                className={cn('text-caption underline-offset-4 hover:underline', quiet)}
              >
                Clear
              </Link>
            )}
          </fieldset>
        )
      })}
    </nav>
  )
}
