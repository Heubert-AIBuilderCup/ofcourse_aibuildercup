import { buildFutures } from '@/features/engine'
import { activeRelative, FuturesScreen } from '@/features/opening'
import { addReminderAction, saveAnswersAction } from '@/features/opening/actions'
import { getProfile, markStep } from '@/features/opening/server/profile'
import { requireStudent } from '@/shared/lib/auth/session'

/**
 * Screen 5, and home on a return visit: her futures from her saved answers. The browser redraws
 * with the same buildFutures, so the same answers draw the same futures on both (criterion 48).
 */
export default async function FuturesPage() {
  const { user } = await requireStudent()
  // Read before marking: whether she has been here before decides how the page greets her.
  const profile = await getProfile(user.id)
  await markStep(user.id, 'futures')
  const relative = activeRelative(profile.answers, profile.relative)

  return (
    <FuturesScreen
      initialAnswers={profile.answers}
      relative={relative}
      initial={buildFutures({ answers: profile.answers, relative })}
      coins={profile.coins}
      reminders={profile.reminders}
      returning={profile.seenFutures}
      saveAnswersAction={saveAnswersAction}
      addReminderAction={addReminderAction}
    />
  )
}
