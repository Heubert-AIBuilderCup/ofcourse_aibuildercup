import { useId } from 'react'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { chosenIn, type Filters, MAX_QUERY_LENGTH } from '../../lib/feed'
import { TAG_GROUPS } from '../../tags'

/**
 * The feed's search (criterion 83): a plain GET form, so the words land in the URL as `q` beside
 * the chips, which ride along as hidden fields, one per value (the key repeated), Show's first. No client code; the page reads the URL and
 * filters the live posts in code.
 */
export function SearchBox({ pathname, filters }: { pathname: string; filters: Filters }) {
  // Its own id: the feed may show the filters twice (its side column, and a sheet when narrow).
  const id = useId()
  return (
    // biome-ignore lint/a11y/useSemanticElements: React and happy-dom do not know <search> yet; the role is the supported landmark.
    <form
      role="search"
      method="get"
      action={pathname}
      className="flex min-w-0 flex-wrap items-center gap-2"
    >
      <label htmlFor={id} className="sr-only">
        Search
      </label>
      <Input
        id={id}
        type="search"
        name="q"
        defaultValue={filters.q}
        maxLength={MAX_QUERY_LENGTH}
        placeholder="Search posts"
        autoComplete="off"
        className="min-w-0 flex-1 basis-32"
      />
      {/* Show as filterHref writes it: a key per kind ticked, one empty key when none is, none when all are. */}
      {filters.show &&
        (filters.show.length === 0 ? [''] : filters.show).map((kind) => (
          <input key={`show-${kind}`} type="hidden" name="show" value={kind} />
        ))}
      {TAG_GROUPS.flatMap((group) =>
        chosenIn(filters, group).map((value) => (
          <input key={`${group}-${value}`} type="hidden" name={group} value={value} />
        )),
      )}
      <Button type="submit" variant="outline">
        Search
      </Button>
    </form>
  )
}
