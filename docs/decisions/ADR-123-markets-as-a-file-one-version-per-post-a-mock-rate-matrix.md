---
id: ADR-123
title: "Markets as a file, one market version per post, a mock rate matrix for four source currencies"
status: accepted
date: 2026-10-07
---
# ADR-123 · Markets as a file, one market version per post, a mock rate matrix for four source currencies

## Decision

The Nepal version generalises to a market version. Markets (Nepal · NPR, India · INR, Thailand · THB, each with its decision frame and tone notes) and rates (twelve mock, dated rows from AUD, GBP, NZD and USD into each market currency) are repo files parsed at load. The editor picks the market when making the version; a post has at most one market version in this slice. Code converts each money figure from its own currency at the file's rate and draws "<market currency> at <rate> per <source currency> · mock rate · <date>" under it; a figure with no currency code or symbol is not converted; a pair with no row refuses the version rather than guessing.

## Reasoning

- Students come from more than Nepal and go to more than Australia; the sources quote the destination's currency, so one rate is not enough once UK, NZ and US posts exist.
- Several market versions per post would change the approval record, the review screen and the pointers across about 120 references; one version per post keeps the surgery to the data and the labels.
- Mock rates labelled as such keep ADR-097's rule: every rate is a fact with a source and a date, shown wherever a converted figure is.

## Rejected alternative

Several market versions per post now; keeping Nepal only; converting at a single AUD rate for every source currency.

## Constrains

Amends ADR-097 (one rate becomes a rate file). Criteria 56–61 hold for every market. The bare `$` stays unconverted because it is ambiguous.
