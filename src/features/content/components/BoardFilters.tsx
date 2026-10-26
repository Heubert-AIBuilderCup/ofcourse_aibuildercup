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
 * The board's four selects, beside its tabs (below @xl, two by two under them). Each value lives
 * in the address, so a view is a link: a change replaces the address, keeping the other filters.
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
    <div className="flex flex-wrap items-center gap-x-5 gap-y-3 @max-xl:grid @max-xl:grow @max-xl:grid-cols-2 @max-xl:gap-3">
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
    <div className="flex items-center gap-2 @max-xl:flex-col @max-xl:items-stretch @max-xl:gap-1">
      <label
        htmlFor={id}
        className="font-heading text-caption font-medium tracking-widest text-muted-foreground uppercase"
      >
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
