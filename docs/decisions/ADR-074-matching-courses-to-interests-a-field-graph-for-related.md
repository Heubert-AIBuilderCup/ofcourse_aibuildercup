---
id: ADR-074
title: "Matching courses to interests: a field graph for related topics, embeddings for synonyms, explanations for everything"
status: accepted
date: 2026-10-01
source: SHARED-decision-record.html (imported 2026-10-07)
---

# ADR-074 · Matching courses to interests: a field graph for related topics, embeddings for synonyms, explanations for everything

## Decision

- **A field graph** for related topics: fields → subfields → niche fields, with edges *is-a* (psychology → suicidology), *combines* (psychology × technology → cyberpsychology), *related* (psychology → counselling, criminology, UX research, HR). Seeded from Australia's own field-of-education classification (ASCED) and counsellor-curated niche lists (the "hidden menu" from the vision work), extended over time.
- **Embeddings** for synonyms and fuzzy interests: course descriptions and the student's interest text ("I like understanding why people do things") embedded and matched, so "mind", "behaviour", "mental health" find psychology without a keyword list. Edge's hybrid search already does this for the knowledge base.
- **Interests are captured three ways:** the interests inventory (RIASEC, ADR-069), free text about what they like to read, watch and do, and tasters. Subjects already studied count too.
- **Every match explains itself and defines the field**: "Because you like psychology and technology → cyberpsychology: the psychology of how people behave online." Niche fields always carry a one-line definition, since by definition the student has never heard of them.
- **Niche matches show their trade-offs** as clearly as their appeal (ADR-052): how many courses exist, where, and whether the field maps to a skilled occupation.

## Reasoning

Students cannot choose a path they have never heard named; a graph finds the related and the niche, embeddings forgive how they phrase an interest, and the explanation makes the match trustworthy (Nikhil, 1 Oct).

## Constrains

Data: `Field` collection with edges and definitions; `niche` flag; course → field tags (W1). Engine: deck draws use graph distance + embedding similarity; wildcards come from graph neighbours the student has not seen. Hackathon: a curated graph of \~20 fields around psychology, IT and business; embeddings optional (Vertex AI text embeddings) or a synonym table.
