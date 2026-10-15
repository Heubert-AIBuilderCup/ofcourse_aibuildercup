'use client'

import { useRouter } from 'next/navigation'
import { type FormEvent, useId, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Blueprint } from '@/shared/components/Blueprint'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { NativeSelect } from '@/shared/components/ui/native-select'
import { cn } from '@/shared/lib/utils'
import type { ActionResult } from '@/shared/types/action-result'
import { EMOTION_MAX, type Emotion } from '../emotions'
import { PREMISE_MAX } from '../lib/comic-rules'
import type { Path } from '../lib/path-facts'
import { postPath } from '../lib/steps'
import { charCount, firstChars } from '../text/script'

const NETWORK_ERROR = 'Could not reach the server. Please try again.'
/** A bound on what the field takes; the counter and the button hold the premise to PREMISE_MAX. */
const PREMISE_FIELD_MAX = 1000

/**
 * "New comic" (RC1): a path from the catalogue, preselected when the address names a known one,
 * an optional one-line premise with its counter, an emotion chip or the editor's own word, and
 * "Make storyboard", unavailable until a path is chosen and while the premise is too long. The
 * request id is made once, when the form mounts, and is the new post's id, so a double submit is
 * still one comic. On success the new comic opens at its storyboard.
 */
export function NewComicForm({
  paths,
  emotions,
  path,
  makeComicAction,
}: {
  paths: readonly Path[]
  emotions: readonly Emotion[]
  /** The path the address names (`?path=`), or none. */
  path?: string
  makeComicAction: (input: unknown) => Promise<ActionResult<{ id: string }>>
}) {
  const router = useRouter()
  const ids = useId()
  const [requestId] = useState(() => crypto.randomUUID())
  const [courseId, setCourseId] = useState(() => (paths.some((p) => p.id === path) ? path : ''))
  const [premise, setPremise] = useState('')
  const [chip, setChip] = useState<string | null>(null)
  const [ownWord, setOwnWord] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const length = charCount(premise.trim())
  const over = length > PREMISE_MAX
  const blocked = courseId === '' || over

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (blocked || pending) return
    setError(null)
    startTransition(async () => {
      try {
        const res = await makeComicAction({
          requestId,
          courseId,
          premise: premise.trim() || null,
          emotion: ownWord.trim() || chip,
        })
        if (!res.ok) {
          setError(res.error)
          return
        }
        toast.success('Storyboard on its way')
        router.push(postPath(res.id))
      } catch {
        setError(NETWORK_ERROR)
      }
    })
  }

  return (
    <Blueprint
      as="form"
      aria-label="New comic"
      onSubmit={submit}
      className="flex max-w-2xl flex-col gap-6 p-6"
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${ids}-path`}>Path</Label>
        <NativeSelect
          id={`${ids}-path`}
          value={courseId}
          disabled={pending}
          onChange={(e) => setCourseId(e.target.value)}
        >
          <option value="">Choose a path</option>
          {paths.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </NativeSelect>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${ids}-premise`}>Premise</Label>
        <Input
          id={`${ids}-premise`}
          value={premise}
          maxLength={PREMISE_FIELD_MAX}
          disabled={pending}
          placeholder="e.g. Moving from Kathmandu to study and work in tech"
          aria-describedby={`${ids}-premise-count`}
          aria-invalid={over || undefined}
          onChange={(e) => setPremise(e.target.value)}
        />
        <p
          id={`${ids}-premise-count`}
          data-over={over}
          className={cn('text-caption', over ? 'text-destructive' : 'text-muted-foreground')}
        >
          {length}/{PREMISE_MAX}
        </p>
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-overline uppercase text-muted-foreground">Emotion</legend>
        <div className="flex flex-wrap items-center gap-2">
          {emotions.map((e) => (
            <Button
              key={e.id}
              type="button"
              variant="outline"
              size="sm"
              aria-pressed={chip === e.id}
              className={cn(chip === e.id && 'border-primary')}
              disabled={pending}
              onClick={() => {
                setChip(chip === e.id ? null : e.id)
                setOwnWord('')
              }}
            >
              {e.label}
            </Button>
          ))}
          <Input
            aria-label="Your own word"
            placeholder="Your own word"
            value={ownWord}
            disabled={pending}
            className="w-48"
            onChange={(e) => {
              setOwnWord(firstChars(e.target.value, EMOTION_MAX))
              setChip(null)
            }}
          />
        </div>
      </fieldset>
      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" disabled={blocked || pending}>
          {pending ? 'Running…' : 'Make storyboard'}
        </Button>
        {error && (
          <p role="alert" className="text-caption text-destructive">
            {error}
          </p>
        )}
      </div>
    </Blueprint>
  )
}
