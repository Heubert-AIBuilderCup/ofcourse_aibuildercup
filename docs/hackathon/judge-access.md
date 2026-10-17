# Judge access

_For the AI Builder Cup judges, on the live app (https://ofcourse-44805428675.asia-southeast1.run.app). Their emails are unknown in advance, so a shared passcode lets them in: as the admin, or as fresh students with different stories._

## How it works

- **The switch.** `JUDGE_PASSCODE` in the environment. Unset or empty, the feature is off: no "Judge access" link shows on either sign-in page, and both actions refuse every call.
- **The passcode.** Compared in constant time (equal-length SHA-256 digests). Every attempt counts against its client address first: 10 per 10 minutes, then even the right passcode is refused ("Too many tries…") until the window ends. A wrong one answers "That passcode isn't right." and nothing else. The count is kept in the server's memory, like the public pages' limit: right for the one Cloud Run instance, per instance beyond.
- **Admin.** `/admin/sign-in` → "Judge access" → the passcode → the shared account `judge-admin@judges.ofcourse.app` ("Judge (admin)"), made on first use. It is a **user with the editor and reviewer capabilities**: Board, Comic gaps, Updates, Ideas and Insights; never Users or Models, never admin or superadmin. The role and capabilities are put back at every judge sign-in, so promoting the account by mistake does not stick. It lands on `/admin/board`. Suspend it in Users to shut the admin way in without a deploy.
- **Students.** `/` → "Judge access" → the passcode, then a card per story (or "Start from the beginning"). Each choice makes a **new** student, `judge-<10 hex characters>@judges.ofcourse.app`, named "Judge · <name>", so judges never share state. A story gives her picture and her first roadmap, finished (onboarding closed), with the story's answers, person and coins, and lands on `/roadmaps/<id>` in one redirect. "Start from the beginning" lands on `/onboarding/welcome`.
- **Accounts.** Ordinary rows, made through Better Auth's internal adapter on the student page's rules, which make a user and nothing more, even on an empty database. No migration. The domain `judges.ofcourse.app` marks them (`isJudgeEmail` in `src/features/judge`), for Users and Insights to tell them apart later.
- **Spend.** Gemini is bounded by the existing daily caps (`AI_DAILY_CAP_PRO`, `AI_DAILY_CAP_IMAGE`) and the per-student Ask cap. Each new student brings a fresh Ask allowance, so the daily caps are the real bound.

The stories (`src/features/roads/data/judge-stories.ts`; the test beside it pins each road):

| Story | From | Field | Road |
| --- | --- | --- | --- |
| Priya | Nepal | Cyber security | Perth · Master of Cyber Security (ECU) · stays, 190 (`perth-cyber`) |
| Aarav | India | Civil engineering | Sydney · Master of Engineering (civil) (UTS) · stays, 491 or an employer's 186 (`sydney-uts-civil-stay`) |
| Sita | Nepal | Nursing | Adelaide · Master of Nursing (graduate entry) (UniSA) · regional city, stays, 190 (`adelaide-unisa-nursing-stay`); her IELTS 6.5 is short of the course's 7.0, so the card shows it not met |
| Meera | Sri Lanka | Interaction design | Melbourne · Master of Interaction Design (Swinburne) · goes home (`melbourne-swin-ux-home`) |
| Rohan | India | Psychology (Cyberpsychology) | Melbourne · Master of Psychology (Cyberpsychology) (Swinburne) · no clear PR (`melbourne-swin-cyberpsych-stay`, the closest road: "Why this road?" shows one chip, "Staying: this road has no clear road to PR (you said you'd stay)") |

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
> - **As a student**, sign in with your own Google account, or choose **Judge access** under the sign-in card, enter the passcode **`<passcode>`**, and pick a student: Priya (Nepal, cyber security in Perth, PR through 190), Aarav (India, civil engineering in Sydney, 491 or 186), Sita (Nepal, nursing in Adelaide, 190), Meera (Sri Lanka, interaction design in Melbourne, then home) or Rohan (India, cyberpsychology at Swinburne in Melbourne, with no clear PR). Each opens on her finished roadmap. **Start from the beginning** goes through onboarding as a new student. Every choice is a new account, so you can try as many as you like.
> - **As the admin**, open https://ofcourse-44805428675.asia-southeast1.run.app/admin/sign-in, choose **Judge access** and enter the same passcode. You sign in as an editor and reviewer: the Board, Comic gaps, Updates, Ideas and Insights.
>
> After ten wrong tries the passcode rests for ten minutes.
