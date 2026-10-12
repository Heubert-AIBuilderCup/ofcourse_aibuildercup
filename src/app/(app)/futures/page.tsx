import { buildFutures } from '@/features/engine'
import { activeRelative, FuturesScreen } from '@/features/opening'
import { addReminderAction, saveAnswersAction } from '@/features/opening/actions'
import { getProfile } from '@/features/opening/server/profile'
import { requireStudent } from '@/shared/lib/auth/session'

/**
 * Her futures from her saved answers, parked outside onboarding until their own feature places
 * them: opening it records no step, so it never moves where /onboarding resumes. The greeting
 * reads the stored `seenFutures` as it is. The browser redraws with the same buildFutures, so the
 * same answers draw the same futures on both (criterion 48).
 */
export default async function FuturesPage() {
  const { user } = await requireStudent()
  const profile = await getProfile(user.id)
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
