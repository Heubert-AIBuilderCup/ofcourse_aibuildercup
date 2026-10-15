---
id: ADR-126
title: "The student profile contract between the two slices: homeMarket, destinations, ageBand"
status: proposed
date: 2026-10-07
---
# ADR-126 · The student profile contract between the two slices: homeMarket, destinations, ageBand

## Decision (proposed; needs Jenish)

The student slice stores, on the student's record, `homeMarket` (a market id from the markets file: `NP`, `IN`, `TH`, or null), `destinations` (destination tag values: `AU`, `UK`, `NZ`, `US`) and `ageBand` (`under-21`, `21-25`, `over-25`, or null), under those names. The admin slice's feed reads them through one function, `loadStudentProfile(userId)`, whose body the student slice supplies; until then it returns null and the feed's chips start empty.

The profile pre-selects the chips only when the feed's URL names no filter at all. Any filter key in the URL, even an empty one, is the student's own choice, so the profile stays out whole: a chip she clears stays clear, and a link from a page whose URL named its filters keeps naming them (with every chip cleared, an empty `q`). _Amended 11 Oct 2026 (review round 2): the first version filled any chip the URL left empty, so Clear could never clear a chip the profile had filled._

## Reasoning

- The feed's targeting (ADR-122) needs three values the opening already asks for in other words. Naming them now lets both slices build without waiting on each other, and the feed changes nothing when the values arrive.
- The values are the tag file's ids, so a tag edit is one place.

## Rejected alternative

Deciding the contract after the submission (the demo feed would stay untargeted for every student); the feed reading Jenish's tables directly (couples the slices).

## Constrains

The function lives at `src/features/content/server/student-profile.ts` (server-only, since its body reads the student's record); the contract's type and the chip rule (`StudentProfile`, `chipsFromProfile`) stay client-safe in `src/features/content/lib/profile-contract.ts`. _Moved 11 Oct 2026; it was in `lib/`, which the browser may import._ Changing a field name is a new ADR. Jenish confirms the field names and where the record lives by 9 Oct.
