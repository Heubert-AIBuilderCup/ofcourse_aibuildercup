'use client'

import { Layers, Target } from 'lucide-react'
import { type KeyboardEvent, useEffect, useRef, useState } from 'react'
import { Button } from '@/shared/components/ui/button'
import { MapKey } from './MapKey'

const ITEM =
  'h-auto min-h-11 w-full justify-start gap-3 rounded-none px-3 font-sans text-base font-normal text-foreground hover:bg-foreground/6 hover:text-foreground'

/**
 * View, top right on the map: a menu with "Pick a goal" and "Layers · off by default" (next round:
 * they do nothing yet) and "Map key", which opens the key under it (on a phone, `onKey`: the board
 * opens it as a sheet). Opening focuses the first item; Escape closes the menu or the key and gives
 * focus back to View; Tab leaves the menu.
 */
export function ViewMenu({ className, onKey }: { className: string; onKey?: () => void }) {
  const [open, setOpen] = useState<'menu' | 'key' | null>(null)
  const button = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  const key = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open === 'menu') menu.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus()
    if (open === 'key') key.current?.focus()
  }, [open])

  function close() {
    setOpen(null)
    button.current?.focus()
  }

  function onKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault()
      close()
    } else if (event.key === 'Tab' && open === 'menu') setOpen(null)
  }

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: Escape from the menu or the key, which hold focus
    <div
      data-map-control
      className="absolute top-4 right-4 z-30 @max-xl:right-auto @max-xl:left-23"
      onKeyDown={onKeyDown}
    >
      <Button
        ref={button}
        type="button"
        variant="square"
        aria-haspopup="menu"
        aria-expanded={open === 'menu'}
        onClick={() => setOpen((was) => (was === 'menu' ? null : 'menu'))}
        className={className}
      >
        <Layers aria-hidden="true" strokeWidth={1.5} className="size-icon-sm" />
        View
      </Button>
      {open === 'menu' ? (
        <div
          ref={menu}
          role="menu"
          aria-label="View"
          className="absolute top-full right-0 z-40 mt-2 flex min-w-60 flex-col border bg-background p-1.5 text-foreground shadow-md motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-1 motion-safe:duration-200"
        >
          <Button type="button" variant="ghost" role="menuitem" className={ITEM}>
            <Target aria-hidden="true" strokeWidth={1.5} className="size-icon" />
            Pick a goal
          </Button>
          <Button type="button" variant="ghost" role="menuitem" className={ITEM}>
            <Layers aria-hidden="true" strokeWidth={1.5} className="size-icon" />
            Layers · off by default
          </Button>
          <hr className="mx-2 my-1 border-t border-border" />
          <Button
            type="button"
            variant="ghost"
            role="menuitem"
            className={ITEM}
            onClick={() => {
              if (!onKey) return setOpen('key')
              close()
              onKey()
            }}
          >
            <span
              aria-hidden="true"
              className="inline-flex size-4 items-center justify-center border border-current text-micro font-bold"
            >
              ?
            </span>
            Map key
          </Button>
        </div>
      ) : null}
      {open === 'key' ? <MapKey ref={key} onClose={close} /> : null}
    </div>
  )
}
