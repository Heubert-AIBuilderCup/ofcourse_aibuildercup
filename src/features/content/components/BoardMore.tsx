'use client'

import { Ellipsis, Image, type LucideIcon, Plus, UserRound } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import { Button } from '@/shared/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover'

/**
 * The board's "More" menu beside "New feed post": the other ways in. A new blog and a new comic
 * are an editor's; the page styles and the comic character open for anyone on the board.
 */
export function BoardMore({ editable }: { editable: boolean }) {
  const [open, setOpen] = useState(false)
  const entries: { href: string; label: string; icon: LucideIcon }[] = [
    ...(editable
      ? [
          { href: '/admin/posts/new?kind=blog', label: 'New blog', icon: Plus },
          { href: '/admin/comics/new', label: 'New comic', icon: Plus },
        ]
      : []),
    { href: '/admin/page-styles', label: 'Page styles', icon: Image },
    { href: '/admin/comics/character', label: 'Comic character', icon: UserRound },
  ]
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="square" className="h-11 px-4 font-sans text-base font-medium">
          <Ellipsis aria-hidden="true" strokeWidth={1.5} className="size-icon" />
          More
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-56 rounded-none border bg-background p-1.5 shadow-md"
      >
        <ul className="flex flex-col">
          {entries.map((e) => (
            <li key={e.href}>
              <Link
                href={e.href}
                onClick={() => setOpen(false)}
                className="flex min-h-11 items-center gap-2.5 px-3 text-foreground no-underline hover:bg-foreground/6"
              >
                <e.icon
                  aria-hidden="true"
                  strokeWidth={1.5}
                  className="size-icon text-neutral-700"
                />
                {e.label}
              </Link>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  )
}
