'use client'

import { ListFilter } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useId, useState } from 'react'
import { filterLabel } from '@/shared/components/classes'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select'
import { cn } from '@/shared/lib/utils'
import { LANGUAGES } from '../languages'
import { BOARD_TYPES, type BoardParams, type BoardStaff, boardHref } from '../lib/board'

type Option = { id: string; label: string }

/**
 * The board's four selects, beside its tabs; below @xl behind a "Filters" button that counts the
 * ones set, opening two by two under it. Each value lives in the address, so a view is a link: a
 * change replaces the address, keeping the other filters.
 */
export function BoardFilters({
  params,
  staff,
  pages,
}: {
  params: BoardParams
  staff: BoardStaff[]
  pages: { id: string; name: string }[]
}) {
  const router = useRouter()
  const go = (key: Exclude<keyof BoardParams, 'filter'>, value: string) =>
    router.replace(boardHref({ ...params, [key]: value } as BoardParams), { scroll: false })
  const [open, setOpen] = useState(false)
  const set = (['assignee', 'type', 'page', 'lang'] as const).filter((k) => params[k] !== 'any')

  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((was) => !was)}
        className="hidden min-h-11 cursor-pointer items-center gap-2 self-start border border-foreground/30 bg-transparent px-3.5 font-medium text-foreground aria-expanded:border-accent-700 aria-expanded:bg-accent-100 @max-xl:inline-flex"
      >
        <ListFilter aria-hidden="true" strokeWidth={1.5} className="size-icon" />
        {set.length > 0 ? `Filters · ${set.length}` : 'Filters'}
      </button>
      <div
        className={cn(
          'flex flex-wrap items-center gap-x-5 gap-y-3 @max-xl:grid @max-xl:w-full @max-xl:grid-cols-2 @max-xl:gap-3',
          !open && '@max-xl:hidden',
        )}
      >
        <FilterSelect
          label="Assignee"
          value={params.assignee}
          options={[
            { id: 'any', label: 'Anyone' },
            { id: 'mine', label: 'Mine' },
            { id: 'unassigned', label: 'Unassigned' },
            ...staff.map((s) => ({ id: s.id, label: s.name })),
          ]}
          onChange={(v) => go('assignee', v)}
        />
        <FilterSelect
          label="Type"
          value={params.type}
          options={[{ id: 'any', label: 'Any' }, ...BOARD_TYPES]}
          onChange={(v) => go('type', v)}
        />
        <FilterSelect
          label="Page"
          value={params.page}
          options={[{ id: 'any', label: 'Any' }, ...pages.map((p) => ({ ...p, label: p.name }))]}
          onChange={(v) => go('page', v)}
        />
        <FilterSelect
          label="Language"
          value={params.lang}
          options={[{ id: 'any', label: 'Any' }, ...LANGUAGES]}
          onChange={(v) => go('lang', v)}
        />
      </div>
    </>
  )
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: readonly Option[]
  onChange: (value: string) => void
}) {
  const id = useId()
  return (
    <div className="flex items-center gap-2 @max-xl:flex-col @max-xl:items-stretch @max-xl:gap-1">
      <label htmlFor={id} className={filterLabel}>
        {label}
      </label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger
          id={id}
          className="h-11 w-auto min-w-30 gap-3 border-foreground/30 text-base @max-xl:w-full @max-xl:min-w-0"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.id} value={o.id}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
