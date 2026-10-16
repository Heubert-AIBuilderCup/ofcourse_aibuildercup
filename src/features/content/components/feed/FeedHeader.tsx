import { Map as MapIcon, Newspaper } from 'lucide-react'
import Link from 'next/link'
import { SignOutButton } from '@/features/auth/components/SignOutButton'
import { AccountMenu } from '@/features/opening'
import { Duck } from '@/shared/components/Duck'
import { ThemeToggle } from '@/shared/components/ThemeToggle'
import { buttonVariants } from '@/shared/components/ui/button'
import { ADMIN_SIGNIN_PATH, BOARD_PATH, FEED_PATH } from '@/shared/lib/auth/gate'
import { SITE_NAME } from '@/shared/lib/site'
import { ROADMAPS_PATH } from '@/shared/lib/student-paths'
import { cn } from '@/shared/lib/utils'

const ACTION = cn(buttonVariants({ variant: 'square' }), 'h-11 gap-2 px-3.5 font-sans font-medium')

/**
 * The feed's top bar. A student keeps the student app's header, in the board's style
 * (road/components/RoadHeader.tsx): the wordmark with the duck, Your roadmaps, the Feed as the
 * page she is on, and her menu (the theme and Sign out). Staff keep their slim bar: the site name
 * back to the Board, the theme, and Sign out to the admin's sign-in page.
 */
export function FeedHeader({ student }: { student: boolean }) {
  if (!student) {
    return (
      <header className="border-b">
        <div className="mx-auto flex h-12 max-w-5xl items-center justify-between gap-4 px-gutter">
          <Link href={BOARD_PATH} className="font-heading font-semibold">
            {SITE_NAME}
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <SignOutButton redirectTo={ADMIN_SIGNIN_PATH} />
          </div>
        </div>
      </header>
    )
  }
  return (
    <header className="relative z-40 flex min-h-16 items-center gap-4 border-b bg-background px-gutter @max-xl:gap-2">
      <span className="flex items-center gap-2 font-heading text-h4 font-semibold">
        <Duck size="1.75rem" eager className="size-7 object-contain @max-xl:hidden" />
        {SITE_NAME}
      </span>
      <nav aria-label="Main" className="ml-auto flex items-center gap-2">
        <Link href={ROADMAPS_PATH} className={ACTION}>
          <MapIcon aria-hidden="true" strokeWidth={1.5} className="size-icon" />
          <span className="@max-xl:sr-only">Your roadmaps</span>
        </Link>
        <Link
          href={FEED_PATH}
          aria-current="page"
          className={cn(ACTION, 'border-accent-700 bg-accent-100 text-accent-800')}
        >
          <Newspaper aria-hidden="true" strokeWidth={1.5} className="size-icon" />
          Feed
        </Link>
      </nav>
      <AccountMenu band={false} />
    </header>
  )
}
