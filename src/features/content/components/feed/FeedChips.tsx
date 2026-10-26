import Link from 'next/link'
import { cn } from '@/shared/lib/utils'
import { chosenIn, type Filters, filterHref, tagValue, toggled } from '../../lib/feed'
import { TAG_GROUP_LABELS, TAG_GROUPS, type TagGroup, tagsIn } from '../../tags'

/** A group cleared: no home market, or no values. */
const cleared = (group: TagGroup): Partial<Filters> =>
  group === 'home' ? { home: null } : { [group]: [] }

const quiet = 'text-muted-foreground hover:text-foreground'

/**
 * Four rows of link chips from the tag file, one per group (criterion 81). A chip adds its value
 * to its row's choices or takes it away (lib/feed.ts toggled), so a row holds several; the home
 * row holds one, since it is also the market-version switch (criterion 82). Links, so the picks
 * live in the URL and survive the move between the feed and its pages; each keeps every other
 * filter. Each chosen chip is `aria-current`, and a row with one offers Clear.
 */
export function FeedChips({ pathname, filters }: { pathname: string; filters: Filters }) {
  return (
    <nav aria-label="Filters" className="flex flex-col gap-2">
      {TAG_GROUPS.map((group) => {
        const chosen = chosenIn(filters, group)
        return (
          <fieldset key={group} className="flex min-w-0 flex-wrap items-center gap-2">
            {/* Floated, so the legend sits in the row with its chips instead of above the frame. */}
            <legend className="float-left text-overline uppercase text-muted-foreground">
              {TAG_GROUP_LABELS[group]}
            </legend>
            {tagsIn(group).map((tag) => {
              const value = tagValue(tag.id)
              const on = chosen.includes(value)
              return (
                <Link
                  key={tag.id}
                  href={filterHref(pathname, filters, toggled(filters, group, value))}
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
            {chosen.length > 0 && (
              <Link
                href={filterHref(pathname, filters, cleared(group))}
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
