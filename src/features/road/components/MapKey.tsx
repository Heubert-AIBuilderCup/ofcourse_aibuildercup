import type { RefObject } from 'react'
import { PanelHead } from './PanelHead'
import styles from './road-map.module.css'

const PRESS = [
  ['Place tile', 'Opens it. Go here from the card.'],
  ['Stack', 'Opens it. Show more from the card.'],
  ['Route step', 'Look ahead. The duck stays put.'],
  ['Control', 'Does what its label says, always in the same place.'],
] as const

const LIGHT = [
  ['lit', 'Visited · lit'],
  ['alt', 'Not visited · dim'],
  ['fog', 'Unexplored · dark, named'],
  ['hatch', 'Not yet reachable · hatched'],
  ['dot', 'Dotted outline · data unknown or out of date'],
] as const

/**
 * The map key (in View): what a press does on each kind of thing, and what the light means. Under
 * View it is its own dialog; `inSheet`, only its content, for the phone's sheet.
 */
export function MapKey({
  onClose,
  ref,
  inSheet = false,
}: {
  onClose: () => void
  ref?: RefObject<HTMLDivElement | null>
  inSheet?: boolean
}) {
  const body = (
    <>
      <PanelHead title="Map key" onClose={onClose} />
      <p className="m-0 text-overline text-muted-foreground uppercase">What you can press</p>
      <ul className="m-0 flex list-none flex-col gap-2 p-0 text-sm">
        {PRESS.map(([what, does]) => (
          <li key={what}>
            <b>{what}</b> · {does}
          </li>
        ))}
      </ul>
      <p className="m-0 text-overline text-muted-foreground uppercase">What the light means</p>
      <ul className="m-0 flex list-none flex-col gap-2 p-0 text-sm">
        {LIGHT.map(([light, means]) => (
          <li key={light} className="flex items-center gap-2.5">
            <span aria-hidden="true" data-light={light} className={styles.swatch} />
            {means}
          </li>
        ))}
      </ul>
    </>
  )
  if (inSheet) return body
  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="Map key"
      tabIndex={-1}
      className="absolute top-full right-0 z-40 mt-2 flex w-88 flex-col gap-3 border bg-background p-4 text-foreground shadow-lg outline-none motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-1 motion-safe:duration-200"
    >
      {body}
    </div>
  )
}
