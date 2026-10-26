// How a feed post bears on the student's roadmaps: a mock the panel beside a post shows under
// "For your roadmaps", labelled Sample so nobody reads it as advice. Pure and client-safe: tag
// ids and words only. The roadmaps arrive already reduced to a name and their destinations
// (lib/profile-from-answers.ts feedRoadmapOf, read on the server).

/** One of her roadmaps as the feed knows it: its name, and the destination tag values it leads to. */
export type FeedRoadmap = { name: string; destinations: string[] }

/**
 * How a post bears on her roadmaps: the sample sentence, said once, and the roadmaps it applies
 * to by name (each once, at most ROADMAP_NAMES_SHOWN, then `more`). `all` when the post names no
 * destination, so it is for every road; no names when its destination matches none of them.
 */
export type RoadmapLinks = { effect: string; all: boolean; names: string[]; more: number }

/** The most roadmap names the panel lists before "and N more". */
export const ROADMAP_NAMES_SHOWN = 3

/** One sample sentence per theme tag value, and one for a post with no theme the list knows. */
export const ROADMAP_EFFECTS = {
  'work-study-life': 'May change how many hours of paid work you plan beside your study.',
  'books-movies': 'Gives you a feel for daily life where this road leads, before you go.',
  general: 'Adds background to the choices on this road.',
} as const

const DESTINATION = 'destination:'
const THEME = 'theme:'

/** The sample sentence for a post's tags: its first theme that has one, else the general one. */
function effectOf(tags: readonly string[]): string {
  const theme = tags
    .filter((t) => t.startsWith(THEME))
    .map((t) => t.slice(THEME.length))
    .find(
      (t): t is keyof typeof ROADMAP_EFFECTS =>
        t !== 'general' && Object.hasOwn(ROADMAP_EFFECTS, t),
    )
  return ROADMAP_EFFECTS[theme ?? 'general']
}

/** A roadmap's name without the "Copy of " a copy took from its source, however many times. */
const ownName = (name: string): string => name.replace(/^(Copy of )+/, '')

/**
 * The post's links to her roadmaps: those leading to a destination the post is tagged with, in
 * her order, or all of them when it names none (a general post); names collapsed (copies and
 * repeats once) and cut at ROADMAP_NAMES_SHOWN. Null when she has no roadmap, so the section is
 * left out.
 */
export function roadmapLinks(
  tags: readonly string[],
  roadmaps: readonly FeedRoadmap[],
): RoadmapLinks | null {
  if (roadmaps.length === 0) return null
  const destinations = tags
    .filter((t) => t.startsWith(DESTINATION))
    .map((t) => t.slice(DESTINATION.length))
  const all = destinations.length === 0
  const linked = all
    ? roadmaps
    : roadmaps.filter((r) => r.destinations.some((d) => destinations.includes(d)))
  const names = [...new Set(linked.map((r) => ownName(r.name)))]
  return {
    effect: effectOf(tags),
    all,
    names: names.slice(0, ROADMAP_NAMES_SHOWN),
    more: Math.max(0, names.length - ROADMAP_NAMES_SHOWN),
  }
}
