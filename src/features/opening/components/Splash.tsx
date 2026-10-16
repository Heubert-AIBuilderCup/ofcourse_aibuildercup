'use client'

import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { isAdminPath } from '@/shared/lib/auth/gate'
import { cn } from '@/shared/lib/utils'
import { SPLASH_SEEN_KEY } from '../model/splash-seen'
import styles from './splash.module.css'

const QUACK_SRC = '/brand/quack.mp4'
// On the animation's clock (splash.module.css): the quack as the duck grabs the f (1.62 s) and turns
// to paddle off with it, then the handover.
const QUACK_AT_MS = 1620
const HANDOVER_AT_MS = 3250
// The handover: the ground moves for 0.95 s, then the overlay fades for 0.35 s.
const MORPH_MS = 1300
const FADE_MS = 350
// Under reduced motion the finished wordmark holds this long, then the page cuts in.
const STILL_MS = 1200

/** The login page marks the panel the splash lands on with this attribute. */
export const SPLASH_TARGET = 'data-splash-target'

// pending: rendered on the server, before the browser knows whether this tab has seen it.
type Phase = 'pending' | 'play' | 'still' | 'morph' | 'fade' | 'off'

const COURSE = [
  ['C', styles.r3, styles.s0],
  ['o', styles.r4, styles.s1],
  ['u', styles.r5, styles.s2],
  ['r', styles.r6, styles.s3],
  ['s', styles.r7, styles.s4],
  ['e', styles.r8, styles.s5],
] as const
const TAGLINE = [
  ['From', styles.t0],
  ['off', styles.t1],
  ['course', styles.t2],
  ['to', styles.t3],
  ['“Of', styles.t4],
  ['Course!”', styles.t5],
] as const

/** Whether this tab has yet to see the splash. Storage refused: no splash at all. */
function firstPageOfTab(): boolean {
  try {
    return sessionStorage.getItem(SPLASH_SEEN_KEY) === null
  } catch {
    return false
  }
}

/**
 * Marks the tab played, at the handover and not before: a page replaced mid-intro (a redirect
 * streamed after the loading shell loads a new document) leaves it unmarked, so the page the tab
 * lands on plays it in full.
 */
function markPlayed() {
  try {
    sessionStorage.setItem(SPLASH_SEEN_KEY, 'seen')
  } catch {}
}

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

/**
 * How far the animation already is. It starts when the server's HTML is painted, which can be
 * well before the page hydrates, so the timers run from the animation's own clock.
 */
function playedMs(overlay: HTMLElement | null): number {
  try {
    let ms = 0
    for (const a of overlay?.getAnimations({ subtree: true }) ?? []) {
      if (typeof a.currentTime === 'number') ms = Math.max(ms, a.currentTime)
    }
    return ms
  } catch {
    return 0
  }
}

/**
 * The quack rides in a <video> that starts with the page, muted and looping: browsers always let
 * muted video autoplay, and they let an element that is still playing be unmuted without a tap
 * (the way DGO's splash gets its music). A sound started fresh, or an <audio>, is refused
 * before any tap. The tag is raw HTML because React leaves `muted` out of server-rendered markup,
 * and the attributes must be there from the first paint. 1px and transparent, never display:none,
 * which stops it playing.
 */
const QUACK_VIDEO = `<video src="${QUACK_SRC}" autoplay muted loop playsinline preload="auto" style="position:fixed;left:0;top:0;width:1px;height:1px;opacity:0;pointer-events:none"></video>`

function videoIn(holder: HTMLElement | null): HTMLVideoElement | null {
  return holder?.querySelector('video') ?? null
}

/** Starts the muted loop if the page's autoplay didn't (it was rendered after hydration). */
function keepQuackRolling(video: HTMLVideoElement | null) {
  if (!video?.paused) return
  try {
    video.muted = true
    video.play()?.catch(() => {})
  } catch {}
}

/** As the duck grabs the f: back to the start, once, with sound. Refused: muted again, silent, no error. */
function playQuack(video: HTMLVideoElement | null) {
  if (!video) return
  try {
    video.loop = false
    video.currentTime = 0
    video.volume = 0.9
    video.muted = false
    video.play()?.then(
      () => reportQuack('played'),
      (error: unknown) => {
        video.muted = true
        reportQuack(`refused by the browser (${error instanceof Error ? error.name : 'error'})`)
      },
    )
  } catch {}
}

// Development only: whether the browser let the quack play, so a silent splash can be told apart
// from a refused one.
function reportQuack(outcome: string) {
  if (process.env.NODE_ENV !== 'production') console.info(`[splash] quack ${outcome}`)
}

/**
 * The splash (DS-R9), an overlay in front of whatever page a tab opens on, except the admin's: on
 * the tab's first page "Off Course" becomes "“Of Course!”" and the duck quacks; then the blue
 * ground shrinks onto the login page's panel (an element with data-splash-target) while it darkens
 * to the panel's colour, and fades over the real panel. Without a panel (a deep link) it fades.
 * Under reduced motion the finished wordmark shows for 1.2 s, silent, then the page cuts in.
 *
 * The server renders it in front of the page, so the page never flashes before it. When the tab
 * has already seen it, the root layout's inline script (model/splash-seen.ts) marks <html> before
 * the first paint and the overlay is never painted; this component then removes it for good.
 * Decoration only, so hidden from
 * assistive technology; the page underneath carries the name.
 */
export function Splash() {
  const pathname = usePathname()
  // Decided once, for the page the tab opened on; later navigations never bring it back.
  const [phase, setPhase] = useState<Phase>(() => (isAdminPath(pathname) ? 'off' : 'pending'))
  const overlay = useRef<HTMLDivElement>(null)
  const ground = useRef<HTMLDivElement>(null)
  const quackHolder = useRef<HTMLSpanElement>(null)
  // Strict Mode runs a mount's effects twice; the first run already decided.
  const decided = useRef(false)

  useLayoutEffect(() => {
    if (decided.current || phase !== 'pending') return
    decided.current = true
    if (!firstPageOfTab()) setPhase('off')
    else setPhase(prefersReducedMotion() ? 'still' : 'play')
  }, [phase])

  useEffect(() => {
    const later = (next: Phase, ms: number) => {
      const timer = setTimeout(() => setPhase(next), ms)
      return () => clearTimeout(timer)
    }
    if (phase === 'still') {
      const timer = setTimeout(() => {
        markPlayed()
        setPhase('off')
      }, STILL_MS)
      return () => clearTimeout(timer)
    }
    if (phase === 'morph' || phase === 'fade') markPlayed()
    if (phase === 'morph') return later('off', MORPH_MS)
    if (phase === 'fade') return later('off', FADE_MS)
    if (phase !== 'play') return

    const played = playedMs(overlay.current)
    keepQuackRolling(videoIn(quackHolder.current))
    const quackTimer = setTimeout(
      () => playQuack(videoIn(quackHolder.current)),
      Math.max(0, QUACK_AT_MS - played),
    )
    const handoverTimer = setTimeout(
      () => setPhase(landOn(ground.current)),
      Math.max(0, HANDOVER_AT_MS - played),
    )
    return () => {
      clearTimeout(quackTimer)
      clearTimeout(handoverTimer)
    }
  }, [phase])

  if (phase === 'off') return null

  return (
    <div
      ref={overlay}
      data-testid="splash"
      data-splash={phase === 'pending' ? 'play' : phase}
      aria-hidden="true"
      className={cn(styles.overlay, 'fixed inset-0 z-50 overflow-hidden')}
    >
      {phase === 'still' ? null : (
        <span
          ref={quackHolder}
          // biome-ignore lint/security/noDangerouslySetInnerHtml: a fixed constant (QUACK_VIDEO), no input reaches it; raw HTML keeps `muted` in the server markup
          dangerouslySetInnerHTML={{ __html: QUACK_VIDEO }}
        />
      )}
      <div
        ref={ground}
        data-splash-ground
        className={cn(styles.ground, 'absolute inset-0 bg-splash')}
      >
        <div className={cn(styles.veil, 'absolute inset-0 bg-panel')} />
      </div>

      <div
        className={cn(
          styles.stage,
          'absolute inset-0 grid place-items-center text-splash-foreground',
        )}
      >
        <div className={styles.lockup}>
          <div className={cn(styles.wm, 'font-heading font-semibold')}>
            <span className={styles.word}>
              <span className={cn(styles.q, styles.qOpen, 'text-splash-foreground/65')}>“</span>
              <span className={cn(styles.ch, styles.r0)}>O</span>
              <span className={cn(styles.ch, styles.r1)}>f</span>
              <span className={styles.f2slot}>
                <span className={styles.f2clip}>
                  <span className={cn(styles.ch, styles.f2, styles.r2)}>f</span>
                </span>
                <span className={styles.track}>
                  <span className={styles.flip}>
                    <span className={styles.duckBody}>
                      <Image src="/brand/duck.png" alt="" fill sizes="14rem" loading="eager" />
                    </span>
                  </span>
                  <span className={styles.carry}>f</span>
                </span>
              </span>
              <span className={styles.sp} />
              {COURSE.map(([letter, rise, settle]) => (
                <span key={letter} className={cn(styles.ch, styles.s, rise, settle)}>
                  {letter}
                </span>
              ))}
              <span className={styles.bangslot}>
                <span className={styles.bangclip}>
                  <span className={styles.bang}>!</span>
                </span>
              </span>
              <span className={cn(styles.q, styles.qClose, 'text-splash-foreground/65')}>”</span>
            </span>
          </div>
          <p
            className={cn(
              styles.tagline,
              'm-0 text-center font-sans font-medium text-splash-foreground/90',
            )}
          >
            {TAGLINE.map(([word, at], i) => (
              <Fragment key={word}>
                {i > 0 ? ' ' : null}
                <span className={cn(styles.tw, at)}>{word}</span>
              </Fragment>
            ))}
          </p>
        </div>
      </div>
    </div>
  )
}

/**
 * The handover: with a login panel on the page, set the ground's transform from the whole
 * viewport onto the panel's box (a transform, so the move stays on the compositor) and morph;
 * without one, fade.
 */
function landOn(groundEl: HTMLElement | null): Phase {
  const target = document.querySelector(`[${SPLASH_TARGET}]`)
  if (!target || !groundEl) return 'fade'
  const box = target.getBoundingClientRect()
  const sx = box.width / window.innerWidth
  const sy = box.height / window.innerHeight
  groundEl.style.setProperty(
    '--splash-to',
    `translate(${box.left}px, ${box.top}px) scale(${sx}, ${sy})`,
  )
  return 'morph'
}
