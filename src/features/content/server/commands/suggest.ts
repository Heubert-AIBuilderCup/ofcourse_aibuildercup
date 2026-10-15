import 'server-only'
import { canEdit } from '@/shared/lib/auth/access'
import type { ActionResult } from '@/shared/types/action-result'
import {
  findSources,
  findSupport,
  type SuggestedSource,
  type SupportingSource,
} from '../../ai/search'
import { WORKFLOW_ERRORS } from '../../lib/workflow'
import { SOURCE_ERRORS, searchTextError } from '../../model/artifacts'
import { fetchPage, type PageResult } from '../fetch-page'
import { runStep } from '../steps'
import { type Actor, DB_ERROR, fail, open } from './shared'

/** The pages suggested for an idea, and Google's search entry point to show with them. */
export type Suggested = ActionResult<{ sources: SuggestedSource[]; entryPoint: string | null }>

/** An idea's refusals, by the search text guard. */
const IDEA_ERRORS = {
  empty: SOURCE_ERRORS.ideaEmpty,
  length: SOURCE_ERRORS.ideaLength,
  link: SOURCE_ERRORS.ideaLink,
}

/**
 * "Find sources" (BR12): an editor's idea, by the search text guard (1 to 200 characters, more
 * than a link; digits are fine), searched with Google Search; the pages it suggests, each at its
 * resolved address, official first (../../ai/search.ts). No record is made and no post: the
 * editor ticks the pages to use, and "Make post" reads them as links (BR13).
 */
export async function suggestSources(
  actor: Actor,
  input: { idea: string },
  read: (url: string) => Promise<PageResult> = fetchPage,
): Promise<Suggested> {
  // No post exists: the rule is who may make one, before any search is spent.
  if (!canEdit(actor)) return fail(WORKFLOW_ERRORS.notAuthorised)
  const refused = searchTextError(input.idea, IDEA_ERRORS)
  if (refused) return fail(refused)
  // Neither the search nor the reader throws: each failure is a message.
  return findSources(input.idea.trim(), read)
}

/** The step "Research this" runs as: one press at a time on a post, and what moves wait on. */
export const RESEARCH_STEP = 'research'

/**
 * A flagged sentence's refusals, by the search text guard: one over 200 characters is too long to
 * search; the check flags only sentences, so an empty one or a bare link has moved on.
 */
const CLAIM_ERRORS = {
  empty: WORKFLOW_ERRORS.movedOn,
  length: 'This sentence is too long to research. Shorten it first.',
  link: WORKFLOW_ERRORS.movedOn,
}

/** The pages offered as support for a sentence, and Google's search entry point to show with them. */
export type Researched = ActionResult<{
  sources: SupportingSource[]
  entryPoint: string | null
}>

/**
 * "Research this" (BR14): a sentence the post's source check did not find, searched with Google
 * Search once per press; the pages, at most three, each at its resolved address with its sentence
 * that the source check finds supports it (../../ai/search.ts findSupport). An editor's, where the
 * check shows; only a sentence the check marks not found, so no other text is ever searched.
 * Nothing is saved: "Add as a source" (./source.ts addResearchSource) saves the one chosen.
 */
export async function researchClaim(
  actor: Actor,
  id: string,
  version: number,
  input: { sentence: string },
  read: (url: string) => Promise<PageResult> = fetchPage,
): Promise<Researched> {
  try {
    const opened = await open(actor, 'researchClaim', id, version)
    if (!opened.ok) return opened
    const check = opened.post.current.sourceCheck
    if (!check) return fail(WORKFLOW_ERRORS.checkFirst)
    const claim = input.sentence.trim()
    if (!check.body.claims.some((c) => c.result === 'not_found' && c.text === claim)) {
      return fail(WORKFLOW_ERRORS.movedOn)
    }
    const refused = searchTextError(claim, CLAIM_ERRORS)
    if (refused) return fail(refused)
    // Under the step's lock: a second press while one searches is refused, not searched again.
    return await runStep(id, RESEARCH_STEP, version, () => findSupport(claim, { postId: id, read }))
  } catch (err) {
    console.error('[content.commands.researchClaim]', err)
    return fail(DB_ERROR)
  }
}
