import { SITE_NAME } from '@/shared/lib/site'
import { PAGE_BRANDS } from '../../brands'
import type { Brand } from '../../model/types'

/**
 * "Follow OfCourse on Instagram" (criterion 88, ADR-124): one link per page brand that has an
 * Instagram account, at the end of the feed and of a post's page. With `linkedin`, a blog's
 * "Follow us" (BR9): the Instagram accounts, then each page brand's LinkedIn page by its byline.
 * The pages are brand data; with none, nothing.
 */
export function FollowPages({
  brands = PAGE_BRANDS,
  linkedin = false,
}: {
  brands?: readonly Brand[]
  linkedin?: boolean
}) {
  const pages = [
    ...brands.flatMap((b) =>
      b.instagram
        ? [{ key: `ig-${b.id}`, url: b.instagram.url, label: `@${b.instagram.handle}` }]
        : [],
    ),
    ...(linkedin
      ? brands.flatMap((b) =>
          b.linkedin ? [{ key: `in-${b.id}`, url: b.linkedin.url, label: b.byline }] : [],
        )
      : []),
  ]
  if (pages.length === 0) return null
  return (
    <footer className="flex flex-col gap-2">
      <p className="text-caption text-muted-foreground">
        {linkedin ? 'Follow us' : `Follow ${SITE_NAME} on Instagram`}
      </p>
      <ul className="flex flex-wrap gap-x-4 gap-y-1">
        {pages.map((page) => (
          <li key={page.key}>
            <a
              href={page.url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-heading underline-offset-4 hover:underline"
            >
              {page.label}
            </a>
          </li>
        ))}
      </ul>
    </footer>
  )
}
