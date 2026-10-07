'use client'

import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Button } from '@/shared/components/ui/button'
import type { ActionResult } from '@/shared/types/action-result'
import type { Persona } from '@/shared/types/student'
import { SAVE_FAILED } from '../model/messages'

/** "Prefer not to say" stores 'neutral', as Skip does. */
const CHOICES = [
  { label: 'Male', persona: 'male' },
  { label: 'Female', persona: 'female' },
  { label: 'Prefer not to say', persona: 'neutral' },
] as const satisfies readonly { label: string; persona: Persona }[]
type Choice = (typeof CHOICES)[number]

const FIRST_SCREEN = '/opening/facts'

/**
 * "How should we picture you?" (frames r10a-1, r10a-2): an optional choice of comic character,
 * saved by Start or Skip, then "You're in" while screen 1 opens. Nothing else sets the character,
 * not the Google name or photo (criterion 15).
 */
export function PictureQuestion({
  savePersonaAction,
}: {
  savePersonaAction: (persona: Persona) => Promise<ActionResult>
}) {
  const router = useRouter()
  const [chosen, setChosen] = useState<Choice | null>(null)
  const [saved, setSaved] = useState<Persona | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function save(persona: Persona) {
    setPending(true)
    setError(null)
    try {
      const result = await savePersonaAction(persona)
      if (result.ok) {
        setSaved(persona)
        router.push(FIRST_SCREEN)
        return
      }
      setError(result.error)
    } catch {
      setError(SAVE_FAILED)
    }
    setPending(false)
  }

  if (saved) {
    return (
      <div role="status" className="flex flex-col gap-4">
        <Image src="/brand/duck.png" alt="" width={48} height={48} loading="eager" />
        <h2 className="m-0 font-heading text-h3 font-semibold">
          You're in. The first screen opens in a moment.
        </h2>
        <p className="m-0 text-muted-foreground">{`Your comic character is ${saved}.`}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <p className="m-0 text-overline uppercase text-muted-foreground">Optional · one tap</p>
        <h2 className="m-0 font-heading text-h3 font-semibold">How should we picture you?</h2>
        <p className="m-0 text-muted-foreground">
          Used only to pick the character in your comics. Nothing else reads it. Skip it and the
          character is neutral.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {CHOICES.map((choice) => (
          <Button
            key={choice.label}
            type="button"
            variant="outline"
            aria-pressed={chosen === choice}
            disabled={pending}
            onClick={() => setChosen(chosen === choice ? null : choice)}
            className="h-11 font-sans text-base font-normal aria-pressed:border-primary aria-pressed:bg-accent-200"
          >
            {choice.label}
          </Button>
        ))}
      </div>
      {error ? (
        <p className="m-0 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <div className="grid grid-cols-2 gap-2">
        <Button
          type="button"
          variant="outline"
          size="lg"
          disabled={pending}
          onClick={() => void save('neutral')}
        >
          Skip
        </Button>
        <Button
          type="button"
          variant="strong"
          size="lg"
          disabled={pending}
          onClick={() => void save(chosen?.persona ?? 'neutral')}
        >
          Start
        </Button>
      </div>
    </div>
  )
}
