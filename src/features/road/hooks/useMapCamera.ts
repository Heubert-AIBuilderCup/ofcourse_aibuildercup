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
  type Box as Frame,
  fit,
  frame,
  type Layout,
  type MapSize,
  mapPadding,
  STOP_CAP,
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

/** The share of the screen her answers' sheet covers on a phone (answers.module.css). */
const SHEET = 0.62

/** The map's size, and how far its foot sits above the screen's (px), for the sheet over it. */
type Box = { width: number; height: number; rs: number; below: number; screen: number }

/**
 * Under her answers' sheet: the tiles a pick would change (else the stop's frame), fitted into the
 * map left above the sheet, under the preview tag.
 */
function fitAboveSheet(
  stop: Stop,
  focusId: string | null,
  size: MapSize,
  scene: Scene,
  box: Box,
): Camera {
  const ids = scene.tiles.filter((t) => t.prev !== undefined).map((t) => t.id)
  const boxes = ids.length
    ? ids.map((id) => frame('tile', id, scene))
    : [frame(stop, focusId, scene)]
  const f: Frame = {
    x0: Math.min(...boxes.map((b) => b.x0)),
    x1: Math.max(...boxes.map((b) => b.x1)),
    y0: Math.min(...boxes.map((b) => b.y0)),
    y1: Math.max(...boxes.map((b) => b.y1)),
  }
  const r = 16 * size.rs
  const pad = { ...mapPadding(size), t: 3.5 * r }
  pad.b = Math.max(r, SHEET * box.screen - box.below + r)
  const aw = Math.max(40, size.width - pad.l - pad.r)
  const ah = Math.max(40, size.height - pad.t - pad.b)
  const u = Math.min(aw / (f.x1 - f.x0), ah / (f.y1 - f.y0), STOP_CAP[size.layout][stop] * size.rs)
  return {
    u,
    ox: pad.l + (aw - (f.x1 - f.x0) * u) / 2 - f.x0 * u,
    oy: pad.t + (ah - (f.y1 - f.y0) * u) / 2 - f.y0 * u,
  }
}

/**
 * The map's camera. It fits the stop to the map's space on load and on every resize (a cut), and
 * moves to a new stop or focus in 0.55 s, the scale even in log space (a cut under reduced
 * motion). Wheel, Ctrl + scroll and trackpad pinch step one stop per gesture, two fingers on a
 * touch screen step as they spread or close, and a drag pans, held so some of the road stays on
 * screen. Input on an element marked `data-map-control` is the control's, not the map's. With her
 * answers' sheet over a phone's map (`sheet`), it frames what a pick would change above the sheet.
 */
export function useMapCamera({
  mapRef,
  layout,
  scene,
  stop,
  focusId,
  sheet = false,
  onStep,
}: {
  mapRef: RefObject<HTMLElement | null>
  layout: Layout
  scene: Scene
  stop: Stop
  focusId: string | null
  sheet?: boolean
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
      const screen = window.innerHeight
      const next = {
        width: el.clientWidth,
        height: el.clientHeight,
        rs: rootScale(),
        below: screen - el.getBoundingClientRect().bottom,
        screen,
      }
      setBox((was) =>
        was &&
        was.width === next.width &&
        was.height === next.height &&
        was.rs === next.rs &&
        was.below === next.below &&
        was.screen === next.screen
          ? was
          : next,
      )
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [mapRef])

  const size = useMemo<MapSize | null>(
    () => box && { width: box.width, height: box.height, rs: box.rs, layout },
    [box, layout],
  )
  const target = useMemo(
    () =>
      size &&
      box &&
      (sheet ? fitAboveSheet(stop, focusId, size, scene, box) : fit(stop, focusId, size, scene)),
    [size, box, stop, focusId, scene, sheet],
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
