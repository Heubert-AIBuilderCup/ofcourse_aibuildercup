import type { MatchLine } from '../model/match-line'
import { MockTag } from './MockTag'

// The roadmaps list's dashed chip, for an answer the road differs from.
const CHIP = 'border border-dashed border-foreground/45 px-2 py-0.5 text-caption leading-snug'

/**
 * The line under the board's header when the road is not exactly hers: "Closest road to your
 * answers" with a chip per answer it differs from, or the illustrative road's line; then mock.
 */
export function MatchStrip({ line }: { line: MatchLine }) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b px-6 py-2 @max-5xl:px-4">
      <p className="text-caption text-muted-foreground">{line.title}</p>
      {line.chips.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {line.chips.map((chip) => (
            <li key={chip} className={CHIP}>
              {chip}
            </li>
          ))}
        </ul>
      ) : null}
      <MockTag />
    </div>
  )
}
