import 'server-only'
import { and, desc, eq } from 'drizzle-orm'
import { db } from '@/shared/lib/db'
import { aiSetting, aiSettingChange, user } from '@/shared/lib/db/schema'
import { ERROR_MAX, TIERS, type Tier, type UseCase } from './config'
import { allowedTiers, isKnownModel } from './models'

// The model settings a superadmin chose on the Models page (criteria 94–99) and their change log.
// One row per choice in ai_setting: `tier:<tier>` holds a model id, `usecase:<id>` a tier. With no
// row every call runs as before. Each instance keeps what it read for SETTINGS_TTL_MS, so another
// instance's save applies within that time; a save here empties the memory at once. The callers
// (the page's actions) check who may save and what may be saved; reading drops any row the rules
// in models.ts no longer allow, so a stored value can never lift a student call to Pro.

export const SETTINGS_TTL_MS = 30_000

/** A failed read is remembered only this long, so one database blip does not hold the environment's models for 30 seconds. */
export const FAILED_READ_TTL_MS = 5_000

/** How many log entries one read may return at most. */
const CHANGES_MAX = 100

export type AiSettings = {
  tierModels: Partial<Record<Tier, string>>
  useCaseTiers: Partial<Record<UseCase, Tier>>
  failing: Partial<Record<Tier, { error: string; at: string }>>
}

export type SettingChange = {
  key: string
  oldValue: string | null
  newValue: string | null
  userName: string | null
  at: string
}

let memory: { at: number; ttl: number; value: AiSettings } | null = null

const isTier = (value: string): value is Tier => (TIERS as readonly string[]).includes(value)

/**
 * The saved settings, from memory while they are younger than SETTINGS_TTL_MS. Fails open: settings
 * that cannot be read (the table not migrated yet, the database refusing) read as none, so every
 * call runs on the environment's models, and that is remembered for FAILED_READ_TTL_MS, so the
 * failing read is not repeated on every call. A read stamped after now (the clock stepped back) is
 * stale.
 */
export async function readSettings(): Promise<AiSettings> {
  if (memory) {
    const age = Date.now() - memory.at
    if (age >= 0 && age < memory.ttl) return memory.value
  }
  let value: AiSettings
  let ttl = SETTINGS_TTL_MS
  try {
    value = await readRows()
  } catch (err) {
    ttl = FAILED_READ_TTL_MS
    console.warn(
      "[ai] could not read the model settings; the environment's models apply",
      err instanceof Error ? err.message : err,
    )
    value = { tierModels: {}, useCaseTiers: {}, failing: {} }
  }
  memory = { at: Date.now(), ttl, value }
  return value
}

async function readRows(): Promise<AiSettings> {
  // Bounded: one row per tier and per use case at most.
  const rows = await db.select().from(aiSetting)
  const value: AiSettings = { tierModels: {}, useCaseTiers: {}, failing: {} }
  for (const row of rows) {
    const [kind, name] = row.key.split(':', 2)
    if (kind === 'tier' && isTier(name) && isKnownModel(row.value, name)) {
      value.tierModels[name] = row.value
      if (row.failing !== null && row.failingAt !== null) {
        value.failing[name] = { error: row.failing, at: row.failingAt.toISOString() }
      }
    } else if (kind === 'usecase' && name && isTier(row.value)) {
      const useCase = name as UseCase
      if (allowedTiers(useCase).includes(row.value)) value.useCaseTiers[useCase] = row.value
    }
  }
  return value
}

/** Sets `key` to `value` for `userId` and logs the old and new values; clears a failing mark. */
async function save(userId: string, key: string, value: string): Promise<void> {
  await db.transaction(async (tx) => {
    const [old] = await tx
      .select({ value: aiSetting.value })
      .from(aiSetting)
      .where(eq(aiSetting.key, key))
    const set = {
      value,
      updatedByUserId: userId,
      updatedAt: new Date(),
      failing: null,
      failingAt: null,
    }
    await tx
      .insert(aiSetting)
      .values({ key, ...set })
      .onConflictDoUpdate({ target: aiSetting.key, set })
    await tx
      .insert(aiSettingChange)
      .values({ key, oldValue: old?.value ?? null, newValue: value, userId })
  })
  memory = null
}

/** The model a tier runs on from now (criterion 94). */
export function saveTierModel(userId: string, tier: Tier, model: string): Promise<void> {
  return save(userId, `tier:${tier}`, model)
}

/** The tier a use case runs on from now (criterion 95). */
export function saveUseCaseTier(userId: string, useCase: UseCase, tier: Tier): Promise<void> {
  return save(userId, `usecase:${useCase}`, tier)
}

/** Clears every choice and logs one reset naming what it cleared (criterion 97). */
export async function resetAll(userId: string): Promise<void> {
  await db.transaction(async (tx) => {
    const rows = await tx.select({ key: aiSetting.key, value: aiSetting.value }).from(aiSetting)
    await tx.delete(aiSetting)
    const cleared = rows
      .map((r) => `${r.key}=${r.value}`)
      .sort()
      .join(', ')
    await tx
      .insert(aiSettingChange)
      .values({ key: 'reset', oldValue: cleared || null, newValue: null, userId })
  })
  memory = null
}

/**
 * Marks a tier's chosen model as failing with its error (criterion 96), only while the tier still
 * holds `model`, the one that failed: a call on an older copy of the settings never marks a model
 * saved since. No chosen model, no mark.
 */
export async function markFailing(tier: Tier, model: string, error: string): Promise<void> {
  await db
    .update(aiSetting)
    .set({ failing: error.slice(0, ERROR_MAX), failingAt: new Date() })
    .where(and(eq(aiSetting.key, `tier:${tier}`), eq(aiSetting.value, model)))
  memory = null
}

/** The newest `limit` log entries first, with who made each (criterion 98). */
export async function lastChanges(limit: number): Promise<SettingChange[]> {
  const n = Math.min(Math.max(Math.trunc(limit), 1), CHANGES_MAX)
  const rows = await db
    .select({
      key: aiSettingChange.key,
      oldValue: aiSettingChange.oldValue,
      newValue: aiSettingChange.newValue,
      userName: user.name,
      at: aiSettingChange.at,
    })
    .from(aiSettingChange)
    .leftJoin(user, eq(user.id, aiSettingChange.userId))
    .orderBy(desc(aiSettingChange.at), desc(aiSettingChange.id))
    .limit(n)
  return rows.map((r) => ({ ...r, at: r.at.toISOString() }))
}
