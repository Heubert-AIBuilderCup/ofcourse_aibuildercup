'use client'

import { type KeyboardEvent, useEffect, useRef, useState } from 'react'

/**
 * A menu button's open state and keys (the ARIA menu pattern): opening focuses the first item; the
 * arrow keys, Home and End move between items; Escape closes it and gives focus back to its button;
 * Tab closes it and lets focus move on. Put `button` on the button, `menu` and `onKeyDown` on the
 * `role="menu"` element; items are anything with a `menuitem…` role.
 */
export function useMenuKeys() {
  const [open, setOpen] = useState(false)
  const button = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) menu.current?.querySelector<HTMLElement>('[role^="menuitem"]')?.focus()
  }, [open])

  function close() {
    setOpen(false)
    button.current?.focus()
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.preventDefault()
      close()
      return
    }
    // Tab leaves the menu: it closes and focus moves on as usual.
    if (event.key === 'Tab') {
      setOpen(false)
      return
    }
    const items = [...(menu.current?.querySelectorAll<HTMLElement>('[role^="menuitem"]') ?? [])]
    const at = items.indexOf(document.activeElement as HTMLElement)
    const to: Record<string, number> = {
      ArrowDown: (at + 1) % items.length,
      ArrowUp: (at - 1 + items.length) % items.length,
      Home: 0,
      End: items.length - 1,
    }
    if (!(event.key in to)) return
    event.preventDefault()
    items[to[event.key]]?.focus()
  }

  return { open, setOpen, button, menu, close, onKeyDown }
}
