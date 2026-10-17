// What a call is waiting for, told to the step run it is part of (server/steps.ts), which keeps it
// in the run's progress for the loaders to say (lib/running.ts). Kept apart from the database, so
// the AI client imports it freely; outside a run (a student's call, a test) a note goes nowhere.

import { AsyncLocalStorage } from 'node:async_hooks'
import type { WaitNote } from '../lib/running'

/** Who hears a run's notes: the current one (null clears it), and a call answered on Flash-Lite. */
export type WaitListener = {
  note(note: WaitNote | null): void
  lite(model: string): void
}

/** A run's listener and the note of each of its calls still waiting, oldest first. */
type Run = { listener: WaitListener; waiting: Map<object, WaitNote> }

const runs = new AsyncLocalStorage<Run>()

/** Runs `work` with its calls' notes told to `listener`. */
export function withWaitNotes<T>(listener: WaitListener, work: () => Promise<T>): Promise<T> {
  return runs.run({ listener, waiting: new Map() }, work)
}

/**
 * One call's notes: what it waits for, or that it waits no more (null). A call clears only its
 * own note; the run is told the latest note of a call still waiting, so a sibling call that
 * answers does not hide that another still waits.
 */
export function callNotes(): (note: WaitNote | null) => void {
  const run = runs.getStore()
  if (!run) return () => {}
  const call = {}
  return (note) => {
    run.waiting.delete(call)
    if (note) run.waiting.set(call, note)
    run.listener.note([...run.waiting.values()].at(-1) ?? null)
  }
}

/** Tells the run this call was answered on Flash-Lite because Flash and Pro were busy. */
export function noteLite(model: string): void {
  runs.getStore()?.listener.lite(model)
}
