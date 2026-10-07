'use client'

import { useId, useState } from 'react'
import { cityById, PLACES, placeById } from '@/features/engine'
import { Blueprint } from '@/shared/components/Blueprint'
import { Input } from '@/shared/components/ui/input'
import { RELATIONSHIPS, type Relative } from '@/shared/types/student'
import { NATIVE_SELECT, OPTIONS, OptionToggle } from './OptionButtons'

const ELSEWHERE = 'elsewhere'
const LABEL = 'm-0 text-caption text-muted-foreground'

/** "Cannington, Perth"; a place that is its city reads once ("Hobart"), as in the impact line. */
const PLACE_OPTIONS = PLACES.map((place) => {
  const city = cityById(place.cityId).name
  return { id: place.id, label: place.name === city ? place.name : `${place.name}, ${city}` }
})

type Draft = {
  /** A place id, ELSEWHERE, or '' before she picks. */
  choice: string
  typed: string
  relationship: Relative['relationship'] | null
  name: string
}

const draftOf = (relative: Relative | null): Draft => ({
  choice: relative ? (relative.placeId ?? ELSEWHERE) : '',
  typed: relative?.placeId === null ? relative.place : '',
  relationship: relative?.relationship ?? null,
  name: relative?.name ?? '',
})

/** The person, once the form names a place and a relationship; null before. */
function relativeOf({ choice, typed, relationship, name }: Draft): Relative | null {
  if (!relationship) return null
  const who = name.trim() || null
  if (choice === ELSEWHERE) {
    const place = typed.trim()
    return place ? { placeId: null, place, relationship, name: who } : null
  }
  const place = placeById(choice)
  return place ? { placeId: place.id, place: place.name, relationship, name: who } : null
}

const same = (a: Relative, b: Relative | null): boolean =>
  b !== null &&
  a.placeId === b.placeId &&
  a.place === b.place &&
  a.relationship === b.relationship &&
  a.name === b.name

/**
 * "Who, and where?" (frames r8c-0, r8c-1): someone she knows in Australia, a place from the
 * preview or one she types, the relationship and optionally a name. Hands the person on once a
 * place and a relationship are set: a pick at once, typing when she leaves the field.
 */
export function RelativeForm({
  relative,
  onSave,
}: {
  /** As saved. */
  relative: Relative | null
  onSave: (relative: Relative) => void
}) {
  const id = useId()
  const [draft, setDraft] = useState(() => draftOf(relative))

  function commit(next: Draft) {
    const person = relativeOf(next)
    if (person && !same(person, relative)) onSave(person)
  }

  function change(patch: Partial<Draft>, save: boolean) {
    const next = { ...draft, ...patch }
    setDraft(next)
    if (save) commit(next)
  }

  return (
    <Blueprint className="flex flex-col gap-4 p-4">
      <h3 className="m-0 font-heading text-h4">Who, and where?</h3>
      <div className="flex flex-col gap-2">
        <label htmlFor={`${id}-place`} className={LABEL}>
          City or suburb
        </label>
        <select
          id={`${id}-place`}
          value={draft.choice}
          onChange={(e) => change({ choice: e.target.value }, true)}
          className={NATIVE_SELECT}
        >
          <option value="" disabled>
            Choose one
          </option>
          {PLACE_OPTIONS.map((place) => (
            <option key={place.id} value={place.id}>
              {place.label}
            </option>
          ))}
          <option value={ELSEWHERE}>Somewhere else</option>
        </select>
      </div>
      {draft.choice === ELSEWHERE ? (
        <div className="flex flex-col gap-2">
          <label htmlFor={`${id}-where`} className={LABEL}>
            Where?
          </label>
          <Input
            id={`${id}-where`}
            maxLength={80}
            value={draft.typed}
            onChange={(e) => change({ typed: e.target.value }, false)}
            onBlur={() => commit(draft)}
            className="h-11 max-w-sm"
          />
        </div>
      ) : null}
      <div className="flex flex-col gap-2">
        <p id={`${id}-relationship`} className={LABEL}>
          They're your…
        </p>
        <fieldset aria-labelledby={`${id}-relationship`} className={OPTIONS}>
          {RELATIONSHIPS.map((relationship) => (
            <OptionToggle
              key={relationship}
              pressed={draft.relationship === relationship}
              onClick={() => change({ relationship }, true)}
            >
              {relationship}
            </OptionToggle>
          ))}
        </fieldset>
      </div>
      <div className="flex flex-col gap-2">
        <label htmlFor={`${id}-name`} className={LABEL}>
          Name (optional)
        </label>
        <Input
          id={`${id}-name`}
          maxLength={40}
          autoComplete="off"
          value={draft.name}
          onChange={(e) => change({ name: e.target.value }, false)}
          onBlur={() => commit(draft)}
          className="h-11 max-w-sm"
        />
      </div>
    </Blueprint>
  )
}
