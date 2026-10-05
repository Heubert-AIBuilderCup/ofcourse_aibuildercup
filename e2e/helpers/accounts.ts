// The e2e accounts. Users get a fresh address per run; the superadmins are fixed addresses that
// a spec signs in once and gives the role straight in the database (db.ts setRole), since the
// app grants superadmin only to the first account ever. One superadmin per spec, so specs
// running in parallel never share or delete each other's user.

export const E2E_DOMAIN = 'e2e.starter.test'

export const SUPERADMINS = {
  users: `superadmin-users@${E2E_DOMAIN}`,
} as const

/** A fresh address: unique per call, per run, per worker. */
export function freshEmail(label: string): string {
  const stamp = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
  return `${label}-${stamp}@${E2E_DOMAIN}`
}
