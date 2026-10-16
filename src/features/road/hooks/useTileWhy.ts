'use client'

import { useEffect, useState } from 'react'
import type { ActionResult } from '@/shared/types/action-result'
import type { StoredAnswers } from '@/shared/types/student'

/** roadWhyAction: the model's why for a tile on her roadmap, else the template. */
export type WhyAction = (
  roadmapId: string,
  tileId: string,
) => Promise<ActionResult<{ text: string; source: 'model' | 'template' }>>

/** One ask: its text once it has an answer (null until then). */
type Ask = { text: string | null; done: Promise<string> }

/**
 * Every why asked for while the page lives, by roadmap, tile, template and saved answers: opening
 * the same card again asks nothing (criterion 18); a changed answer asks again, as the model's
 * words may quote it even when the template reads the same. One entry per why tile a roadmap's
 * answers have given, so it stays small.
 */
const asked = new Map<string, Ask>()

/** Her answers as one string, the same whatever order they are stored in. */
const fingerprint = (answers: StoredAnswers): string =>
  JSON.stringify(
    Object.keys(answers)
      .sort()
      .map((key) => [key, answers[key as keyof StoredAnswers]]),
  )

function ask(key: string, template: string, run: () => ReturnType<WhyAction>): Ask {
  const known = asked.get(key)
  if (known) return known
  const entry: Ask = {
    text: null,
    done: run().then(
      (r) => (r.ok ? r.text : template),
      () => template,
    ),
  }
  entry.done.then((text) => {
    entry.text = text
  })
  asked.set(key, entry)
  return entry
}

/**
 * The why a card shows: the template while the model writes, its words once they arrive, the
 * template again when it fails (no error shown, criterion 17). Off, or with no template, it asks
 * nothing.
 */
export function useTileWhy({
  roadmapId,
  tileId,
  template,
  answers = {},
  action,
  enabled,
}: {
  roadmapId: string
  tileId: string
  template: string | undefined
  /** Her saved answers, which the server writes the why from. */
  answers?: StoredAnswers
  action: WhyAction | undefined
  enabled: boolean
}): { text: string; loading: boolean } {
  const on = enabled && !!template && !!action
  const key = `${roadmapId}:${tileId}:${template}:${fingerprint(answers)}`
  const [arrived, setArrived] = useState<{ key: string; text: string } | null>(null)

  useEffect(() => {
    if (!on || !template || !action) return
    let live = true
    ask(key, template, () => action(roadmapId, tileId)).done.then((text) => {
      if (live) setArrived({ key, text })
    })
    return () => {
      live = false
    }
  }, [on, key, template, action, roadmapId, tileId])

  if (!on || !template) return { text: template ?? '', loading: false }
  const text = arrived?.key === key ? arrived.text : asked.get(key)?.text
  return text == null ? { text: template, loading: true } : { text, loading: false }
}
