# Decision register

This is the shared decision register for the student model (owner: Nikhil): one file per decision, supersede and never delete, and new decisions continue the numbering from the highest existing id (currently ADR-132).

Problem statement and value: [000-context.md](000-context.md).

## Adding a decision

1. Copy [`TEMPLATE.md`](TEMPLATE.md) to `ADR-NNN-<slug>.md`, where NNN is the next number after the highest id below (three digits) and the slug is the kebab-case title.
2. Set `status: proposed`. A decision that crosses slices or binds the shared project stays proposed until both Nikhil and Jenish have agreed; then change it to `accepted` and set the date. A decision inside one person's own slice is recorded as `accepted` by its owner, and the other may reopen it with a new ADR (ADR-114).
3. Never edit history. To reverse a decision, add a new ADR that supersedes the old one, then mark the old one `superseded` with `superseded_by`.
4. Add the new file to the index table below.

## Index

| ID | Title | Status | Date |
| --- | --- | --- | --- |
| [ADR-001](ADR-001-the-students-root-is-their-current-reality-a-fixed-node.md) | The student's root is their current reality — a fixed node, never a choice | accepted | 2026-09-29 |
| [ADR-002](ADR-002-the-five-paths-are-lenses-not-forks-a-student-can-be-on.md) | The five "paths" are lenses, not forks — a student can be on several at once | accepted | 2026-09-29 |
| [ADR-003](ADR-003-preferences-drive-the-questions-and-pre-populate-the-profile.md) | Preferences drive the questions and pre-populate the profile | accepted | 2026-09-29 |
| [ADR-004](ADR-004-switching-views-keeps-the-shared-answers.md) | Switching views keeps the shared answers | accepted | 2026-09-29 |
| [ADR-005](ADR-005-the-product-visualises-multiple-realities-and-their-trade.md) | The product visualises multiple realities and their trade-offs — comparison is the core | accepted | 2026-09-29 |
| [ADR-006](ADR-006-country-pathways-are-the-alternate-realities-lenses-shape.md) | Country pathways are the alternate realities; lenses shape how each is evaluated | accepted | 2026-09-29 |
| [ADR-007](ADR-007-every-generated-image-or-video-is-approved-as-a-structure.md) | Every generated image or video is approved as a structure before it is rendered | accepted | 2026-09-30 |
| [ADR-008](ADR-008-the-image-model-draws-the-artwork-code-draws-the-words-and.md) | The image model draws the artwork; code draws the words and numbers | proposed | 2026-09-30 |
| [ADR-009](ADR-009-the-board-shows-only-choices-that-change-where-the-student.md) | The board shows only choices that change where the student can go; everything else is a preference | accepted | 2026-09-30 |
| [ADR-010](ADR-010-a-preference-is-switched-on-three-ways-an-inferred-one-is-a.md) | A preference is switched on three ways; an inferred one is a suggestion until confirmed | accepted | 2026-09-30 |
| [ADR-011](ADR-011-the-board-shows-one-route-at-a-time-a-separate-compare-view.md) | The board shows one route at a time; a separate Compare view puts 2 to 4 saved routes side by side | accepted | 2026-09-30 |
| [ADR-012](ADR-012-bands-up-front-numbers-on-demand-with-a-source-probabilities.md) | Bands up front; numbers on demand with a source; probabilities never shown to students; staff see everything | accepted | 2026-09-30 |
| [ADR-013](ADR-013-answers-weights-and-plans-live-on-the-portal-the-crm.md) | Answers, weights and plans live on the portal; the CRM receives them only when the student submits an enquiry | accepted | 2026-09-30 |
| [ADR-014](ADR-014-answers-are-editable-live-sealed-courses-can-be-walked-and.md) | Answers are editable live, sealed courses can be walked, and the student sees why | accepted | 2026-09-30 |
| [ADR-015](ADR-015-one-admin-app-two-content-streams-common-cases-pre-generated.md) | One admin app, two content streams; common cases pre-generated, uncommon ones surfaced by frequency | accepted | 2026-09-30 |
| [ADR-016](ADR-016-a-mixed-feed-mostly-general-posts-with-personal-nudges.md) | A mixed feed: mostly general posts, with personal nudges placed by stage and preferences and always labelled | accepted | 2026-09-30 |
| [ADR-017](ADR-017-book-content-policy-own-words-summaries-credited-short-and.md) | Book content policy: own-words summaries, credited, short and rare quotes, human-checked | accepted | 2026-09-30 |
| [ADR-018](ADR-018-tiered-review-before-publishing.md) | Tiered review before publishing | accepted | 2026-09-30 |
| [ADR-019](ADR-019-shared-renders-with-persona-variants-full-personalisation.md) | Shared renders with persona variants; full personalisation only with consent | accepted | 2026-09-30 |
| [ADR-020](ADR-020-four-admin-roles.md) | Four admin roles | accepted | 2026-09-30 |
| [ADR-021](ADR-021-insights-consent-via-terms-of-use-no-minimum-group-size.md) | Insights: consent via terms of use; no minimum group size internally | accepted | 2026-09-30 |
| [ADR-022](ADR-022-data-ownership-and-freshness.md) | Data ownership and freshness | accepted | 2026-09-30 |
| [ADR-023](ADR-023-pathways-are-a-guide-for-questioning-not-the-rulebook-the.md) | Pathways are a guide for questioning, not the rulebook; the next question comes from the whole picture | accepted | 2026-09-30 |
| [ADR-024](ADR-024-three-sources-of-knowledge.md) | Three sources of knowledge | accepted | 2026-09-30 |
| [ADR-025](ADR-025-six-scoring-dimensions-plus-family-when-the-student-has.md) | Six scoring dimensions, plus Family when the student has dependants | accepted | 2026-09-30 |
| [ADR-026](ADR-026-board-route-explores-journey-is-the-promoted-route-lived.md) | Board route explores; Journey is the promoted route lived against | superseded | 2026-09-30 |
| [ADR-027](ADR-027-an-account-is-required-before-the-decision-studio.md) | An account is required before the Decision Studio | accepted | 2026-09-30 |
| [ADR-028](ADR-028-submission-sends-the-promoted-plan-the-profile-and-the.md) | Submission sends the promoted plan, the profile and the answers to the CRM | accepted | 2026-09-30 |
| [ADR-029](ADR-029-persona-variant-chosen-by-an-optional-sign-up-question.md) | Persona variant chosen by an optional sign-up question | accepted | 2026-09-30 |
| [ADR-030](ADR-030-weights-are-visible-on-the-board-and-adjustable-in-both.md) | Weights are visible on the board and adjustable in both places | accepted | 2026-09-30 |
| [ADR-031](ADR-031-fully-separate-brand-guidelines-per-instagram-page.md) | Fully separate brand guidelines per Instagram page | accepted | 2026-09-30 |
| [ADR-032](ADR-032-light-editing-in-the-admin-app-heavy-editing-by-svg-export.md) | Light editing in the admin app; heavy editing by SVG export | accepted | 2026-09-30 |
| [ADR-033](ADR-033-the-admin-app-produces-assets-posting-stays-in-existing.md) | The admin app produces assets; posting stays in existing tools | accepted | 2026-09-30 |
| [ADR-034](ADR-034-two-to-three-variations-at-the-structure-stage-one-is.md) | Two to three variations at the structure stage; one is rendered | accepted | 2026-09-30 |
| [ADR-035](ADR-035-research-and-psychology-posts-ai-source-check-then-human.md) | Research and psychology posts: AI source check, then human sign-off | accepted | 2026-09-30 |
| [ADR-036](ADR-036-route-comics-a-library-of-slotted-trade-off-types-matched-by.md) | Route comics: a library of slotted trade-off types, matched by rules then AI, with a text fallback | accepted | 2026-09-30 |
| [ADR-037](ADR-037-decision-studio-and-the-admin-app-are-the-ai-builder-cup.md) | Decision Studio and the admin app are the AI Builder Cup entry | accepted | 2026-09-30 |
| [ADR-038](ADR-038-journey-folds-into-the-studio-as-a-route-detail-view.md) | Journey folds into the Studio as a route detail view; students rank several routes and submit the ranked list | accepted | 2026-09-30 |
| [ADR-039](ADR-039-targeted-updates-changes-and-opportunities-are-published-to.md) | Targeted updates: changes and opportunities are published to the students they concern | accepted | 2026-09-30 |
| [ADR-040](ADR-040-mobile-friendly-from-the-start-a-staged-view-one-node-at-a.md) | Mobile-friendly from the start: a staged view, one node at a time, with the overall board a tap away | accepted | 2026-09-30 |
| [ADR-041](ADR-041-quality-bar-nine-improvements-adopted-from-the-delight-cost.md) | Quality bar: nine improvements adopted from the delight / cost / value review | accepted | 2026-09-30 |
| [ADR-042](ADR-042-the-admin-app-suggests-content-to-research.md) | The admin app suggests content to research | accepted | 2026-09-30 |
| [ADR-043](ADR-043-design-direction-walk-1c-the-duck-leads.md) | Design direction: Walk (1c) — the duck leads | accepted | 2026-09-30 |
| [ADR-044](ADR-044-the-check-in-loop-keep-students-updated-exploring-and.md) | The check-in loop: keep students updated, exploring and learning — without streaks | accepted | 2026-09-30 |
| [ADR-045](ADR-045-design-principle-it-should-feel-like-a-game-seamless-not.md) | Design principle: it should feel like a game — seamless, not gamified | accepted | 2026-09-30 |
| [ADR-046](ADR-046-design-must-survive-a-state-catalogue-and-five-stress-test.md) | Design must survive a state catalogue and five stress-test students | accepted | 2026-09-30 |
| [ADR-047](ADR-047-fog-of-war-and-folding-how-the-board-stays-readable-when-the.md) | Fog of war and folding: how the board stays readable when the real world has too many options | accepted | 2026-09-30 |
| [ADR-048](ADR-048-interaction-grammar-four-kinds-of-object-one-look-and-one.md) | Interaction grammar: four kinds of object, one look and one verb each | accepted | 2026-09-30 |
| [ADR-049](ADR-049-game-mechanics-adopted-one-per-source.md) | Game mechanics adopted, one per source | accepted | 2026-09-30 |
| [ADR-050](ADR-050-the-companion-heubert-stays-with-the-student-through-the.md) | The companion: Heubert stays with the student through the study years, as a micro-learning and opportunity platform | future enhancement | 2026-09-30 |
| [ADR-051](ADR-051-declutter-one-open-level-three-choices-and-one-stack-layers.md) | Declutter: one open level, three choices and one stack, layers off by default | accepted | 2026-09-30 |
| [ADR-052](ADR-052-breadth-lives-in-a-discovery-deck-not-on-the-board-niche-and.md) | Breadth lives in a discovery deck, not on the board; niche and emerging courses arrive as wildcards | accepted | 2026-09-30 |
| [ADR-053](ADR-053-universities-can-promote-courses-visibility-only-never.md) | Universities can promote courses — visibility only, never ranking | accepted | 2026-09-30 |
| [ADR-054](ADR-054-defaults-decided-on-delegation.md) | Defaults decided on delegation | accepted | 2026-09-30 |
| [ADR-055](ADR-055-feed-first-the-admin-app-makes-portal-feed-posts-instagram.md) | Feed first: the admin app makes portal feed posts; Instagram and LinkedIn versions are derived from them | accepted | 2026-10-01 |
| [ADR-056](ADR-056-siblings-sit-side-by-side-on-the-same-line-the-chosen-tile.md) | Siblings sit side by side on the same line: the chosen tile, one alternative, one stack | accepted | 2026-10-01 |
| [ADR-057](ADR-057-hackathon-scope-freeze-one-last-design-build-then-build-and.md) | Hackathon scope freeze: one last design build, then build and test | accepted | 2026-10-01 |
| [ADR-058](ADR-058-the-counsellor-is-proactive-three-generated-futures-first.md) | The counsellor is proactive: three generated futures first, questions only when they change the picture, options kept open, a watcher on the student's behalf | accepted | 2026-10-01 |
| [ADR-059](ADR-059-feed-relevance-for-retention-and-what-the-admin-app-shows.md) | Feed relevance for retention, and what the admin app shows | accepted | 2026-10-01 |
| [ADR-060](ADR-060-values-first-a-few-simple-value-questions-good-and-bad.md) | Values first: a few simple value questions, good-and-bad instead of ranking, and what flexibility buys | accepted | 2026-10-01 |
| [ADR-061](ADR-061-demand-becomes-business-and-event-ideas-with-targeted.md) | Demand becomes business and event ideas, with targeted audiences | accepted | 2026-10-01 |
| [ADR-062](ADR-062-a-counsellor-that-remembers-checks-in-encourages-and-pushes.md) | A counsellor that remembers, checks in, encourages, and pushes when needed | future enhancement | 2026-10-01 |
| [ADR-063](ADR-063-content-adapts-to-nationality-and-cultural-context.md) | Content adapts to nationality and cultural context | accepted | 2026-10-01 |
| [ADR-064](ADR-064-two-briefs-at-submission-one-for-the-counsellor-one-for-the.md) | Two briefs at submission: one for the counsellor, one for the parents | accepted | 2026-10-01 |
| [ADR-065](ADR-065-ordering-not-verdicts-the-students-ranking-is-not-capped.md) | Ordering, not verdicts; the student's ranking is not capped | accepted | 2026-10-01 |
| [ADR-066](ADR-066-routes-continue-past-the-course-jobs-income-during-study.md) | Routes continue past the course: jobs, income during study, money basics | accepted | 2026-10-01 |
| [ADR-067](ADR-067-every-node-is-a-bundle-across-all-dimensions-and-the.md) | Every node is a bundle across all dimensions, and the interactions between attributes are stored as effects | accepted | 2026-10-01 |
| [ADR-068](ADR-068-life-values-and-the-character-sheet-what-each-option-would.md) | Life values and the character sheet: what each option would improve or cost in the student's life | accepted | 2026-10-01 |
| [ADR-069](ADR-069-profile-builders-what-we-may-learn-about-a-student-and-what.md) | Profile builders: what we may learn about a student, and what each is allowed to influence | accepted | 2026-10-01 |
| [ADR-070](ADR-070-personal-goals-suggested-from-context-plus-free-text-nudges.md) | Personal goals: suggested from context, plus free text; nudges, posts, events and services orbit them | accepted | 2026-10-01 |
| [ADR-071](ADR-071-what-people-like-you-did-outcomes-of-similar-students-as.md) | "What people like you did": outcomes of similar students, as evidence | accepted | 2026-10-01 |
| [ADR-072](ADR-072-values-are-set-by-spending-ten-coins-not-by-picking-two.md) | Values are set by spending ten coins, not by picking two | superseded | 2026-10-01 |
| [ADR-073](ADR-073-a-new-value-closeness-to-a-community-of-similar-culture-or.md) | A new value: closeness to a community of similar culture, or to relatives | accepted | 2026-10-01 |
| [ADR-074](ADR-074-matching-courses-to-interests-a-field-graph-for-related.md) | Matching courses to interests: a field graph for related topics, embeddings for synonyms, explanations for everything | accepted | 2026-10-01 |
| [ADR-075](ADR-075-loading-state-the-duck-floats-down-a-river-left-to-right.md) | Loading state: the duck floats down a river, left to right, with a rotating line | accepted | 2026-10-01 |
| [ADR-076](ADR-076-tasters-defined-and-the-holistic-profile-screen.md) | Tasters defined, and the holistic profile screen | accepted | 2026-10-01 |
| [ADR-077](ADR-077-use-as-little-ai-as-possible-answer-once-and-serve-many.md) | Use as little AI as possible: answer once and serve many, generate shared not personal, measure the cost | accepted | 2026-10-01 |
| [ADR-078](ADR-078-route-dimensions-are-facts-or-preferences-with-their-impact.md) | Route dimensions are facts or preferences with their impact shown; coins are for life values only | accepted | 2026-10-01 |
| [ADR-079](ADR-079-every-claim-shows-how-strong-how-we-know-and-how-sure-weak.md) | Every claim shows how strong, how we know and how sure; weak claims become research questions | accepted | 2026-10-01 |
| [ADR-080](ADR-080-posts-paired-with-spectrum-questions-content-that-teaches-a.md) | Posts paired with spectrum questions: content that teaches a concept and learns a trait | accepted | 2026-10-01 |
| [ADR-081](ADR-081-word-of-the-day-in-the-app-and-on-social.md) | Word of the day, in the app and on social | accepted | 2026-10-02 |
| [ADR-082](ADR-082-the-market-individually-minorities-collectively-a-large.md) | The market: individually minorities, collectively a large underserved group; the course decision is the wedge, the whole new life is the territory | accepted | 2026-10-02 |
| [ADR-083](ADR-083-admin-design-frozen-four-findings-carried-into-the-build.md) | Admin design frozen; four findings carried into the build | accepted | 2026-10-02 |
| [ADR-084](ADR-084-tell-me-in-your-own-words-everywhere-in-the-opening-and-the.md) | "Tell me in your own words" everywhere in the opening and the board; free text parsed into the profile | accepted | 2026-10-02 |
| [ADR-085](ADR-085-every-recommended-course-is-actionable-fields-near-your.md) | Every recommended course is actionable; "Fields near your interests" puts the centre on top | accepted | 2026-10-02 |
| [ADR-086](ADR-086-relatives-and-friends-nearby-are-asked-for-by-place.md) | Relatives and friends nearby are asked for by place; locations drive "near" recommendations | accepted | 2026-10-02 |
| [ADR-087](ADR-087-course-matching-uses-rag-over-the-product-database-rules.md) | Course matching uses RAG over the product database; rules order, the model explains with citations | accepted | 2026-10-02 |
| [ADR-088](ADR-088-parsing-a-router-specialist-parsers-and-tags-behind-a-tell.md) | Parsing: a router, specialist parsers and tags behind a "tell me in your own words" composer | accepted | 2026-10-02 |
| [ADR-089](ADR-089-trade-offs-show-how-they-might-feel-are-coloured-by-effect.md) | Trade-offs show how they might feel, are coloured by effect, and come with ways to offset the downsides | accepted | 2026-10-02 |
| [ADR-090](ADR-090-dependants-are-asked-about-properly-parallel-lanes-are.md) | Dependants are asked about properly; parallel lanes are grouped by facet | accepted | 2026-10-02 |
| [ADR-091](ADR-091-the-admin-app-monitors-parsing-and-generation-cases.md) | The admin app monitors parsing and generation cases | accepted | 2026-10-02 |
| [ADR-092](ADR-092-gemini-structured-output-for-every-text-call-one-answer.md) | Gemini structured output for every text call; one answer contract for every RAG output | accepted | 2026-10-02 |
| [ADR-093](ADR-093-for-the-hackathon-the-decision-studio-and-the-admin-app-are.md) | For the hackathon, the Decision Studio and the admin app are standalone products | accepted | 2026-10-02 |
| [ADR-094](ADR-094-each-app-gets-a-build-spec-and-flow-boards-in-the-house.md) | Each app gets a build spec and flow boards in the house format; old designs are archived | accepted | 2026-10-02 |
| [ADR-095](ADR-095-the-product-is-called-ofcourse.md) | The product is called OfCourse | accepted | 2026-10-02 |
| [ADR-096](ADR-096-ai-refinement-before-coding-a-shared-ai-core-extract-then.md) | AI refinement before coding: a shared AI core, extract-then-normalise, research recipes, an anti-slop guard, and consistent characters | accepted | 2026-10-02 |
| [ADR-097](ADR-097-pack-consistency-one-case-1-post-one-catalogue-one-rent.md) | Pack consistency: one case-1 post, one catalogue, one rent figure, a firm cut line, tiers reconciled, and answers to the blocking questions | accepted | 2026-10-02 |
| [ADR-098](ADR-098-remaining-hackathon-choices-agreed.md) | Remaining hackathon choices agreed | accepted | 2026-10-02 |
| [ADR-099](ADR-099-the-ai-detailed-specification-is-the-build-contract-for-g1.md) | The AI detailed specification is the build contract for G1–G10 | accepted | 2026-10-02 |
| [ADR-100](ADR-100-asks-before-it-answers-the-contrast-with-general-chatbots-is.md) | "Asks before it answers": the contrast with general chatbots is part of the problem statement and the video | accepted | 2026-10-02 |
| [ADR-101](ADR-101-agents-the-research-agent-is-the-headline-a-content-agent.md) | Agents: the research agent is the headline; a content agent and a watcher agent are stretch goals | accepted | 2026-10-02 |
| [ADR-102](ADR-102-decision-tools-what-ofcourse-already-uses-and-what-comes.md) | Decision tools: what OfCourse already uses, and what comes later | future enhancement | 2026-10-03 |
| [ADR-103](ADR-103-jobs-internships-in-find-including-starting-from-a-job.md) | Jobs & internships in Find, including starting from a job | future enhancement | 2026-10-03 |
| [ADR-104](ADR-104-role-worlds-step-into-a-job-role-adapted-from-conceptual.md) | Role Worlds: step into a job role, adapted from Conceptual PlayWorld for ages 15 and up | future enhancement | 2026-10-03 |
| [ADR-105](ADR-105-sign-in-and-storage-the-repos-better-auth-and-postgres-with.md) | Sign-in and storage: the repo's Better Auth and Postgres, with a student page and an admin page | accepted | 2026-10-05 |
| [ADR-106](ADR-106-the-engine-is-jenishs-might-feel-uses-sign-weight-plus-a.md) | The engine is Jenish's; "might feel" uses sign × weight plus a cost size rule | accepted | 2026-10-05 |
| [ADR-107](ADR-107-student-opening-scope-no-uk-swap-no-seeded-priya-yet.md) | Student opening scope: no UK swap, no seeded Priya yet | accepted | 2026-10-05 |
| [ADR-108](ADR-108-admin-roles-editor-and-reviewer-on-any-staff-account-one.md) | Admin roles: editor and reviewer on any staff account; one person may hold both | accepted | 2026-10-05 |
| [ADR-109](ADR-109-feed-posts-every-post-is-reviewed-and-the-reviewers-approval.md) | Feed posts: every post is reviewed, and the reviewer's approval publishes it with its variants | accepted | 2026-10-05 |
| [ADR-110](ADR-110-templates-and-brands-are-data-files-in-the-repo-the-editor.md) | Templates and brands are data files in the repo; the editor picks which templates to draft | accepted | 2026-10-05 |
| [ADR-111](ADR-111-what-was-approved-is-what-is-published-immutable-records-and.md) | What was approved is what is published: immutable records and one layout engine | accepted | 2026-10-05 |
| [ADR-112](ADR-112-gemini-and-imagen-in-the-admin-code-decides-what-can-be.md) | Gemini and Imagen in the admin: code decides what can be checked, the model proposes | accepted | 2026-10-05 |
| [ADR-113](ADR-113-the-admins-first-slice-follows-adr-105-to-adr-112-the-ai.md) | The admin's first slice follows ADR-105 to ADR-112; the AI detailed specification's extra items come in later slices | accepted | 2026-10-05 |
| [ADR-114](ADR-114-the-decision-register-lives-in-the-repo.md) | The decision register lives in the repo, one file per decision | accepted | 2026-10-07 |
| [ADR-115](ADR-115-current-gemini-models-on-the-global-endpoint.md) | Current Gemini models on the global endpoint; Nano Banana 2.1 replaces Imagen | accepted | 2026-10-07 |
| [ADR-116](ADR-116-request-routing-is-a-google-native-cascade-in-our-code.md) | Request routing is a Google-native cascade in our own code | accepted | 2026-10-07 |
| [ADR-117](ADR-117-retrieval-stays-in-postgres-courses-imported-from-mongo.md) | Retrieval stays in Postgres with pgvector; the course catalogue is imported from Mongo | accepted | 2026-10-07 |
| [ADR-118](ADR-118-the-research-agent-runs-on-adk-typescript-as-its-own.md) | The research agent runs on ADK TypeScript as its own Cloud Run service; grounding is never the evidence | accepted | 2026-10-07 |
| [ADR-119](ADR-119-reuse-libraries-and-ported-ideas-never-copied-apps.md) | Reuse libraries and ported ideas, never copied apps; permissive licences only | accepted | 2026-10-07 |
| [ADR-120](ADR-120-hosting-one-cloud-run-service-one-cloud-sql-instance.md) | Hosting: one Cloud Run service, one Cloud SQL instance, Gemini on global | proposed | 2026-10-07 |
| [ADR-121](ADR-121-the-student-feed-joins-the-admin-slice.md) | The student feed joins the admin slice: /feed for every signed-in account, every live post shown | accepted | 2026-10-07 |
| [ADR-122](ADR-122-tags-in-four-groups-from-a-repo-file-chips-and-search.md) | Tags in four groups from a repo file; feed chips, search and profile pre-selection | accepted | 2026-10-07 |
| [ADR-123](ADR-123-markets-as-a-file-one-version-per-post-a-mock-rate-matrix.md) | Markets as a file, one market version per post, a mock rate matrix for four source currencies | accepted | 2026-10-07 |
| [ADR-124](ADR-124-instagram-pages-as-brand-data-a-post-publish-link-record.md) | Instagram pages as brand data, a theme-to-page rule, and a post-publish link record | accepted | 2026-10-07 |
| [ADR-125](ADR-125-related-posts-from-explicit-edges-not-embeddings.md) | Related posts come from explicit, labelled edges; embeddings and a map view wait | accepted | 2026-10-07 |
| [ADR-126](ADR-126-the-student-profile-contract-between-the-two-slices.md) | The student profile contract between the two slices: homeMarket, destinations, ageBand | proposed | 2026-10-07 |
| [ADR-127](ADR-127-dates-user-test-12-oct-submission-18-oct-roster-11-oct.md) | Dates: user test 12 Oct, roster lock 11 Oct, submission 18 Oct, eligibility checked for every member | accepted | 2026-10-07 |
| [ADR-128](ADR-128-submission-theme-public-github-repo-cloud-run-deployment.md) | Submission: the Media, Content & Digital Experiences theme, a public GitHub repo, a Cloud Run deployment | proposed | 2026-10-07 |
| [ADR-129](ADR-129-no-prompts-for-the-editor-gemini-where-only-a-model-can.md) | No prompts for the editor; Gemini only where only a model can do the job | accepted | 2026-10-09 |
| [ADR-130](ADR-130-a-design-language-per-page-from-reference-images.md) | A design language per Instagram page, generated once from reference images | accepted | 2026-10-09 |
| [ADR-131](ADR-131-a-findable-public-page-per-post-and-a-standard-search-line.md) | A public, indexable page per live post, and a standard last-slide search line | accepted | 2026-10-09 |
| [ADR-132](ADR-132-the-hackathon-runs-on-the-heubert-google-cloud-project.md) | Gemini runs on the Heubert Google Cloud project (applyims) | proposed | 2026-10-09 |
