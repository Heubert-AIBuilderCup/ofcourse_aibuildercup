'use client'

import { type FormEvent, useId, useState, useTransition } from 'react'
import { Button } from '@/shared/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select'
import { Textarea } from '@/shared/components/ui/textarea'
import type { ActionResult } from '@/shared/types/action-result'
import { type BoardStaff, noteCount } from '../lib/board'

/** What "Save" sends: the post, its owner (null for none) and the note as typed. */
export type AssignInput = { postId: string; assigneeId: string | null; note: string }

/** The select's value for no owner: Radix Select takes no empty value. */
const NONE = 'none'

/**
 * "Assign" (or "Change" once assigned) on a card, for an editor: a popover with the board's staff
 * and a short note. The server applies the rules; its refusal shows under the fields.
 */
export function AssignPost({
  postId,
  title,
  assigneeId,
  note,
  staff,
  assign,
}: {
  postId: string
  title: string
  assigneeId: string | null
  note: string | null
  staff: BoardStaff[]
  assign: (input: AssignInput) => Promise<ActionResult>
}) {
  const [open, setOpen] = useState(false)
  const [owner, setOwner] = useState(assigneeId ?? NONE)
  const [text, setText] = useState(note ?? '')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const id = useId()

  function save(event: FormEvent) {
    event.preventDefault()
    setError(null)
    startTransition(async () => {
      const res = await assign({ postId, assigneeId: owner === NONE ? null : owner, note: text })
      if (res.ok) setOpen(false)
      else setError(res.error)
    })
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="text" className="min-h-0">
          {assigneeId ? 'Change' : 'Assign'}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="rounded-none bg-background shadow-none">
        <form aria-label={`Assign ${title}`} onSubmit={save} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor={`${id}-owner`} className="text-caption">
              Owner
            </label>
            <Select value={owner} onValueChange={setOwner}>
              <SelectTrigger id={`${id}-owner`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Unassigned</SelectItem>
                {staff.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor={`${id}-note`} className="text-caption">
              Note
            </label>
            <Textarea
              id={`${id}-note`}
              rows={3}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <p className="text-caption text-muted-foreground" aria-live="polite">
              {noteCount(text)}
            </p>
            {error && (
              <p role="alert" className="text-caption text-destructive">
                {error}
              </p>
            )}
          </div>
          <Button type="submit" disabled={pending} className="self-start">
            Save
          </Button>
        </form>
      </PopoverContent>
    </Popover>
  )
}
