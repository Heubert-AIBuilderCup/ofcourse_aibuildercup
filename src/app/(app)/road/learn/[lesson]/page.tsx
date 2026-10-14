import { notFound } from 'next/navigation'
import { getRoad, lessonById } from '@/features/road'

/**
 * The 3-min lesson, over the board (the layout's): the board reads it from the route and shows it
 * in its card column until Back. An id the road has no lesson for is a 404.
 */
export default async function RoadLessonPage({ params }: PageProps<'/road/learn/[lesson]'>) {
  const { lesson } = await params
  if (!lessonById(getRoad(), lesson)) notFound()

  return null
}
