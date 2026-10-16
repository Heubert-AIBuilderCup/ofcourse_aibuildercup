---
id: ADR-047
title: "Fog of war and folding: how the board stays readable when the real world has too many options"
status: accepted
date: 2026-09-30
amended_by: [ADR-051]
source: SHARED-decision-record.html (imported 2026-10-07)
---

# ADR-047 · Fog of war and folding: how the board stays readable when the real world has too many options

## Decision

The board keeps the fog of war, with strict meanings, and handles large numbers of options by **merging, grouping, folding and zooming**, never by hiding a better option silently.

- **Fog means only "not looked at yet".** Four visual states, never mixed: *walked* (lit), *seen* (dim, labelled), *unexplored* (dark, shown as a count, e.g. "4 more steps"), and *not yet reachable* (hatched, with its blocker). Unknown data is a dotted outline, not darkness. Fog never means "impossible".
- **Merge shared steps.** Routes that share steps are drawn as one trunk that branches only where they differ (most Australian routes share the student visa and the 485; they split at PR). The active route is lit; the others are thin lines off the trunk.
- **Collapse near-duplicates.** Offerings that differ only by campus or intake, with the same trade-offs, are one tile with a badge ("3 intakes"); they separate in the route detail.
- **Fold siblings with a rule.** At each level the board shows at most 3 siblings on a phone and 5 on desktop. Always shown: the student's current tile, anything ranked or saved, and the best match. Then one contrast (cheapest, fastest or best PR, whichever differs most). The rest fold into stacks grouped by what matters (regional / metro; open / not yet reachable), each labelled with its count, how it is sorted, and how many match well ("12 regional cities · 4 match you well").
- **A folded option can never outrank a shown one silently.** If something in a stack scores above a shown tile, it is promoted.
- **Detail by distance.** Near the duck, full tiles; one step away, title and state; further, a dot; the overview shows counts. Badges carry complexity in a fixed small vocabulary (conditions, blockers, several offerings, fork ahead, out of date), at most two per tile with "+n".
- **Exploration persists.** A tile once walked stays walked when answers change; new tiles that appear after a re-rank arrive fogged with a "new" mark. The overview shows exploration as progress ("you've looked at 3 of 11 routes").
- **No collisions.** Labels, the weights plaque and tiles never overlap; on crowding, labels move to leader lines or appear on focus.

## Reasoning

- The v5 fog of war works for one straight route; with 19 cities, 15 courses per city, several intakes and two ways to PR it would become an unreadable mass (Nikhil, 30 Sep).
- Strategy and map games solve the same problem with shared paths, clustering, and level of detail by zoom; the student sees the shape of the decision first and the detail on demand.
- If darkness meant both "unexplored" and "impossible", students would read unexplored routes as closed.

## Constrains

The engine returns route steps as a shared-prefix tree, not independent lists. The fold rule is configurable (thresholds per device). Details and the Design prompt are in `HACKATHON-design-studio-2-fog-folding-interaction.md`.
