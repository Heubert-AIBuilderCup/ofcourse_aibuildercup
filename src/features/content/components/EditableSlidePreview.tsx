'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/shared/components/ui/button'
import { Textarea } from '@/shared/components/ui/textarea'
import { cn } from '@/shared/lib/utils'
import type { Box, FitCheck } from '../model/types'
import { tag } from './parts'
import { CANVAS_HEIGHT, CANVAS_WIDTH, SlidePreview } from './SlidePreview'

/**
 * One slot on the slide: where the template puts it, and what it says now. A text slot by
 * default; `kind: 'scene'` is the art area holding a planned image's scene in words (GD12), which
 * the slide does not draw as text, so it is never measured.
 */
export type EditableSlot = { key: string; label: string; box: Box; text: string; kind?: 'scene' }

/** Where the picture comes from, as SlidePreview takes it: a draft, an approved layout or a stored PNG. */
type SlideSource =
  | { draft: { postId: string; draftsId: string; index: number; themeId: string } }
  | { layout: { postId: string; layoutId: string; planId?: string } }
  | { assetId: string }

const sourceOf = (props: SlideSource): SlideSource =>
  'draft' in props
    ? { draft: props.draft }
    : 'layout' in props
      ? { layout: props.layout }
      : { assetId: props.assetId }

type EditableSlidePreviewProps = SlideSource & {
  slide: number
  slots: EditableSlot[]
  /** The slide's words, line by line, for its alt text. */
  text?: string[]
  /** True while a save is in flight or the viewer may not edit: the slide shows, nothing opens. */
  disabled?: boolean
  /** A slot's new text, only when it changed; the caller saves it and the preview is drawn again. */
  onSave: (slot: string, text: string) => void
  /**
   * The fit rows the slot would have with this text, measured on the server with the render's
   * fonts, or null when there are none to show. Without it the rows update on save only.
   */
  measure?: (slot: string, text: string) => Promise<FitCheck[] | null>
}

/** How long typing pauses before the slot is measured (criterion 98). */
const MEASURE_DELAY_MS = 150

/** A share of the canvas as a percentage, for a box drawn over the preview. */
const pct = (part: number, whole: number) => `${(part / whole) * 100}%`

/**
 * A draft's slide that the editor edits in place (criterion 98): each text slot is a target over
 * the box the template gives it; clicking one opens a text field over it, saved with "Save" or
 * Ctrl+Enter and closed with "Cancel" or Escape. As the editor types, the slot is measured once
 * the typing pauses and its fit rows show under the field; the server draws the picture again on
 * save, and the saved drafts stay the authority.
 */
export function EditableSlidePreview(props: EditableSlidePreviewProps) {
  const { slide, slots, disabled, onSave, measure } = props
  const [open, setOpen] = useState<string | null>(null)
  const [value, setValue] = useState('')
  const [rows, setRows] = useState<FitCheck[] | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Counts what was typed and each open or close: an answer for anything earlier is dropped.
  const edits = useRef(0)
  const editing = slots.find((s) => s.key === open) ?? null

  const stopMeasuring = () => {
    edits.current += 1
    if (timer.current) clearTimeout(timer.current)
    setRows(null)
  }
  // Leaving the page stops a measurement waiting to start.
  useEffect(
    () => () => {
      edits.current += 1
      if (timer.current) clearTimeout(timer.current)
    },
    [],
  )

  const close = () => {
    stopMeasuring()
    setOpen(null)
  }
  const start = (slot: EditableSlot) => {
    stopMeasuring()
    setOpen(slot.key)
    setValue(slot.text)
  }
  const save = () => {
    if (editing && value.trim() !== editing.text.trim()) onSave(editing.key, value)
    close()
  }
  const type = (text: string) => {
    setValue(text)
    if (!measure || !editing || editing.kind === 'scene') return
    edits.current += 1
    const edit = edits.current
    const key = editing.key
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(async () => {
      const measured = await measure(key, text)
      if (edit === edits.current) setRows(measured)
    }, MEASURE_DELAY_MS)
  }

  return (
    <div className="relative">
      <SlidePreview slide={slide} text={props.text} {...sourceOf(props)} />
      {!disabled &&
        slots.map((s) => (
          <button
            key={s.key}
            type="button"
            aria-label={`Edit Slide ${slide} · ${s.label}`}
            title={`Edit ${s.label}`}
            className="absolute cursor-text border border-transparent hover:border-primary focus-visible:border-primary focus-visible:outline-none"
            style={{
              left: pct(s.box.x, CANVAS_WIDTH),
              top: pct(s.box.y, CANVAS_HEIGHT),
              width: pct(s.box.w, CANVAS_WIDTH),
              height: pct(s.box.h, CANVAS_HEIGHT),
            }}
            onClick={() => start(s)}
          />
        ))}
      {editing && !disabled && (
        <div
          className="absolute inset-x-0 z-10 flex flex-col gap-2 border bg-background p-2"
          // Over the slot, kept inside the slide.
          style={{ top: pct(Math.min(editing.box.y, CANVAS_HEIGHT * 0.5), CANVAS_HEIGHT) }}
        >
          <Textarea
            aria-label={`Slide ${slide} · ${editing.label}`}
            rows={4}
            value={value}
            // The field opens because the editor clicked its slot: typing goes straight into it.
            autoFocus
            onChange={(e) => type(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') close()
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) save()
            }}
          />
          {rows && rows.length > 0 && (
            <ul aria-label="Fit as typed" className="flex flex-col gap-1">
              {rows.map((c) => (
                <li
                  key={c.label}
                  className={cn(
                    'flex items-start justify-between gap-2 text-caption',
                    !c.pass && 'text-destructive',
                  )}
                >
                  <span>{c.label}</span>
                  <span className={cn(tag, 'shrink-0')}>{c.pass ? 'Pass' : 'Fail'}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={save}>
              Save
            </Button>
            <Button size="sm" variant="outline" onClick={close}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
