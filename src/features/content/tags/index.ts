// The tag taxonomy (ADR-122): four groups in one repo file, parsed at load as markets/index.ts
// does. A post carries any number of tag ids; none in a group means it is for everyone in that
// group. A home-country tag names a market, since the home chip is also the market-version
// switch. Client-safe: JSON, zod and the markets file only.

import { z } from 'zod'
import { MARKET_IDS } from '../markets'
import tags from './tags.json'

export const TAG_GROUPS = ['destination', 'home', 'theme', 'age'] as const
export type TagGroup = (typeof TAG_GROUPS)[number]

/** Each group's label, as the settings form's legends and the feed's chip rows name them (criteria 80, 81). */
export const TAG_GROUP_LABELS: Record<TagGroup, string> = {
  destination: 'Destination',
  home: 'Home country',
  theme: 'Theme',
  age: 'Age',
}

/** The id is "<group>:<value>", e.g. "destination:AU", "home:NP". */
const TagSchema = z
  .object({
    id: z.string().regex(/^[a-z]+:[A-Za-z0-9-]+$/),
    group: z.enum(TAG_GROUPS),
    label: z.string().min(1),
  })
  .refine((t) => t.id.startsWith(`${t.group}:`), { message: 'id must start with its group' })
  .refine((t) => t.group !== 'home' || (MARKET_IDS as readonly string[]).includes(t.id.slice(5)), {
    message: 'a home tag must name a market',
  })

export type Tag = z.infer<typeof TagSchema>

export const TAGS: readonly Tag[] = z
  .array(TagSchema)
  .refine((all) => new Set(all.map((t) => t.id)).size === all.length, {
    message: 'tag ids must be unique',
  })
  .parse(tags)

export function tagById(id: string): Tag | null {
  return TAGS.find((t) => t.id === id) ?? null
}

export function tagsIn(group: TagGroup): Tag[] {
  return TAGS.filter((t) => t.group === group)
}

/** The group of a tag id, or null when the file has no such tag. */
export function groupOf(id: string): TagGroup | null {
  return tagById(id)?.group ?? null
}
