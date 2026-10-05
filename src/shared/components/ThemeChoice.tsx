'use client'

import { useThemeChoice } from '@/shared/components/Providers'
import { Label } from '@/shared/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select'
import { parseThemeChoice } from '@/shared/lib/theme'

const OPTIONS = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
]

/** Light, dark, or follow the device (the default). */
export function ThemeChoice() {
  const { choice, setChoice } = useThemeChoice()
  return (
    <div className="grid max-w-xs gap-2">
      <Label htmlFor="theme-choice">Theme</Label>
      <Select value={choice} onValueChange={(value) => setChoice(parseThemeChoice(value))}>
        <SelectTrigger id="theme-choice">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {OPTIONS.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
