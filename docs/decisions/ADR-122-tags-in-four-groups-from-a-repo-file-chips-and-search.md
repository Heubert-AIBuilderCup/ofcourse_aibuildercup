---
id: ADR-122
title: "Tags in four groups from a repo file; feed chips, search and profile pre-selection"
status: accepted
date: 2026-10-07
---
# ADR-122 · Tags in four groups from a repo file; feed chips, search and profile pre-selection

## Decision

Posts are tagged from a repo file in four groups: destination (Australia, United Kingdom, New Zealand, United States), home country (Nepal, India, Thailand), theme (Work and study life, Books and movies) and age band (under 21, 21–25, over 25). A post may carry any number of tags; no tag in a group means it is for everyone in that group. The feed filters by chips kept in the URL, combined with a search box over title, excerpt and slide text (every word, case-insensitive, in code over the live posts). The home-country chip is also the switch that shows a post's market version. When Jenish's slice stores the student's profile (ADR-126), its values pre-select empty chips; a chip in the URL always wins.

## Reasoning

- A curated system can offer what Instagram cannot: finding posts by theme and destination and reading the version for your own country. Tags are the cheapest honest form of that.
- Files, not tables, for the taxonomy, so Nikhil edits them without a deploy of new code paths (ADR-110's rule for templates and brands).
- Search in code over a few dozen posts avoids a schema change; Postgres full-text search replaces it when the catalogue outgrows that.

## Rejected alternative

Profile-rule matching now (no profile exists); Postgres full-text search now; a separate `?market=` switch beside the home chip.

## Constrains

Nothing in settings becomes required (criterion 52 unchanged). The age bands are a first cut Nikhil confirms by editing the file.
