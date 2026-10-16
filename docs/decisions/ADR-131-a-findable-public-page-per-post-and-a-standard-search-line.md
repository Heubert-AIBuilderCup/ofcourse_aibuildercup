---
id: ADR-131
title: "A public, indexable page per live post, and a standard last-slide search line"
status: accepted
date: 2026-10-09
---
# ADR-131 · A public, indexable page per live post, and a standard last-slide search line

## Decision

Every post's last slide ends with `To find this again, search “OfCourse <title>”`, drawn by code. So that the search works on Google, every live post also gets a public page at `/posts/<slug>`, readable without signing in, titled "<title> | OfCourse", with the cover as its share image, listed in `/sitemap.xml`, and with a call to join OfCourse. It shows the post's general content only: never its audience or why line. Expired or unpublished posts answer "not found".

## Reasoning

Posts travel on Instagram and other channels; a reader who wants them again searches Google, and a bare title would not lead to OfCourse. The brand name in the search phrase and the page title makes the post findable and drives traffic to the site. The feed stays behind sign-in for its personal layers.

## Rejected alternative

The line without public pages (the search would find nothing); making the whole feed public.

## Constrains

Amends ADR-121 (the feed stays signed-in; single posts become public). Indexing takes days to weeks after launch, so on demo day the OfCourse feed search is what finds a post by its title.
