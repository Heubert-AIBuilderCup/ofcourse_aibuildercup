'use client'

import { type KeyboardEvent, useId, useRef, useState } from 'react'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { Textarea } from '@/shared/components/ui/textarea'
import { cn } from '@/shared/lib/utils'
import type { SlotSpec } from '../model/types'
import { firstChars } from '../text/script'
import { reasonText } from './classes'

/** The most characters a one-line field holds. */
const SHORT_MAX = 60

/** A slot written in a text area: one counted in words or points, or longer than a line. */
export const isLong = (limit: SlotSpec['limit']) => limit.unit !== 'chars' || limit.max > SHORT_MAX

/**
 * One slot's text beside the slide (C1): its label, an `Input` for a short slot or a `Textarea`
 * for a long one, a live count under it (`count`, characters as a reader sees them), saved when
 * the field is left changed, on Enter in a short field or Ctrl+Enter in a long one, through
 * `onSave` once per change. The save's refusal (`error`) shows under the field, as its
 * description. With `max`, the text is held to that many characters as it is typed.
 */
export function SlotField(props: {
  label: string
  value: string
  long?: boolean
  disabled: boolean
  max?: number
  count?: (text: string) => { text: string; over: boolean }
  /** What the slot needs, under the count (a source check's "Not in the source"), or null. */
  note?: string | null
  error?: string | null
  onSave: (text: string) => void
}) {
  const id = useId()
  const [text, setText] = useState(props.value)
  // The text last sent, so Ctrl+Enter and the blur after it save it once.
  const sent = useRef(props.value)
  const count = props.count?.(text) ?? null

  const save = () => {
    if (text.trim() === sent.current.trim()) return
    sent.current = text
    props.onSave(text)
  }
  const type = (value: string) =>
    setText(props.max === undefined ? value : firstChars(value, props.max))
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'Enter') return
    if (props.long && !(e.ctrlKey || e.metaKey)) return
    e.preventDefault()
    save()
  }
  const described = [
    count && `${id}-count`,
    props.note && `${id}-note`,
    props.error && `${id}-error`,
  ].filter(Boolean)
  const field = {
    id,
    value: text,
    disabled: props.disabled,
    'aria-describedby': described.length > 0 ? described.join(' ') : undefined,
    'aria-invalid': props.error ? true : undefined,
    onBlur: save,
    onKeyDown,
  }

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <Label htmlFor={id}>{props.label}</Label>
      {props.long ? (
        <Textarea {...field} rows={4} onChange={(e) => type(e.target.value)} />
      ) : (
        <Input {...field} onChange={(e) => type(e.target.value)} />
      )}
      {count && (
        <span id={`${id}-count`} className={cn(reasonText, count.over && 'text-destructive')}>
          {count.text}
        </span>
      )}
      {props.note && (
        <span id={`${id}-note`} className="text-caption font-semibold text-destructive">
          {props.note}
        </span>
      )}
      {props.error && (
        <p id={`${id}-error`} className="text-caption text-destructive wrap-anywhere">
          {props.error}
        </p>
      )}
    </div>
  )
}
