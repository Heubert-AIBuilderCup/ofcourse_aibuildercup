'use client'

import {
  type RefObject,
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  CAMERA_MS,
  type Camera,
  clamp,
  ease,
  fit,
  type Layout,
  type MapSize,
  stepFromPinch,
  stepFromWheel,
  tween,
  WHEEL_IDLE,
} from '../model/camera'
import type { Stop } from '../model/road-data'
import type { Scene } from '../model/scene'
import { prefersReducedMotion, rootScale } from './motion'

/** A drag shorter than this is still a press (px). */
const DRAG_FROM = 6

type Box = { width: number; height: number; rs: number }

/**
 * The map's camera. It fits the stop to the map's space on load and on every resize (a cut), and
 * moves to a new stop or focus in 0.55 s, the scale even in log space (a cut under reduced
 * motion). Wheel, Ctrl + scroll and trackpad pinch step one stop per gesture, two fingers on a
 * touch screen step as they spread or close, and a drag pans, held so some of the road stays on
 * screen. Input on an element marked `data-map-control` is the control's, not the map's.
 */
export function useMapCamera({
  mapRef,
  layout,
  scene,
  stop,
  focusId,
  onStep,
}: {
  mapRef: RefObject<HTMLElement | null>
  layout: Layout
  scene: Scene
  stop: Stop
  focusId: string | null
  onStep: (dir: -1 | 1) => void
}) {
  const [box, setBox] = useState<Box | null>(null)
  const [cam, setCam] = useState<Camera | null>(null)
  const [dragging, setDragging] = useState(false)
  const moving = useRef(0)
  const fitted = useRef<MapSize | null>(null)

  useLayoutEffect(() => {
    const el = mapRef.current
    if (!el) return
    const measure = () => {
      const next = { width: el.clientWidth, height: el.clientHeight, rs: rootScale() }
      setBox((was) =>
        was && was.width === next.width && was.height === next.height && was.rs === next.rs
          ? was
          : next,
      )
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [mapRef])

  const size = useMemo<MapSize | null>(() => box && { ...box, layout }, [box, layout])
  const target = useMemo(
    () => size && fit(stop, focusId, size, scene),
    [size, stop, focusId, scene],
  )

  const camera = useEffectEvent(() => cam)
  useLayoutEffect(() => {
    if (!target || !size) return
    const resized = fitted.current !== size
    fitted.current = size
    const from = camera()
    if (!from || resized || prefersReducedMotion()) {
      setCam(target)
      return
    }
    const start = performance.now()
    const tick = (now: number) => {
      const k = ease(Math.min(1, (now - start) / CAMERA_MS))
      setCam(tween(from, target, k))
      if (k < 1) moving.current = requestAnimationFrame(tick)
    }
    moving.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(moving.current)
  }, [target, size])

  const step = useEffectEvent((dir: -1 | 1) => onStep(dir))
  const pan = useEffectEvent((from: Camera, dx: number, dy: number) => {
    if (!size) return
    cancelAnimationFrame(moving.current)
    setCam(clamp({ u: from.u, ox: from.ox + dx, oy: from.oy + dy }, size, scene))
  })

  useEffect(() => {
    const el = mapRef.current
    if (!el) return
    let gesture = WHEEL_IDLE
    const pointers = new Map<number, [number, number]>()
    let drag: { x: number; y: number; cam: Camera; moved: boolean; id: number } | null = null
    let pinch = 0
    let swallow = false
    const spread = () => {
      const [a, b] = [...pointers.values()]
      return Math.hypot(a[0] - b[0], a[1] - b[1])
    }

    const wheel = (e: WheelEvent) => {
      e.preventDefault()
      const next = stepFromWheel(gesture, {
        deltaY: e.deltaY,
        ctrlKey: e.ctrlKey,
        time: performance.now(),
      })
      gesture = next.gesture
      if (next.step) step(next.step)
    }
    const down = (e: PointerEvent) => {
      if ((e.target as Element).closest('[data-map-control]')) return
      pointers.set(e.pointerId, [e.clientX, e.clientY])
      const from = camera()
      if (pointers.size === 1 && from) {
        drag = { x: e.clientX, y: e.clientY, cam: from, moved: false, id: e.pointerId }
      }
      if (pointers.size === 2) {
        pinch = spread()
        drag = null
      }
    }
    const move = (e: PointerEvent) => {
      if (!pointers.has(e.pointerId)) return
      pointers.set(e.pointerId, [e.clientX, e.clientY])
      if (pointers.size === 2 && pinch) {
        const next = stepFromPinch(pinch, spread())
        pinch = next.start
        if (next.step) step(next.step)
        return
      }
      if (!drag) return
      const dx = e.clientX - drag.x
      const dy = e.clientY - drag.y
      if (!drag.moved && Math.hypot(dx, dy) < DRAG_FROM) return
      if (!drag.moved) {
        drag.moved = true
        el.setPointerCapture?.(drag.id)
        setDragging(true)
      }
      pan(drag.cam, dx, dy)
    }
    const up = (e: PointerEvent) => {
      pointers.delete(e.pointerId)
      if (pointers.size < 2) pinch = 0
      if (drag?.moved) swallow = true
      if (pointers.size === 0) {
        drag = null
        setDragging(false)
      }
    }
    // The click that ends a drag is not a press.
    const click = (e: MouseEvent) => {
      if (!swallow) return
      swallow = false
      e.stopPropagation()
      e.preventDefault()
    }

    el.addEventListener('wheel', wheel, { passive: false })
    el.addEventListener('pointerdown', down)
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
    el.addEventListener('pointercancel', up)
    el.addEventListener('click', click, true)
    return () => {
      el.removeEventListener('wheel', wheel)
      el.removeEventListener('pointerdown', down)
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up)
      el.removeEventListener('pointercancel', up)
      el.removeEventListener('click', click, true)
    }
  }, [mapRef])

  return { cam, size, dragging }
}
