---
id: ADR-121
title: "The student feed joins the admin slice: /feed for every signed-in account, every live post shown"
status: accepted
date: 2026-10-07
---
# ADR-121 · The student feed joins the admin slice: /feed for every signed-in account, every live post shown

## Decision

The feed that shows published posts to students is built in the admin slice (`docs/admin-feed-post-from-source/intent.md`, story 11): `/feed` under the signed-in app for every account, a post page with every approved slide (one per swipe on a phone), a student-safe image route that serves only assets an approval pinned, expiry honoured from the approval time, Featured pinned for 72 hours. Every live post shows to every account, with its layer tag, because profile matching does not exist yet. The feed is not the student home; the dashboard stays until Jenish's opening slice decides it.

## Reasoning

- "Stored live; feed comes later" left the content engine with no student-facing proof. The reviewer's approval already is publishing; a page that reads the same records closes the loop at small cost (the phone card and the live line exist).
- Showing Matched and Personal posts to everyone is consistent with the audience counts being mock (criterion 53) and lets the demo show the layers.

## Rejected alternative

Posting to Instagram and LinkedIn through their APIs (criterion 68, ADR-033); a data contract for Jenish's pages without a page of ours; making `/feed` the home (touches `HOME_PATH`, which his slice also plans to change).

## Constrains

Refines ADR-016: one stream, personal items labelled. Adds `/feed` to `APP_PATHS` and the proxy matcher; Jenish is told before he names his routes. The user test moves to 12 Oct so the feed is in it (ADR-127).
