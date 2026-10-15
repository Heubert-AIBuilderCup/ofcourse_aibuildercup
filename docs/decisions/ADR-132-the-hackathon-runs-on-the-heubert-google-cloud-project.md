---
id: ADR-132
title: "Gemini runs on the Heubert Google Cloud project (applyims)"
status: proposed
date: 2026-10-09
---
# ADR-132 · Gemini runs on the Heubert Google Cloud project (applyims)

## Decision (proposed; deployment needs Jenish)

Model calls use the project `applyims` ("Heubert Google Cloud", number 44805428675), location `global`: billing is on, Nikhil is an owner, and the Vertex AI, Cloud Run, Cloud Trace and Logging APIs are already enabled. The OfCourse project on Jenish's account (`ofcourse-511106`) has no billing linked.

## Reasoning

A live smoke run on 9 Oct passed all five calls on `applyims`; the other project refused for want of billing. Using a project that already pays keeps the hackathon moving.

## Rejected alternative

Waiting for billing on `ofcourse-511106`; a new billing account on a trial (trial accounts cannot raise quotas).

## Constrains

Amends ADR-098 and ADR-120 (where hosting lives) once Jenish agrees. Spend lands on Heubert's billing: the app's daily caps stay, and a spend-cap budget on Vertex AI is set before the demo. The project allows only a few Pro-preview calls per minute, which is one reason extraction moves to Flash (ADR-129).
