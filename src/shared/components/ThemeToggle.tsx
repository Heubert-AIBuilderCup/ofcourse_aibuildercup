'use client'

import { Moon, Sun } from 'lucide-react'
import { useThemeChoice } from '@/shared/components/Providers'
import { HEADER_ACTION } from '@/shared/lib/header-action'
import { toggledChoice } from '@/shared/lib/theme'
import { cn } from '@/shared/lib/utils'

/**
 * The theme toggle in the header of the sign-in pages and the admin bar: a moon in light, a sun in
 * dark, and a click picks the other theme, stored for this browser. `className` places it.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setChoice } = useThemeChoice()
  const label = theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'
  const Icon = theme === 'dark' ? Sun : Moon

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={() => setChoice(toggledChoice(theme))}
      className={cn(HEADER_ACTION, className)}
    >
      {/* Keyed by the theme, so the new icon pops in on a short spring. */}
      <Icon
        key={theme}
        aria-hidden="true"
        strokeWidth={1.5}
        className="size-icon motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-60 motion-safe:spin-in-[-60deg] motion-safe:duration-400 motion-safe:ease-[cubic-bezier(0.34,1.56,0.64,1)]"
      />
    </button>
  )
}
