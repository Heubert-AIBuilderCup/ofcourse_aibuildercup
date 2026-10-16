---
id: ADR-013
title: "Answers, weights and plans live on the portal; the CRM receives them only when the student submits an enquiry"
status: accepted
date: 2026-09-30
source: SHARED-decision-record.html (imported 2026-10-07)
---

# ADR-013 · Answers, weights and plans live on the portal; the CRM receives them only when the student submits an enquiry

## Decision

A student's answers, weights and saved plans are stored on their portal record only. They are visible from the admin panel. When the student commits by submitting an enquiry, the relevant data is sent to the CRM enquiry.

## Reasoning

- Exploring is not enquiring; a CRM record for every explorer would flood counsellors with non-leads.
- The student's act of submitting is the consent moment for the CRM; staff can still see explorers in the admin panel.

## Constrains

Resolves Q4 / D4 and the Student storage question in the Implementation Plan. pr\_intent and priorities live on the portal record and travel to the enquiry at submission. The Enquiry→Student mapper runs in both directions at that moment.
