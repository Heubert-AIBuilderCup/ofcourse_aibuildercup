---
id: ADR-124
title: "Instagram pages as brand data, a theme-to-page rule, and a post-publish link record"
status: accepted
date: 2026-10-07
---
# ADR-124 · Instagram pages as brand data, a theme-to-page rule, and a post-publish link record

## Decision

OfCourse runs several Instagram pages by kind of content (@ofcourse_ai, @ofcourse_philosophy, @ofcourse_selfhelp at launch). A page is a brand file with an Instagram handle and URL. A repo rule file maps a post's theme to the page brand the Adapt step pre-selects; the editor may change it. After the editor posts manually, the post's Instagram URL is kept as a new immutable record on the exported Instagram version (never a change to the locked settings). The student feed shows "See this post on Instagram" and "Follow @<handle>" for that page, and lists every page under "Follow OfCourse on Instagram". The links show before the pages exist.

## Reasoning

- The brand files already are page identities (ADR-031); a handle is one field, not a new concept.
- Which page posts what must be a rule in data, never a model's choice (ADR-077), and auditable.
- The URL exists only after posting, which is after approval; settings lock at approval (criterion 54), so the link is its own record.
- The feed and the pages become one loop: the feed holds preferences and search, the pages hold attention.

## Rejected alternative

Posting through the Instagram API (ADR-033 stands: assets and captions here, posting in existing tools); one generic page; a per-post link typed into settings before approval.

## Constrains

Amends ADR-031 (a brand carries its page's handle). The business risk is outside the code: several new accounts split a new brand's growth; start with two if cadence is short. Any URL off instagram.com is refused.
