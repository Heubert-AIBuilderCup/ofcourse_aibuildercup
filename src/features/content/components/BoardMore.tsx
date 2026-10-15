'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Button } from '@/shared/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover'

/**
 * The board's "More" menu beside "+ New feed post": the other ways in. A new blog and a new comic
 * are an editor's; the page styles and the comic character open for anyone on the board.
 */
export function BoardMore({ editable }: { editable: boolean }) {
  const [open, setOpen] = useState(false)
  const entries = [
    ...(editable
      ? [
          { href: '/admin/posts/new?kind=blog', label: '+ New blog' },
          { href: '/admin/comics/new', label: '+ New comic' },
        ]
      : []),
    { href: '/admin/page-styles', label: 'Page styles' },
    { href: '/admin/comics/character', label: 'Comic character' },
  ]
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline">More</Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56 rounded-none bg-background p-1 shadow-none">
        <ul className="flex flex-col">
          {entries.map((e) => (
            <li key={e.href}>
              <Link
                href={e.href}
                onClick={() => setOpen(false)}
                className="block px-3 py-2 font-heading font-semibold hover:bg-accent hover:text-accent-foreground"
              >
                {e.label}
              </Link>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  )
}
