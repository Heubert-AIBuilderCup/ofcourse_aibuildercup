---
id: ADR-130
title: "A design language per Instagram page, generated once from reference images"
status: accepted
date: 2026-10-09
---
# ADR-130 · A design language per Instagram page, generated once from reference images

## Decision

Each page brand can hold a design language: an editor uploads one or two reference images, Gemini writes short fields (art style, copy style, closest template), and the editor edits and saves them. Every draft and cover for that page then follows them, and the reference images go to the image model as style references. It is stored in the database (editable in the app), beside the brand file, which still owns colours and fonts.

## Reasoning

A per-post reference is work every time and posts drift apart; a hand-written style guide is a prompt in disguise. One reviewed design language per page gives consistency with no prompt-writing. Nano Banana 2.1 accepts style reference images, so covers can match a look visually, not only by description.

## Rejected alternative

A reference image per post; a new template generated from an uploaded design (slot boxes read from an image are error-prone; after the hackathon); Canva import.

## Constrains

Reference images must be the team's own or licensed. Amends ADR-124 (a page brand gains a design language).
