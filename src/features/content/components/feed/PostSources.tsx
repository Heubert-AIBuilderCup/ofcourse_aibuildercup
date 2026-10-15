import { useId } from 'react'
import { type PostSource, sourceLabel } from '../../lib/sites'

/**
 * A post's sources under its slides (GD31), on the feed post page and the public page: each by
 * its site and title, linked to the page it was read from when it has one.
 */
export function PostSources({
  sources,
  heading = 'Sources',
}: {
  sources: readonly PostSource[]
  /** The heading in the post's language (GD39). */
  heading?: string
}) {
  const id = useId()
  return (
    <section aria-labelledby={id} className="flex max-w-prose flex-col gap-2">
      <h2 id={id} className="text-h4">
        {heading}
      </h2>
      <ul aria-labelledby={id} className="flex flex-col gap-1 text-caption">
        {sources.map((s) => (
          <li key={s.url ?? sourceLabel(s)}>
            {s.url ? (
              <a
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="underline-offset-4 hover:underline"
              >
                {sourceLabel(s)}
              </a>
            ) : (
              sourceLabel(s)
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
