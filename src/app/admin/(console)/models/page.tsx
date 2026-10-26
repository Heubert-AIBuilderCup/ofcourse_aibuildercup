import { AdminPageHeader } from '@/features/admin'
import {
  resetAction,
  saveTierModelAction,
  saveUseCaseTierAction,
  testAction,
  testStudentCallsAction,
} from '@/features/admin/models/actions'
import { ModelsScreen } from '@/features/admin/models/components/ModelsScreen'
import { defaultTier } from '@/features/admin/models/test-call'
import { USE_CASES } from '@/features/admin/models/use-cases'
import { aiConfig, type Tier, type UseCase } from '@/features/content/ai/config'
import { lastChanges, readSettings } from '@/features/content/ai/settings'
import { canManageModels } from '@/shared/lib/auth/access'
import { requireAdmin } from '@/shared/lib/auth/session'

/** How many change log entries the page shows (criterion 98). */
const CHANGES_SHOWN = 20

/**
 * Each model call's tier and model, each tier's model and its health, and the last changes. Admins
 * and superadmins see it; only a superadmin tests, changes or resets (the actions check again).
 */
export default async function AdminModelsPage() {
  const { user } = await requireAdmin()
  // readSettings fails open on its own; the log, from the same migration, says whether the tables
  // can be read, so the page shows the environment's models and says why instead of erroring.
  const [settings, changes] = await Promise.all([
    readSettings(),
    lastChanges(CHANGES_SHOWN).catch((err: unknown) => {
      console.error('[admin.models] the model settings cannot be read', err)
      return null
    }),
  ])
  const defaultTiers = Object.fromEntries(USE_CASES.map((u) => [u, defaultTier(u)])) as Record<
    UseCase,
    Tier
  >
  return (
    <>
      <AdminPageHeader
        kicker="AI"
        title="Models"
        lede="Which model each AI call runs on, whether it is healthy, and who changed it last."
      />
      <ModelsScreen
        canManage={canManageModels(user.role)}
        defaultTiers={defaultTiers}
        envModels={aiConfig(process.env).models}
        settings={settings}
        changes={changes ?? []}
        unavailable={changes === null}
        actions={{
          test: testAction,
          testStudentCalls: testStudentCallsAction,
          saveTierModel: saveTierModelAction,
          saveUseCaseTier: saveUseCaseTierAction,
          reset: resetAction,
        }}
      />
    </>
  )
}
