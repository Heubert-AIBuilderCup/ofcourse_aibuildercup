'use client'

import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import { LOADER_LINES, LOADER_TITLE } from '../model/loader-lines'
import styles from './duck-loader.module.css'

/** The index of the line last shown, so the next wait shows the next one (one browser tab). */
const LINE_KEY = 'ofcourse:loader-line'

/** The line after the one last shown; the first when none was shown or storage refuses. */
function nextLineIndex(): number {
  try {
    const last = sessionStorage.getItem(LINE_KEY)
    const lastIndex = last === null ? -1 : Number(last)
    const valid = Number.isInteger(lastIndex) && lastIndex >= -1
    const index = valid ? (lastIndex + 1) % LOADER_LINES.length : 0
    sessionStorage.setItem(LINE_KEY, String(index))
    return index
  } catch {
    return 0
  }
}

/**
 * The wait screen (frames p3load-*): a river with the duck drifting along it, "Keep floating." and
 * one line that rotates per wait. Invisible for its first 400 ms, so quick loads never show it.
 * The server renders the first line; the browser then picks its own, which nobody sees yet.
 */
export function DuckLoader() {
  const [index, setIndex] = useState(0)
  // Strict Mode runs a mount's effects twice; the rotation must advance once.
  const picked = useRef(false)

  useEffect(() => {
    if (picked.current) return
    picked.current = true
    setIndex(nextLineIndex())
  }, [])

  return (
    <div
      role="status"
      aria-label="Loading"
      className={`${styles.loader} fixed inset-0 z-40 overflow-hidden flex flex-col items-center justify-center gap-block bg-primary-strong px-gutter text-center text-primary-strong-foreground`}
    >
      <div className="flex flex-col gap-2">
        <h2 className="m-0 font-heading text-h1 font-semibold">{LOADER_TITLE}</h2>
        <p className="m-0 text-lead">{LOADER_LINES[index]}</p>
      </div>
      <div
        className={`${styles.river} relative h-16 w-full max-w-xl border-t border-primary-strong-foreground bg-primary-strong-foreground/20`}
      >
        <span className={styles.duck}>
          {/* The PNG faces left; mirrored, the duck faces the way it drifts. */}
          <Image
            src="/brand/duck.png"
            alt=""
            width={64}
            height={64}
            loading="eager"
            className="h-auto w-full -scale-x-100"
          />
        </span>
      </div>
    </div>
  )
}
