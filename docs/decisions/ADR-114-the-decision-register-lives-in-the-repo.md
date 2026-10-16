---
id: ADR-114
title: "The decision register lives in the repo, one file per decision"
status: accepted
date: 2026-10-07
---
# ADR-114 · The decision register lives in the repo, one file per decision

## Decision

The shared decision register is `docs/decisions/` in the product repo: one Markdown file per ADR with front matter (id, title, status, date, amendments), an index in `README.md`, and `TEMPLATE.md` for new entries. ADR-001 to ADR-113 were imported from `SHARED-decision-record.html` on 7 Oct 2026 without rewording; the HTML is pre-repo history and is not edited again. Working notes such as `docs/hackathon/decisions-2026-10-07.md` cite ADR ids and never replace them.

A decision that sits inside one person's slice (the admin slice is Nikhil's, the student opening is Jenish's) is recorded as `accepted` by its owner. A decision that crosses slices, or binds the shared project (hosting, the profile contract, the submission), is `proposed` until both have agreed.

## Reasoning

- The HTML had one editor and no history; a change by one person was invisible to the other until the file was re-shared. Files in git are versioned, diffed in pull requests and readable by both authors and by the agents that plan and build from them.
- One file per decision keeps merges clean with two authors and lets an intent or plan link the exact decision it rests on.
- The owner rule keeps slice work moving: a slice owner should not wait for a counter-signature on a decision only their code implements, and the other author can always reopen it with a new ADR.

## Rejected alternative

- One running log file: light, but long files get skimmed and two authors conflict on the same lines.
- Keeping the HTML: not versioned, one editor, unreadable to agents.

## Constrains

Every intent and plan cites ADR ids. New ADRs continue the numbering from the highest id. History is never edited: a reversal is a new ADR that supersedes the old one.
