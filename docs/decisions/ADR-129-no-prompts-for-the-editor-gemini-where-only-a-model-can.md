---
id: ADR-129
title: "No prompts for the editor; Gemini only where only a model can do the job"
status: accepted
date: 2026-10-09
---
# ADR-129 · No prompts for the editor; Gemini only where only a model can do the job

## Decision

The editor never writes a prompt. The system builds every prompt from what it knows: the source, the template, the page's design language, the brand's tone, the chosen emotion and market. The only free-text inputs are optional and short (a cover idea of up to 120 characters, an emotion of up to 30), and both pass the art-prompt guard. Gemini keeps four jobs where only a model will do: choosing facts by pointing at source sentences, drafting slide copy (three versions), drawing covers (three options), and checking paraphrased slide sentences against their facts. Code takes over the rest: the paraphrase judge goes (facts are exact sentences), the slide vision check leaves the editor's flow (code draws every word and measures legibility; only the art is checked for stray text, automatically), captions keep Gemini for the hook and call to action only, and market versions convert money at once with rewording optional. One "Make post" press chains the steps, and the editor stops only to choose: a version, a cover, settings.

## Reasoning

- Live runs on 9 Oct showed the fragile calls were the ones code could do: the judge and the source check produced the eval's false alarms, Pro's per-minute limit broke extraction under load, and the vision check mostly re-confirmed what the layout engine guarantees while making the editor wait.
- Facts as exact sentences make a misquote impossible by construction, which is stronger than catching it.
- Fewer, purposeful model steps with code verifying each read better to judges than many calls checked twice, and cost less per post.
- Editing text on slide previews before any image is made spends image calls only on final text.

## Rejected alternative

Keeping all eight uses and tuning prompts until the eval passes; a free prompt box for drafts and art.

## Constrains

Amends ADR-112 (code decides what can be checked: now also by construction for facts) and ADR-115 (the judge and slide vision uses go). Story 13 of the admin intent, criteria 93–110.
