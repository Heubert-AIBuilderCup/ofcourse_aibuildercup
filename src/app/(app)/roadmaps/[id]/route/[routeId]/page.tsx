import { notFound } from 'next/navigation'
import { routeStep } from '@/features/road'
import { roadmapRoad } from '@/features/roads/server/roadmap-road'
import { requireStudent } from '@/shared/lib/auth/session'

/**
 * A route step's detail, over the board: the board reads it from the route; its screen comes next
 * round, a placeholder until then. A roadmap that is not hers, or an id that is not a step on its
 * road's route, is a 404.
 */
export default async function RoadRoutePage({
  params,
}: PageProps<'/roadmaps/[id]/route/[routeId]'>) {
  const [{ user }, { id, routeId }] = await Promise.all([requireStudent(), params])
  const found = await roadmapRoad(user.id, id)
  if (!found) notFound()
  const { road } = found.road
  if (!routeStep(road, routeId)) notFound()

  return null
}
