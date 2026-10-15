import { redirect } from 'next/navigation'
import { getProfile } from '@/features/opening/server/profile'
import { roadRedirect } from '@/features/road'
import { listRoadmaps } from '@/features/roadmaps/server/roadmaps'
import { requireStudent } from '@/shared/lib/auth/session'
import { ROADMAPS_PATH, roadmapPath } from '@/shared/lib/student-paths'

/**
 * The old board's URL: on to her last opened roadmap, in one hop; before onboarding is closed,
 * where she left off, as a roadmap's board would send her.
 */
export default async function RoadPage() {
  const { user } = await requireStudent()
  const [profile, roadmaps] = await Promise.all([getProfile(user.id), listRoadmaps(user.id)])
  const to = roadRedirect(profile)
  if (to) redirect(to)
  const [last] = roadmaps
  redirect(last ? roadmapPath(last.id) : ROADMAPS_PATH)
}
