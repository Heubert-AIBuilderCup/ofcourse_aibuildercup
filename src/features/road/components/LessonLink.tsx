import Link from 'next/link'
import { buttonVariants } from '@/shared/components/ui/button'
import { cn } from '@/shared/lib/utils'
import { useBoardPath } from '../hooks/useBoardPath'
import { lessonPath } from '../model/routes'

/**
 * "? What happens here · 3-min lesson": a link to the lesson over the board. It pushes, so Back
 * returns; `onFollow` tells the board it was followed from there.
 */
export function LessonLink({
  lessonId,
  onFollow,
  className,
}: {
  lessonId: string
  onFollow: () => void
  className?: string
}) {
  const board = useBoardPath()
  return (
    <Link
      href={lessonPath(board, lessonId)}
      onClick={onFollow}
      className={cn(
        buttonVariants({ variant: 'square' }),
        'h-11 gap-2 self-start pr-3 pl-1.5 font-sans font-normal',
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="inline-flex size-5.5 items-center justify-center border border-current text-caption font-bold"
      >
        ?
      </span>
      What happens here · 3-min lesson
    </Link>
  )
}
