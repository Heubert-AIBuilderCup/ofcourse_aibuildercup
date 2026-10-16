// The theme-to-page rule (ADR-124): which page brand the Adapt step pre-selects for a post's
// theme. One repo file parsed at load, as markets/index.ts does: a rule in data, never a model's
// choice, and the editor may still change it. Client-safe: JSON and zod only.

import { z } from 'zod'
import rules from './pages.json'

/** Theme tag id ("theme:books-movies") to page brand id ("cerebral"). */
export const PAGE_RULES: Readonly<Record<string, string>> = z
  .record(z.string().regex(/^theme:[A-Za-z0-9-]+$/), z.string().min(1))
  .parse(rules)

/** The page brand the rule file names for the theme, or null for no theme or one it does not name. */
export function pageBrandFor(themeTagId: string | null): string | null {
  return themeTagId === null ? null : (PAGE_RULES[themeTagId] ?? null)
}
