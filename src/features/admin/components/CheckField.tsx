'use client'

import { useId } from 'react'
import { Checkbox } from '@/shared/components/ui/checkbox'

/** A checkbox with its label beside it, at the height of the admin's other controls. */
export function CheckField({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (on: boolean) => void
}) {
  const id = useId()
  return (
    <div className="flex h-11 items-center gap-2">
      <Checkbox id={id} checked={checked} onCheckedChange={(v) => onChange(v === true)} />
      <label htmlFor={id} className="text-caption text-foreground">
        {label}
      </label>
    </div>
  )
}
