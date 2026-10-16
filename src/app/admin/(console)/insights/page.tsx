import { InsightsOverview } from '@/features/insights/components/InsightsOverview'
import { performanceRows, rankEvidenceGaps, updateReach } from '@/features/insights/lib/overview'
import { OVERVIEW } from '@/features/insights/overview'
import { liveFeedPosts, weekFigures } from '@/features/insights/server/overview'
import { MOCK_STUDENTS } from '@/features/updates'
import { latestLiveUpdate } from '@/features/updates/server/updates'
import { canEdit } from '@/shared/lib/auth/access'
import { requireBoard } from '@/shared/lib/auth/session'

/**
 * The Insights overview: what is happening, read-only. Everyone who sees the Board; "Research this"
 * on an evidence gap is an editor's.
 */
export default async function AdminInsightsPage() {
  const { user } = await requireBoard()
  const [week, live, latest] = await Promise.all([
    weekFigures(),
    liveFeedPosts(OVERVIEW.performance.length),
    latestLiveUpdate(),
  ])
  return (
    <InsightsOverview
      data={OVERVIEW}
      week={week}
      gaps={rankEvidenceGaps(OVERVIEW.evidenceGaps)}
      performance={performanceRows(live, OVERVIEW.performance)}
      livePosts={live.length > 0}
      // Reach is counted over the mock students, so it is labelled mock either way.
      reach={{ ...updateReach(latest, OVERVIEW.updateReach, MOCK_STUDENTS), mock: true }}
      editable={canEdit(user)}
    />
  )
}
