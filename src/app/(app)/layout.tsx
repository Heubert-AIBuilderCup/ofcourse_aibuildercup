import { after } from 'next/server'
import { requireStudent } from '@/shared/lib/auth/session'
import { recordLastSeen } from '@/shared/lib/presence-server'

/**
 * The student app: students only (requireStudent sends an admin to the admin). No top bar, as the
 * student design has none; each screen sets its own width, phone-first. The splash is the root
 * layout's.
 */
export default async function AppLayout({ children }: LayoutProps<'/'>) {
  const { user } = await requireStudent()

  // Presence, after the response: one throttled primary-key update, a no-op when fresh.
  after(() => recordLastSeen(user.id))

  return <main className="min-h-dvh bg-background text-foreground">{children}</main>
}
