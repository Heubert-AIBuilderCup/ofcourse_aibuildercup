import Link from 'next/link'
import { buttonVariants } from '@/shared/components/ui/button'
import { requireStudent } from '@/shared/lib/auth/session'
import { ROADMAPS_PATH } from '@/shared/lib/student-paths'
import { cn } from '@/shared/lib/utils'

/** A new roadmap by copying one: a placeholder until the next part. */
export default async function NewRoadmapPage() {
  await requireStudent()
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-stack px-gutter py-section">
      <h1 className="m-0 text-h1">New roadmap</h1>
      <p className="m-0 text-muted-foreground">Copying a roadmap comes in the next part.</p>
      <Link href={ROADMAPS_PATH} className={cn(buttonVariants({ variant: 'text' }), 'self-start')}>
        Back to your roadmaps
      </Link>
    </div>
  )
}
