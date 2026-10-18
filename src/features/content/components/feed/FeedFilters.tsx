'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/shared/components/ui/button'
import { Checkbox } from '@/shared/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select'
import {
  chosenIn,
  type Filters,
  filterHref,
  SHOW_KINDS,
  type ShowKind,
  shows,
  tagValue,
  toggled,
  toggledShow,
} from '../../lib/feed'
import { TAG_GROUP_LABELS, TAG_GROUPS, type TagGroup, tagsIn } from '../../tags'
import { SearchBox } from './SearchBox'

/** Clear's value in the home dropdown: Radix keeps the empty string for "nothing chosen". */
const CLEAR = '__clear'

type Go = (change: Partial<Filters>) => void

/** The groups chosen nothing: every filter cleared (an empty `q` still names them, 84). */
const NONE: Partial<Filters> = { destination: [], home: null, theme: [], age: [], q: '' }

/** The Show group's words for each kind. */
const SHOW_LABELS: Record<ShowKind, string> = { updates: 'Updates', posts: 'Posts', blogs: 'Blogs' }

/**
 * The feed's filters, stacked (criteria 81–83): what to show first (her updates, with how many she
 * has, the posts, the blogs; all three ticked until she unticks one), the search box, then each tag group in the tag
 * file's order. Destination, theme and age list their values as checkboxes, so a group holds
 * several (a post passes with any of them), with Clear once something is ticked; home country
 * stays a one-choice dropdown, since it is also the market-version switch (82). Clear all empties
 * every one. A choice moves to the URL the chip led to (filterHref: the other filters kept, an
 * emptied URL still naming its filters, 84) without scrolling to the top. The feed shows it in its
 * side column, and in a sheet on a narrow screen.
 */
export function FeedFilters({
  pathname,
  filters,
  updateCount = 0,
}: {
  pathname: string
  filters: Filters
  /** How many updates are hers, beside the Updates box. */
  updateCount?: number
}) {
  const router = useRouter()
  const go: Go = (change) => router.push(filterHref(pathname, filters, change), { scroll: false })
  const any = TAG_GROUPS.some((g) => chosenIn(filters, g).length > 0) || filters.q !== ''
  return (
    <div className="flex w-full min-w-0 flex-col gap-stack">
      <fieldset className="flex min-w-0 flex-col gap-2">
        <legend className="mb-2 text-overline uppercase text-muted-foreground">Show</legend>
        {SHOW_KINDS.map((kind) => {
          const label =
            kind === 'updates' ? `${SHOW_LABELS[kind]} (${updateCount})` : SHOW_LABELS[kind]
          return (
            // biome-ignore lint/a11y/noLabelWithoutControl: the Radix checkbox inside is the control; the label forwards a press on its words to it.
            <label key={kind} className="flex cursor-pointer items-center gap-2">
              <Checkbox
                aria-label={label}
                checked={shows(filters, kind)}
                onCheckedChange={() => go(toggledShow(filters, kind))}
              />
              <span aria-hidden="true">{label}</span>
            </label>
          )
        })}
      </fieldset>
      <SearchBox pathname={pathname} filters={filters} />
      {TAG_GROUPS.map((group) =>
        group === 'home' ? (
          <HomeSelect key={group} filters={filters} go={go} />
        ) : (
          <CheckList key={group} group={group} filters={filters} go={go} />
        ),
      )}
      {any && (
        <Button type="button" variant="outline" className="self-start" onClick={() => go(NONE)}>
          Clear all
        </Button>
      )}
    </div>
  )
}

/** Home country: one market, or none. */
function HomeSelect({ filters, go }: { filters: Filters; go: Go }) {
  const label = TAG_GROUP_LABELS.home
  return (
    <div className="flex w-full min-w-0 flex-col gap-2">
      <p className="text-overline uppercase text-muted-foreground">{label}</p>
      <Select
        value={filters.home ?? ''}
        onValueChange={(v) => go(v === CLEAR ? { home: null } : toggled(filters, 'home', v))}
      >
        <SelectTrigger
          aria-label={label}
          className="h-10 w-full justify-between text-left font-heading"
        >
          <SelectValue placeholder={label} />
        </SelectTrigger>
        <SelectContent>
          {tagsIn('home').map((tag) => (
            <SelectItem key={tag.id} value={tagValue(tag.id)}>
              {tag.label}
            </SelectItem>
          ))}
          {filters.home && <SelectItem value={CLEAR}>Clear</SelectItem>}
        </SelectContent>
      </Select>
    </div>
  )
}

/** A group that holds several values: a checkbox per value, and Clear once one is ticked. */
function CheckList({
  group,
  filters,
  go,
}: {
  group: Exclude<TagGroup, 'home'>
  filters: Filters
  go: Go
}) {
  const chosen = filters[group]
  return (
    <fieldset className="flex min-w-0 flex-col gap-2">
      <legend className="mb-2 text-overline uppercase text-muted-foreground">
        {TAG_GROUP_LABELS[group]}
      </legend>
      {tagsIn(group).map((tag) => {
        const value = tagValue(tag.id)
        return (
          // biome-ignore lint/a11y/noLabelWithoutControl: the Radix checkbox inside is the control; the label forwards a press on its words to it.
          <label key={tag.id} className="flex cursor-pointer items-center gap-2">
            <Checkbox
              aria-label={tag.label}
              checked={chosen.includes(value)}
              onCheckedChange={() => go(toggled(filters, group, value))}
            />
            <span aria-hidden="true">{tag.label}</span>
          </label>
        )
      })}
      {chosen.length > 0 && (
        <Button
          type="button"
          variant="text"
          className="self-start"
          onClick={() => go({ [group]: [] })}
        >
          Clear
        </Button>
      )}
    </fieldset>
  )
}
