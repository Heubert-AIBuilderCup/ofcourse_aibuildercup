# Judge access

_For the AI Builder Cup judges, on the live app (https://ofcourse-44805428675.asia-southeast1.run.app). Their emails are unknown in advance, so a shared passcode lets them in: as the admin, or as a fresh student with one story, Priya's._

## How it works

- **The switch.** `JUDGE_PASSCODE` in the environment. Unset or empty, the feature is off: no "Judge access" link shows on either sign-in page, and both actions refuse every call.
- **The passcode.** Compared in constant time (equal-length SHA-256 digests). Every attempt counts against its client address first: 10 per 10 minutes, then even the right passcode is refused ("Too many tries…") until the window ends. A wrong one answers "That passcode isn't right." and nothing else. The count is kept in the server's memory, like the public pages' limit: right for the one Cloud Run instance, per instance beyond.
- **Admin.** `/admin/sign-in` → "Judge access" → the passcode → the shared account `judge-admin@judges.ofcourse.app` ("Judge (admin)"), made on first use. It is a **user with the editor and reviewer capabilities**: Board, Comic gaps, Updates, Ideas and Insights; never Users or Models, never admin or superadmin. The role and capabilities are put back at every judge sign-in, so promoting the account by mistake does not stick. It lands on `/admin/board`. Suspend it in Users to shut the admin way in without a deploy.
- **Students.** `/` → "Judge access" → the passcode, then Priya's card, the one story offered (`OFFERED_JUDGE_STORIES`), with no "Start from the beginning". Each sign-in makes a **new** student, `judge-<10 hex characters>@judges.ofcourse.app`, named "Judge · Priya", so judges never share state. The story gives her picture and her first roadmap, finished (onboarding closed), with the story's answers, person and coins, and lands on `/roadmaps/<id>` in one redirect. The action still takes the other stories and a fresh start (`story=fresh`, on to `/onboarding/welcome`); the dialog no longer offers them.
- **Accounts.** Ordinary rows, made through Better Auth's internal adapter on the student page's rules, which make a user and nothing more, even on an empty database. No migration. The domain `judges.ofcourse.app` marks them (`isJudgeEmail` in `src/features/judge`), for Users and Insights to tell them apart later.
- **Spend.** Gemini is bounded by the existing daily caps (`AI_DAILY_CAP_PRO`, `AI_DAILY_CAP_IMAGE`) and the per-student Ask cap. Each new student brings a fresh Ask allowance, so the daily caps are the real bound.

The stories (`src/features/roads/data/judge-stories.ts`; the test beside it pins each road). Only Priya is offered: each board was checked with production's switches on (`FINDER_ON=1`, `COURSE_DETAIL_ON=1`, `COMPARE_ON=1`) through the board's own code (`roadFor`, the scene, `cardFor`, `primaryAction`, `withStart`, `compareByTile`), and hers is the one where every city and course beside her road starts a new roadmap. `src/features/judge/offered-story.test.ts` pins it.

| Story | From | Road | Beside her road ("Start a new roadmap from it") | "What changes" | Stack | Offered |
| --- | --- | --- | --- | --- | --- | --- |
| Priya | Nepal | Perth · Master of Cyber Security (ECU) · stays, 190 (`perth-cyber`) | 6 of 6 pinned: Adelaide, Curtin IT, Curtin Information Systems and three other cyber master's (UniSA, UTS, UTS) | money and jobs everywhere; work rights (5 years regional → 2 years) and PR (190 → 491) on the UTS courses | 4 courses, all IT or cyber | **Yes** |
| Aarav | India | Sydney · Master of Engineering (civil) (UTS) · stays, 491 or an employer's 186 (`sydney-uts-civil-stay`) | 5 of 6: the other city (Melbourne) teaches no engineering, so it has no Start | rich on the Deakin courses (491 → 190, work rights) | 8, mostly not engineering | No |
| Sita | Nepal | Adelaide · Master of Nursing (graduate entry) (UniSA) · regional city, stays, 190 (`adelaide-unisa-nursing-stay`); her IELTS 6.5 is short of the course's 7.0, so the card shows it not met | 6 of 6 pinned | PR on the public-health courses (190 → 491) | 6, mostly IT | No: over a hard budget and short on English, so her board leads with what she can't do |
| Meera | Sri Lanka | Melbourne · Master of Interaction Design (Swinburne) · goes home (`melbourne-swin-ux-home`) | 2 of 3: the other city (Sydney) has no design course; no other design master's beside the study step | goes home, so no PR to compare | 10, mostly not design | No |
| Rohan | India | Melbourne · Master of Psychology (Cyberpsychology) (Swinburne) · no clear PR (`melbourne-swin-cyberpsych-stay`, the closest road: "Why this road?" shows one chip, "Staying: this road has no clear road to PR (you said you'd stay)") | 2 of 3: Sydney has no psychology course | PR on public health (no clear PR → 491) | 10, mostly not psychology | No |

On every story's board her own course says "Walk to …" when she stands at its city, and no card draws a primary with nothing behind it. The stack list's "More" and its "Put on my board" on rows with no tile do nothing yet, on every board.

## Setting the passcode

Locally: add a line to `.env`, then restart `bun run dev`:

```bash
JUDGE_PASSCODE=pick-a-long-passphrase
```

On Cloud Run, from Git Bash in `C:\Projects\main` (the runtime account `ofcourse-run` already has `roles/secretmanager.secretAccessor`, deploy.md section 3):

```bash
printf '%s' 'pick-a-long-passphrase' | gcloud secrets create ofcourse-judge-passcode --project applyims --data-file=-
gcloud run services update ofcourse --project applyims --region asia-southeast1 \
  --update-secrets JUDGE_PASSCODE=ofcourse-judge-passcode:latest
```

To change it: `printf '%s' 'new-passphrase' | gcloud secrets versions add ofcourse-judge-passcode --project applyims --data-file=-`, then the same `services update` so a new revision reads it. To turn judge access off after judging: `gcloud run services update ofcourse --project applyims --region asia-southeast1 --remove-secrets JUDGE_PASSCODE`.

## For the submission notes

> **Trying OfCourse.** Open https://ofcourse-44805428675.asia-southeast1.run.app.
>
> - **As a student**, sign in with your own Google account, or choose **Judge access** under the sign-in card, enter the passcode **`<passcode>`**, and choose **Priya** (Nepal, cyber security in Perth, PR through 190). She opens on her finished roadmap: press the other city or a course beside hers to see **What changes**, and **Start a new roadmap from it**. Every sign-in is a new account, so you can start again as often as you like.
> - **To see the AI answer from the data**, open a city or course on the roadmap and **type** a question in Ask, e.g. "Can I afford this?" or "How is this different from my course?". Gemini answers only from the catalogue facts the code retrieves for that tile, and the reply lists them under "Answered from these facts". A question the data can't answer gets "I don't have that in our data". (The suggested question chips show pre-written answers, with no model call.)
> - **As the admin**, open https://ofcourse-44805428675.asia-southeast1.run.app/admin/sign-in, choose **Judge access** and enter the same passcode. You sign in as an editor and reviewer: the Board, Comic gaps, Updates, Ideas and Insights.
>
> After ten wrong tries the passcode rests for ten minutes.
