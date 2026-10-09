'use client'

import { ChevronDown } from 'lucide-react'
import { useId, useState } from 'react'
import { CITIES, PLACES, placeById, placeLabel } from '@/features/engine'
import { cn } from '@/shared/lib/utils'
import {
  type AnswerValue,
  RELATIONSHIPS,
  type Relationship,
  type Relative,
} from '@/shared/types/student'
import { AnswerCards } from './AnswerCards'

const ELSEWHERE = 'elsewhere'
const LABEL = 'mb-1.5 block text-caption font-medium text-muted-foreground'
const FIELD =
  'block min-h-12 w-full border border-input bg-muted px-3.5 py-2.5 text-base text-foreground caret-primary hover:border-foreground/45 focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-safe:transition-colors'

/** The preview's places under their cities, labelled as in the person line (placeLabel). */
const PLACE_GROUPS = CITIES.map((city) => ({
  city: city.name,
  places: PLACES.filter((place) => place.cityId === city.id).map((place) => ({
    id: place.id,
    label: placeLabel(place),
  })),
})).filter((group) => group.places.length > 0)

const RELATIONSHIP_CARDS = { options: RELATIONSHIPS, notSure: false }

type Draft = {
  /** A place id, ELSEWHERE, or '' before she picks. */
  choice: string
  typed: string
  relationship: Relationship | null
  name: string
}

const draftOf = (relative: Relative | null): Draft => ({
  choice: relative?.placeId ?? (relative?.place == null ? '' : ELSEWHERE),
  typed: relative?.placeId === null ? (relative.place ?? '') : '',
  relationship: relative?.relationship ?? null,
  name: relative?.name ?? '',
})

/** The person the form names, trimmed; `null` when every part is blank. */
function personOf({ choice, typed, relationship, name }: Draft): Relative | null {
  const known = choice === ELSEWHERE ? undefined : placeById(choice)
  const person: Relative = {
    placeId: known?.id ?? null,
    // "Somewhere else" is a place even before she types it ('').
    place: known ? known.name : choice === ELSEWHERE ? typed.trim() : null,
    relationship,
    name: name.trim() || null,
  }
  return Object.values(person).every((part) => part === null) ? null : person
}

/**
 * Step 03's "Who, and where?": a place from the preview or one she types, the relationship and
 * optionally a name, every part allowed blank. Every change hands on the person the form now
 * names (typing included: the screen debounces the save). The form keeps what she types, so a
 * space she is about to follow with a letter is not trimmed away under her.
 */
export function PersonForm({
  relative,
  onChange,
  labelledBy,
}: {
  relative: Relative | null
  onChange: (relative: Relative | null) => void
  /** The id of the h1 that asks "Who, and where?". */
  labelledBy: string
}) {
  const id = useId()
  const [draft, setDraft] = useState(() => draftOf(relative))

  function change(patch: Partial<Draft>) {
    const next = { ...draft, ...patch }
    setDraft(next)
    onChange(personOf(next))
  }

  return (
    <fieldset
      aria-labelledby={labelledBy}
      className="mt-1 flex min-w-0 flex-col gap-5 @max-xl:gap-4"
    >
      <div>
        <label htmlFor={`${id}-place`} className={LABEL}>
          City or suburb
        </label>
        <div className="relative">
          <select
            id={`${id}-place`}
            value={draft.choice}
            onChange={(e) => change({ choice: e.target.value })}
            className={cn(
              FIELD,
              'cursor-pointer appearance-none truncate pr-11',
              draft.choice === '' && 'text-muted-foreground',
            )}
          >
            <option value="" className="text-foreground">
              Choose a city or suburb
            </option>
            {PLACE_GROUPS.map((group) => (
              <optgroup key={group.city} label={group.city} className="text-foreground">
                {group.places.map((place) => (
                  <option key={place.id} value={place.id}>
                    {place.label}
                  </option>
                ))}
              </optgroup>
            ))}
            <optgroup label="Not listed" className="text-foreground">
              <option value={ELSEWHERE}>Somewhere else</option>
            </optgroup>
          </select>
          <ChevronDown
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 right-3.5 size-icon -translate-y-1/2 text-muted-foreground"
          />
        </div>
      </div>

      {draft.choice === ELSEWHERE ? (
        <div>
          <label htmlFor={`${id}-where`} className={LABEL}>
            Where?
          </label>
          <input
            id={`${id}-where`}
            type="text"
            autoComplete="off"
            maxLength={80}
            placeholder="Town or city, and country"
            value={draft.typed}
            onChange={(e) => change({ typed: e.target.value })}
            className={cn(FIELD, 'placeholder:text-muted-foreground')}
          />
        </div>
      ) : null}

      <div>
        <p id={`${id}-relationship`} className={cn('m-0', LABEL)}>
          They're your…
        </p>
        <AnswerCards
          question={RELATIONSHIP_CARDS}
          labelledBy={`${id}-relationship`}
          answer={draft.relationship ? { value: draft.relationship, state: 'stated' } : undefined}
          onAnswer={(raw: AnswerValue) =>
            change({ relationship: RELATIONSHIPS.find((r) => r === raw) ?? null })
          }
          dense
        />
      </div>

      <div>
        <label htmlFor={`${id}-name`} className={LABEL}>
          Name <span className="font-normal text-muted-foreground">(optional)</span>
        </label>
        <input
          id={`${id}-name`}
          type="text"
          autoComplete="off"
          maxLength={40}
          value={draft.name}
          onChange={(e) => change({ name: e.target.value })}
          className={FIELD}
        />
      </div>
    </fieldset>
  )
}
