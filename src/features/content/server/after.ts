import 'server-only'
import { after } from 'next/server'

// Work that runs after the response is sent (Next's after(), node_modules/next/dist/docs/
// 01-app/03-api-reference/04-functions/after.md), so a slow step such as the source check never
// holds the request that started it.

type Task = () => Promise<unknown>

let schedule: (task: Task) => void = (task) => after(task)

/** Runs `task` once the response has been sent. Call it inside a server action or route. */
export function afterResponse(task: Task): void {
  schedule(task)
}

/**
 * Replaces the scheduler. after() throws outside a request, so the database tests, which call
 * the commands directly, run each task at once and keep its promise to await.
 */
export function scheduleWith(fn: (task: Task) => void): void {
  schedule = fn
}
