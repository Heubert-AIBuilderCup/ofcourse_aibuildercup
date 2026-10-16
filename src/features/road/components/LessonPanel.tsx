import { Button } from '@/shared/components/ui/button'
import type { Lesson } from '../model/road-data'
import { PanelHead } from './PanelHead'

/** The 3-min lesson over the board: its points, then "Done reading" and "Later". */
export function LessonPanel({
  lesson,
  onDone,
  onLater,
}: {
  lesson: Lesson
  onDone: () => void
  onLater: () => void
}) {
  return (
    <section aria-label={lesson.title} className="flex flex-col gap-4">
      <PanelHead kicker={lesson.kicker} title={lesson.title} onClose={onLater} />
      <ol className="m-0 flex max-w-prose flex-col gap-3 pl-5">
        {lesson.points.map((point) => (
          <li key={point}>{point}</li>
        ))}
      </ol>
      <div className="flex flex-col gap-2">
        <Button type="button" variant="strong" className="h-12 w-full" onClick={onDone}>
          Done reading
        </Button>
        <Button type="button" variant="outline" className="h-12 w-full" onClick={onLater}>
          Later
        </Button>
      </div>
    </section>
  )
}
