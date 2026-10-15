import { AdminPageHeader } from '@/features/admin'
import { PATHS } from '@/features/content/lib/path-facts'
import { comicStatuses } from '@/features/content/server/store'
import { InsightsTable } from '@/features/insights/components/InsightsTable'
import { rankPaths } from '@/features/insights/lib/rank'
import mockViews from '@/features/insights/mock-views.json'
import { pathShowingStats, pathViewCounts } from '@/features/insights/server/views'
import { canEdit } from '@/shared/lib/auth/access'
import { requireBoard } from '@/shared/lib/auth/session'

/**
 * The paths students were shown, ranked, with how each was shown and its comic (RC13, RC14, RC18).
 * Everyone who sees the Board.
 */
export default async function AdminComicGapsPage() {
  const { user } = await requireBoard()
  const [real, comics, showings] = await Promise.all([
    pathViewCounts(),
    comicStatuses(),
    pathShowingStats(),
  ])
  return (
    <>
      <AdminPageHeader
        title="Comic gaps"
        lede="Paths students were shown in the last 30 days, counted once per student a day, with no names kept."
      />
      <InsightsTable
        rows={rankPaths(PATHS, real, comics, showings, mockViews)}
        canMake={canEdit(user)}
      />
    </>
  )
}
