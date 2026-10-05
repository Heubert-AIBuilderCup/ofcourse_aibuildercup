'use client'

import { Button } from '@/shared/components/ui/button'
import { pageCount } from '../lib/params'

type PagerProps = {
  total: number
  page: number
  pageSize: number
  noun: string
  onPage: (page: number) => void
}

/** "26–50 of 132 users" with Previous and Next. */
export function Pager({ total, page, pageSize, noun, onPage }: PagerProps) {
  const pages = pageCount(total, pageSize)
  const from = total === 0 ? 0 : page * pageSize + 1
  const to = Math.min(total, (page + 1) * pageSize)
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-muted-foreground">
        {total === 0 ? `No ${noun}` : `${from}–${to} of ${total} ${noun}`}
      </span>
      {pages > 1 && (
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 0}
            onClick={() => onPage(page - 1)}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= pages - 1}
            onClick={() => onPage(page + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  )
}
