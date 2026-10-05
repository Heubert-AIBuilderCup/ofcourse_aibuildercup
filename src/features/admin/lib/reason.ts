// The reason an admin gives when suspending an account. The account guards (roles, your own
// account, the last superadmin) are in @/shared/lib/auth/access.

const MAX_REASON = 200

/** A suspension reason: required, trimmed, at most MAX_REASON characters. */
export function parseReason(
  input: unknown,
): { ok: true; reason: string } | { ok: false; error: string } {
  const reason = typeof input === 'string' ? input.trim() : ''
  if (!reason) return { ok: false, error: 'Give a reason.' }
  if (reason.length > MAX_REASON) {
    return { ok: false, error: `Keep the reason under ${MAX_REASON} characters.` }
  }
  return { ok: true, reason }
}
