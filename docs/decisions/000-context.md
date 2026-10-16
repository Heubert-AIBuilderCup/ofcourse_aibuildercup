---
title: "Problem statement and value"
source: SHARED-decision-record.html (imported 2026-10-07)
---

# Problem statement and value

## Decision record: the student model

Heubert · Engineering · Edge — canonical spec

The problem we are solving, the decisions we have made about how a student is modelled and guided, and — most importantly — *why*. This is the source of truth; the implementation plan, technical design and playbook point here and must not contradict it.

**Status:** living document. Every decision has an ID, a status, and its reasoning. Supersede, don't delete. &nbsp; **Owner:** Nikhil (PM). &nbsp; **Last decision:** 5 Oct 2026 (ADR-113).

## 0 · Problem statement

Written first, because every decision below is judged against it.

> **The problem**
>
> A student arrives with a vague goal — "study something in Australia, and stay if I can" — and every tool they meet answers the wrong question. Course search answers *"what can I study?"*; the student is asking *"what happens to my life for the next six years?"* Cost, visa odds, work rights, regional weighting, family and timing all move together, and nothing shows them moving together. So the student guesses, or spends their first three counselling sessions being profiled by hand.

**Who this is for.** Immigrants and international students are a minority wherever they land, but as a group they are large and chronically underserved. They face a long chain of decisions in a new culture with the information asymmetry against them: what to study, where to live, what to buy, how to travel, how to bank, how to stay within the rules. The course and visa decision is where this product starts; the new life is where it goes.

Three specific failures the system must fix (from the OfCourse spec):

1. **Comparison is impossible.** Options live on separate pages; changing one priority never shows what it costs everywhere else.
2. **The route is invisible.** Students choose a course, not a path — the stages after enrolment (visa, work rights, PR) stay hidden until they're committed.
3. **Profiling is extractive.** Long forms up front, before trust, collecting data the student never sees returned.

> **A vital example of how it works**
>
> **We act as agents for the student.** They ask a question the easy way, in their own words, and our agents research it for them: the answer is matched to what counsellors have already verified, or researched, sourced and reviewed if it is new, and then **saved for the next student who asks** (the answer library, ADR-077). One post shows the shape of it: *"How much do you love your future self?"*, a short piece on patience and utility in economics: why a longer road to a better outcome feels worse than it is, and how people discount their future. It is paired with a question in the profile that places the student on a **patience spectrum** (would you take a smaller reward now or a larger one later; how far ahead do you plan), so the system learns their habits and patterns, gets more data, and can phrase the "five years to settled" trade-off in a way this student will actually hear.

**Why a general chatbot isn't enough.** A general-purpose chatbot answers immediately, sounds certain, and rarely asks the follow-up questions that would change the answer. When it's wrong, it apologises and tries again, and the person only finds out because they knew enough to push back. That's an irritation when you're troubleshooting a laptop. It's a disaster when the question is a visa, a deadline or a five-year plan, because a student doesn't know enough to notice the mistake, and by the time they do, it has cost them money or an application.

*An illustrative contrast (composite, for the video):*

> **Illustrative contrast**
>
> **Troubleshooting.** "My app won't start." → A general chatbot gives three fixes at once; the first is wrong for this setup; told so, it says "Sorry, you're right" and offers another guess. Nobody asked which version, which device, or what changed.
>
> **A visa question.** "Can I work 40 hours a week while I study?" → A general chatbot says yes or no straight away. The real answer depends on the visa, whether the course has started, whether it's term time or a break, and whether the person asking is the student or a partner.
>
> **OfCourse.** The same question gets two short follow-ups first ("Are you on a student visa, or a partner's?", "During term, or in the break?"), only because the answer changes with them. Then a sourced answer with its date, a line saying which rule it comes from, and "a counsellor can look at your situation" when the case is unusual. When it doesn't know, it says "We're checking this" instead of guessing.

What OfCourse does differently: it asks before it answers, but only the questions that change the answer; every fact carries its source and date; it never predicts a personal outcome; uncertain answers are marked "not sure yet" and researched; and a person reviews what the system learns before anyone else sees it. The model is the same class of model. The difference is the system around it.

**What "solved" looks like:** the student sees *several possible futures side by side*, from where they actually are, with the trade-offs made honest and visual — and hands the counsellor a student who already knows what they're choosing between.

## 0b · The value of this system

What every decision below is in service of.

> **The opener**
>
> Attention is the scarcest resource a student has. Social media was built to take it: every feed is designed to keep you scrolling, and it has taken more of our attention than anything in history. This is the opposite kind of platform. **It gives its attention to you.** It remembers what you said, watches the rules and the deadlines on your behalf, researches the questions you don't know to ask, and asks for your attention only when something matters to your own goals. Your attention is yours to spend; ours is spent on you.

**For students.** They see their possible futures side by side, from where they actually are, with the good and bad of each held up against their own values, and the trade-offs made honest and visual. Niche and emerging fields they would never have searched for reach them with a definition and a why. Nothing pushes; the decision stays theirs, options stay open, and a watcher keeps an eye on deadlines, rule changes and opportunities on their behalf. After enrolment the same system becomes a companion through the study years: what to do this week, what's changed, what to learn next, and what students like them actually went on to do.

**For the questions they don't know to ask.** Most students don't know what to ask: which rule will matter, which deadline decides an option, what a regional campus does to their chances, that a field like cyberpsychology exists. A reactive tool answers only what it's asked. This system has seen thousands of students go before them and asks the questions on their behalf: it proposes futures before being asked, raises the trade-off they didn't see, names the door that's about to close, and surfaces the field they'd never have searched for. Experienced, and with the student's interests rather than a sale in mind.

**For parents.** A plain-language brief at submission: what their child is considering and why, what it costs in their currency and when, what the family needs to provide, the risks, and the questions worth asking. The family decides with the student instead of after.

**For counsellors.** A student who arrives already knowing what they're choosing between, with a ranked list, a confirmed profile, the assumptions behind it and the risks flagged. The first three appointments of profiling disappear; the counsellor starts at the decision. Inside the CRM, an assistant that proposes changes and never makes them without approval.

**For Expert and Heubert.** Better leads (ranked, confirmed, explained), a measurable conversion lift from the briefing, a five-year relationship that makes Expert the natural choice when migration services are needed, outcome data that becomes the moat, a content engine that turns one checked source into every channel in every market, insights that show what students seek before the market does (and turn it into content, events and services), and a promotion channel universities will pay for because it never touches the ranking.

**For universities.** Reach the right students with promotions that are labelled, matched and honest, on a platform students trust precisely because promotion can't buy position.

**For the cost of running it.** Rules decide; the model phrases. Questions are answered once and served many times; content is generated once and shared; nothing is generated per student. The system is designed to call the model less as it learns, which keeps it cheap, keeps it honest, and keeps it from turning into noise.

**How we'll know.** Enquiry submission rate from the Studio; questions to first route; counsellor minutes to shortlist; conversion with a brief vs without; weekly return rate and "this week" completion; posts per editor per week and cost per post; update reach and response; answer-library hit rate and AI calls per student per session.

### Where the Gen AI adds value

**The situation.** Students want to know about the same things, but not all of them know what to ask. A lot is on the line: a wrong move can cost a year, a visa, or a family's savings. And there is a lot of room to learn and grow in. What we provide is **curation, convenience and information**, which research shows this generation values highly: an ICSC survey of 1,008 Gen Z respondents found convenience, speed and efficiency to be their top priorities; 62% of Gen Z say they'd pay more for a personalised experience, more than any prior generation; and recommendations from family and friends sway them far more than influencers do, which is the case for a counsellor-shaped guide over a feed of strangers. The choice-overload research (Iyengar and Lepper, 2000) explains why a small curated set beats a long list.

**The leverage.** A highly qualified prompt engineer working with psychologists and registered visa and migration agents can serve far more students, at a higher and more consistent quality, with the right information reaching the right person. The experts write and review once; the system delivers it to everyone it fits, in their language and context, and keeps it current.

**Start small, grow fast.** For any piece of information we may begin with few points of evidence and few comics. The loop is built to grow rapidly: every claim shown carries its evidence strength; weak claims become research tasks ranked by how many students saw them; every answered question is saved for the next student; every gap in the comics is ranked by frequency. The knowledge base grows exactly where students look.

**Why comics.** People do not always understand the actual impact of a statistic. "Rent about 30% lower" is a number; a panel showing the same student's week in Perth and in Sydney is an experience. Research on risk communication (Gigerenzer) shows the same information is understood far better as natural frequencies and pictures than as percentages. The comics exist so trade-offs are understood, not just read.

## 1 · Decisions

In the order they were made. Each records the decision, the reasoning, what it rejected, and what it constrains.

## 2 · The model, in one picture

```
// ROOT — the student's current reality (ADR-001). One node. Never a choice.
Student(root) { situation, preferences, constraints, confirmed_fields... }
        │
        │  preferences activate lenses (ADR-002/003) — any number at once
        ▼
Active lenses:  [ Career ✓ ]  [ Scholarship ✓ ]  [ Country-Specific: UK ✓ ]  [ Fast-Track ]  [ Exploratory ]
        │         each contributes: questions to ask · trade-offs to surface
        │
        │  the realities to compare (ADR-006) — the student switches, answers persist (ADR-004)
        ▼
Realities:   ┌─ 🇦🇺 Australia route ─┐   ┌─ 🇬🇧 UK route ─┐   ┌─ 🇨🇦 Canada route ─┐
             │ course→visa→work→PR    │   │ ...             │   │ ...                 │
             │ trade-offs (lens-lit)  │   │                 │   │                     │
             └────────────────────────┘   └─────────────────┘   └─────────────────────┘
                        └──────────── compared side by side, visually (ADR-005) ────────────┘
                                                    │
                                              rank the routes (1st, 2nd, 3rd) → route detail view (dates, documents, progress) → submit the ranked list to the CRM
```

## 3 · What this changes in the other documents

> **Corrections owed to earlier docs** (they were written before ADR-001/002 and partly describe the paths as things a student routes through):
>
> - **Implementation plan §5** — already correct in spirit ("filter-then-score, not a bucket"); the phrase "preset priority weightings" for path templates stands, but the sentence describing paths as routing should read: *lenses activate questions and trade-offs; realities are compared.*
> - **Technical design §3.6** ("The decision logic") and **Execution playbook §3.6** — describe "which path a student is on" as a rule-decided branch. **Supersede:** a student is not on a path; lenses are active. The *rules-decide / AI-phrases* split is unchanged and still load-bearing; only the "route to a path" framing is retired.
> - **All docs** — the mind maps are *authoring artefacts* (the source of each lens's questions and outcomes), not the runtime structure.

> **Process rule (Nikhil, 29 Sep):** keep this record updated as decisions are made. When a decision is reversed, add a new ADR that supersedes the old one and mark the old one `superseded` — never edit history. Later we will need the problem statement and the reason for every decision; this file is where they live.

## 4 · Open questions — decisions not yet made

Recorded so they get decided deliberately, not by whoever writes the code first.

| # | Question | Why it matters | Leaning (not decided) |
| --- | --- | --- | --- |
| Q1 | What activates a lens — an explicit preference toggle, an inferred signal from free text, or both? | Inferred activation is smoother but risks activating a lens the student didn't mean (ADR-003's confirm rule applies). | Both, with inferred activation shown as a suggestion the student confirms. |
| Q2 | How many realities are shown at once — all destinations, or the top N by fit? | Too many defeats comparison (ADR-005); too few hides futures (ADR-001's whole point). | 2–4 side by side, with a "show more" that never hides an eligible route. |
| Q3 | How are trade-offs quantified per dimension, and which are `quotable`? | PR likelihood is `internal` in the catalog — reason with it, never quote a probability to a student. | Cost/time quoted with sources; PR shown as a relative band, never a percentage. |
| Q4 | Where do the two fields not in the CRM (`pr_intent`, `priorities`) persist? | Blocks the Student storage decision (implementation-plan audit item #1). | On the Student record, synced to the enquiry on handoff. |
| Q5 [resolved · ADR-014] | Does the student see the counsellor's lens-activation and trade-off reasoning, or only the outcome? | Transparency builds trust (fixes failure #3) but exposes internal reasoning. | Show the "why" for questions and trade-offs; keep internal scoring hidden. |
| Q6 | Should moving to another country or city *after* study (e.g. NZ residency later opening Australia; regional visa then a metro move) be modelled? | It changes Point B, so if it exists it is a route step in years 3–5, not an intake preference. The visa/residency rules it needs are not yet in the catalog. | Parked. Revisit once residency rules are structured; add as a later route step, never a fork at the start. (30 Sep) |
| R1 | **Research task (ADR-079):** the job-market claims used on the future cards — Perth vs Adelaide vs Sydney IT and cyber security job markets ("a smaller IT job market than Perth"), and graduate employment rates for the mock courses (ECU, UniSA, UTS). | These claims are shown to students with no evidence behind them yet; they are the first entries in the evidence-gaps list. | Sources to use: job-posting counts by city and field (Jobs and Skills Australia; major job boards), the national graduate outcomes survey by field and institution, and state occupation lists. Attach source, date and strength band to each fact; mark the claim "not sure yet" until done. (1 Oct) |

---

Decision record v1 — created 29 Sep 2026 from Nikhil's direction on the student model. Canonical; other Edge documents defer to it. Add ADR-114+ as decisions are made; supersede, don't delete.
