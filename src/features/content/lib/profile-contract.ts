// The contract with the student slice (ADR-126, 7 Oct 2026; amended 11 Oct 2026): the three
// profile values the feed pre-selects its chips from, under these names, and the rule that turns
// them into chips. Client-safe: nothing here reads a database. The read itself is
// server/student-profile.ts, whose body Jenish's slice supplies when the student record lands;
// the feed changes nothing when it does. Changing a field name is a new ADR.

import type { MarketId } from '../markets'
import { type Filters, knownTagValues, parseMarket } from './feed'

/** What the student slice stores: the tag file's values, so a tag edit is one place (ADR-126). */
export type StudentProfile = {
  homeMarket: MarketId | null
  /** Destination tag values across all her roadmaps: AU, UK, NZ, US. */
  destinations: string[]
  /** An age-band tag value: under-21, 21-25, over-25. */
  ageBand: string | null
}

/**
 * The chips a feed URL with no filter key at all opens with (criterion 84: the URL wins). Any
 * filter key in the URL, even an empty one, is the student's own choice, so the profile stays out
 * whole: a chip she cleared stays clear, since filterHref keeps an emptied URL naming its filters.
 * Every destination the tag file knows becomes a destination chip (her roadmaps may lead to
 * several); a value the file lacks is ignored, since the profile crossed a slice boundary.
 */
export function chipsFromProfile(profile: StudentProfile | null, f: Filters): Filters {
  if (!profile || f.chosen) return f
  return {
    ...f,
    destination: knownTagValues('destination', profile.destinations),
    home: parseMarket(profile.homeMarket),
    age: knownTagValues('age', profile.ageBand),
  }
}
