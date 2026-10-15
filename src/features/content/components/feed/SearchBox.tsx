import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { type Filters, MAX_QUERY_LENGTH } from '../../lib/feed'
import { TAG_GROUPS } from '../../tags'

/**
 * The feed's search (criterion 83): a plain GET form, so the words land in the URL as `q` beside
 * the chips, which ride along as hidden fields. No client code; the page reads the URL and
 * filters the live posts in code.
 */
export function SearchBox({ pathname, filters }: { pathname: string; filters: Filters }) {
  return (
    // biome-ignore lint/a11y/useSemanticElements: React and happy-dom do not know <search> yet; the role is the supported landmark.
    <form role="search" method="get" action={pathname} className="flex items-center gap-2">
      <label htmlFor="feed-search" className="sr-only">
        Search
      </label>
      <Input
        id="feed-search"
        type="search"
        name="q"
        defaultValue={filters.q}
        maxLength={MAX_QUERY_LENGTH}
        placeholder="Search posts"
        autoComplete="off"
        className="max-w-xs"
      />
      {TAG_GROUPS.map((group) => {
        const value = filters[group]
        return value && <input key={group} type="hidden" name={group} value={value} />
      })}
      <Button type="submit" variant="outline">
        Search
      </Button>
    </form>
  )
}
