'use client'

import { useRouter } from 'next/navigation'
import { useId } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select'
import { LANGUAGES } from '../languages'
import { BOARD_TYPES, type BoardParams, type BoardStaff, boardHref } from '../lib/board'

type Option = { id: string; label: string }

/**
 * The board's four selects, a quiet row under its tabs. Each value lives in the address, so a view is a link:
 * a change replaces the address, keeping the other filters.
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

  return (
    <div className="flex flex-wrap items-center gap-3">
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
    <div className="flex items-center gap-1.5">
      <label htmlFor={id} className="text-caption text-muted-foreground">
        {label}
      </label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id} className="h-8 w-32 px-2 py-1 text-caption">
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
