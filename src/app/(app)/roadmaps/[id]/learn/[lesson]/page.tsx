import { notFound } from 'next/navigation'
import { lessonById } from '@/features/road'
import { roadmapRoad } from '@/features/roads/server/roadmap-road'
import { requireStudent } from '@/shared/lib/auth/session'

/**
 * The 3-min lesson, over the board (the layout's): the board reads it from the route and shows it
 * in its card column until Back. A roadmap that is not hers, or an id its road has no lesson for,
 * is a 404.
 */
export default async function RoadLessonPage({
  params,
}: PageProps<'/roadmaps/[id]/learn/[lesson]'>) {
  const [{ user }, { id, lesson }] = await Promise.all([requireStudent(), params])
  const found = await roadmapRoad(user.id, id)
  if (!found) notFound()
  const { road } = found.road
  if (!lessonById(road, lesson)) notFound()

  return null
}
