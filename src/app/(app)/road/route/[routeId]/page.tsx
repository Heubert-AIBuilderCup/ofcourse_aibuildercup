import { notFound } from 'next/navigation'
import { getRoad, routeStep } from '@/features/road'

/**
 * A route step's detail, over the board: the board reads it from the route; its screen comes next
 * round, a placeholder until then. An id that is not a route step is a 404.
 */
export default async function RoadRoutePage({ params }: PageProps<'/road/route/[routeId]'>) {
  const { routeId } = await params
  if (!routeStep(getRoad(), routeId)) notFound()

  return null
}
