// The Ideas queue's suggestions (ADR-042): topics to research and workshops or services to offer,
// each with the evidence behind it. Mock for the demo (ADR-057): a repo file parsed at load, as
// brands/index.ts and markets/index.ts are; the screen says so. Client-safe: JSON and zod only.

import { z } from 'zod'
import { ideaPostHref } from '../lib/idea-start'
import file from './ideas.json'

const IdeaSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]{1,64}$/),
    group: z.enum(['content', 'expansion']),
    kind: z.enum(['research', 'event', 'service']),
    title: z.string().min(1),
    evidence: z.string().min(1),
    from: z.string().min(1),
    suggested: z.object({ format: z.string().min(1), destination: z.string().min(1) }),
    /** "Candidate sources": where research would start. */
    sources: z.array(z.string().min(1)).min(1).optional(),
    /** An event's "Delivered by". */
    deliveredBy: z.array(z.string().min(1)).min(1).optional(),
  })
  // An event names who delivers it; anything else its candidate sources.
  .refine((i) => (i.kind === 'event' ? !!i.deliveredBy && !i.sources : !!i.sources))

export type Idea = z.infer<typeof IdeaSchema>

const FileSchema = z.object({ mock: z.literal(true), ideas: z.array(IdeaSchema).min(1) })

/** The queue's admin page. */
export const IDEAS_PATH = '/admin/ideas'

export const IDEAS: readonly Idea[] = FileSchema.parse(file).ideas
export const IDEA_IDS: readonly string[] = IDEAS.map((i) => i.id)

export function ideaById(id: string): Idea | null {
  return IDEAS.find((i) => i.id === id) ?? null
}

/** The idea text a post starts from: the idea's title and its evidence. */
export const ideaText = (idea: Idea) => `${idea.title}. ${idea.evidence}`

/** New post started from a content idea, naming it so the post made is recorded on it. */
export const ideaStartHref = (idea: Idea) => ideaPostHref({ text: ideaText(idea), ideaId: idea.id })

/** An editor's decision on an idea, as stored (server/ideas-queue.ts). */
export type IdeaDecision = {
  ideaId: string
  decision: 'accepted' | 'dismissed'
  postId: string | null
}

/** A row of the queue: the idea, and once accepted, the post started from it (or none yet). */
export type QueueRow = { idea: Idea; state: { accepted: true; postId: string | null } | null }

/** The queue: every idea in the file's order, but the dismissed, which are never shown again. */
export function queueRows(ideas: readonly Idea[], decisions: readonly IdeaDecision[]): QueueRow[] {
  const byId = new Map(decisions.map((d) => [d.ideaId, d]))
  return ideas.flatMap((idea) => {
    const decision = byId.get(idea.id)
    if (decision?.decision === 'dismissed') return []
    return [
      {
        idea,
        state: decision ? { accepted: true as const, postId: decision.postId } : null,
      },
    ]
  })
}
