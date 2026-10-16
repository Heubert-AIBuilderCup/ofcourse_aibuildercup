'use client'

import { useRouter } from 'next/navigation'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select'
import { type Filters, filterHref, tagValue } from '../../lib/feed'
import { TAG_GROUP_LABELS, TAG_GROUPS, type TagGroup, tagsIn } from '../../tags'
import { SearchBox } from './SearchBox'

/** Clear's value in a dropdown: Radix keeps the empty string for "nothing chosen". */
const CLEAR = '__clear'

/** One filter changed. A home value is a market id: the tag file refuses any other (tags/index.ts). */
const only = (group: TagGroup, value: string | null): Partial<Filters> =>
  ({ [group]: value }) as Partial<Filters>

/**
 * The feed's filters in one row (criteria 81–83): the search box, then a dropdown per tag group
 * in the tag file's order, each showing its choice or the group's name, with its options and,
 * once something is chosen, Clear. Home country is also the market-version switch (82). A choice
 * moves to the URL the chip led to (filterHref: the other filters kept, an emptied URL still
 * naming its filters, 84) without scrolling to the top. The row wraps on a narrow screen.
 */
export function FeedFilters({ pathname, filters }: { pathname: string; filters: Filters }) {
  const router = useRouter()
  const go = (group: TagGroup, value: string) =>
    router.push(filterHref(pathname, filters, only(group, value === CLEAR ? null : value)), {
      scroll: false,
    })
  return (
    <div className="flex flex-wrap items-center gap-2">
      <SearchBox pathname={pathname} filters={filters} />
      {TAG_GROUPS.map((group) => {
        const active = filters[group]
        const label = TAG_GROUP_LABELS[group]
        return (
          <Select key={group} value={active ?? ''} onValueChange={(v) => go(group, v)}>
            <SelectTrigger aria-label={label} className="h-10 w-auto min-w-32 gap-2 font-heading">
              <SelectValue placeholder={label} />
            </SelectTrigger>
            <SelectContent>
              {tagsIn(group).map((tag) => (
                <SelectItem key={tag.id} value={tagValue(tag.id)}>
                  {tag.label}
                </SelectItem>
              ))}
              {active && <SelectItem value={CLEAR}>Clear</SelectItem>}
            </SelectContent>
          </Select>
        )
      })}
    </div>
  )
}
