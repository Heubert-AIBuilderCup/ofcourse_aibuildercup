# Publishing OfCourse as a public GitHub repository

_Checklist, 11 Oct 2026, for Nikhil and Jenish. Delivers SR4 of docs/submission-readiness/intent.md. The rules (ADR-128; quotes in research_notes/Reusable implementations for our stack/VERIFY_hackathon_rules.md) require four artifacts by **18 Oct 2026, 23:59 IST**: a public GitHub repository with the source, a working live URL on Cloud Run, a video strictly under three minutes (a public YouTube, Vimeo or Google Drive link) and a deck as a PDF; everything in English. Everything pushed becomes public and sits under the organiser's six-month right of first refusal on an exclusive licence (ADR-128). Commands run in Git Bash._

Today's remote is the private Bitbucket repository `heubert/decision-studio-ofcourse`; it stays the working remote. The public repository is a new one on GitHub, made from a fresh clone of the merged `main`.

**Decided 16 Oct 2026 (Nikhil), where this differs from the plan below:**
- **The remote:** GitHub becomes `origin` and the working remote; Bitbucket stays as a backup remote.
- **What goes up:** `main` (after the release merge of `dev`) and `dev`, with the full history (29 commits, all from 5 Oct 2026). C3's single import commit is not used.
- **The history scan:** the patterns of D2 were run over every commit of `dev`. There are no hits beyond the known false positives: the local `app:app` database URLs, and Secret Manager names in deploy.md.
- **A1:** the art library images, the duck and the splash video are the team's own work (README, "Fonts and images").
- **A2:** a proprietary `LICENSE`, "Copyright 2026 Heubert. All rights reserved."
- **A3:** disclose only: the README's "How it was built" names the starter's scaffolding.

## A. Decisions to settle first (Nikhil; the first one blocks the push)

### A1. The three assets with no recorded source or licence — blocking

The README's "Third-party code" section (d1a7b0c) records that `src/features/content/assets/library/open-book.png`, `src/features/content/assets/library/new-head.png` and `public/brand/quack.mp4` have no recorded source or licence (`public/brand/duck.png` is the team's own design asset; confirm that too). The rules make us warrant that nothing in the submission is under third-party rights we lack permission for, and the indemnity is ours. **The repository does not go public until each file is either confirmed and recorded or replaced:**

- Confirmed: its source and licence are written into the README's "Fonts and image assets" list (the team's own work counts: say so).
- Replaced: a file we made, or one under a permissive licence with the credit in the README, and the code or brand file that references it updated; the old file removed.

### A2. The `LICENSE` file

There is no `LICENSE` today, and `package.json` says `"private": true`. The rules do not require an open-source licence, only a public repository; GitHub shows "no license" and readers assume nothing may be reused. Two options:

1. **Proprietary notice (recommended, consistent with ADR-128).** A `LICENSE` file: "Copyright 2026 Heubert. All rights reserved. The third-party code and assets listed in README.md are under their own licences." This keeps every option open, including the exclusive licence the organiser may ask for under the right of first refusal, which cannot be granted over code already released under an open-source licence.
2. **MIT.** The code becomes reusable by anyone, irrevocably; simplest for readers, and judges do not score it. Choose this only if the team wants OfCourse open-sourced as such.

Either way the README's "Third-party code" section stays as it is (ADR-119 requires it), and `@resvg/resvg-js` (MPL-2.0) and `postgres` (Unlicense) are recorded as the two licences outside ADR-119's list of MIT, Apache-2.0, BSD and ISC: MPL-2.0 is a file-level copyleft that binds only modified MPL files, and we use the library unmodified from npm with its notices intact in `node_modules`; the Unlicense is a public-domain dedication. Add one line to ADR-119's "Constrains" naming both as accepted.

### A3. The fresh-code statement (ADR-127; open, Nikhil decides)

The T&C say "Submissions must consist exclusively of fresh code and original assets created during the official hackathon timeline. Pre-existing products, ongoing projects, or code developed prior to the official launch will be disqualified." The build window opened 7 Sept 2026. Our repository started on 5 Oct 2026 from Heubert's Next.js starter (Google sign-in, roles, a users admin, Drizzle and the design-system scaffolding), written before the window; everything that OfCourse is (the content engine, the agents, the feed, the student opening) was built inside it. The rules are silent on npm libraries, and the research note reads them as plainly tolerated. Two options, both needing a README line (see C3):

1. **Disclose and ask.** The README names what was scaffolding and what was built for the event, and Nikhil asks the organiser in writing (support+aibuildercup@hack2skill.com, or the event Discord) before the deadline, keeping the reply. The only real protection, since the organiser has "final decision when it comes to all matters of dispute" and may disqualify at any stage; it also draws attention to the question.
2. **Disclose only.** The same README line, no question. Rests on the starter being generic scaffolding that scores nothing (the 40/25/25 buckets are GenAI, problem fit and innovation), with every product commit dated inside the window. Cheaper, and the risk stays with us.

Not an option: a README that implies everything was written in the window.

## B. Get `main` ready

1. Merge `feat/submission-readiness` into `dev`, then `dev` into `main`, on Bitbucket, with the usual review; `bun run test:run` and `bun run build` green on `main`.
2. Decide `reports/` (untracked today: four research reports under `reports/`, our own work, no secrets, no Heubert-internal names found on 11 Oct): fine to publish. To include them, commit them to `main` before the clone (`git add reports/ && git commit -m "docs: the research reports behind the stack decisions"`); otherwise they simply never enter the clone. `research_notes/` (the raw notes behind them) stays out.
3. Apply the decisions of A: the asset credits or replacements, the `LICENSE` file, the README line of C3, the ADR-119 line of A2, each as its own commit on `main`.
4. Put the live URL (`https://ofcourse-44805428675.asia-southeast1.run.app`) and, once recorded, the video link at the top of the README, so a judge opening the repository has all four artifacts from one page.

## C. The fresh clone and its history

1. Clone `main` into a new folder outside the working copy. A fresh clone contains only tracked files, so `.env*` (ignored, except `.env.example`), `.heubert/` (ignored), `.claude/` (ignored), `research_notes/` and the probe scripts never come along:

   ```bash
   cd /c/Projects
   git clone --branch main --single-branch https://bitbucket.org/heubert/decision-studio-ofcourse.git ofcourse-public
   cd ofcourse-public
   ```

2. Prove the exclusions on the clone, not on memory:

   ```bash
   git ls-files | grep -E '^\.env|^\.heubert/|^\.claude/|^research_notes/|\.pem$'   # must print nothing
   ls -a | grep -E '^\.env'                                                           # only .env.example
   cat .env.example                                                                   # placeholders only, no real value
   ```

3. History. **Recommended: one import commit.** The working repository's 63 commits all date from 5 Oct 2026 onward (inside the window), so keeping them is defensible, but every one of their diffs and messages would then need the scans of D, and they carry plan and brief text written for the team rather than for readers. One commit means the audit covers the tree, the commit is dated the day of the push (after the window opened), and the README says where the history is. Its message states what it is, pending the ADR-127 wording:

   ```bash
   git checkout --orphan public
   git add -A
   git status --short | grep -E '\.env|\.heubert|research_notes' && echo "STOP: excluded file staged"
   git commit -m "feat: OfCourse, built for the AI Builder Cup 2026 (import of the team's repository on $(date +%Y-%m-%d))"
   git branch -M main
   ```

   The README line that goes with it (B3), under the heading the team prefers, with the ADR-127 wording filled in: "This repository is a single import of the team's working repository (private, 63 commits from 5 Oct 2026). OfCourse was started on 5 Oct 2026 from Heubert's Next.js starter: Google sign-in, roles, a users admin and the Drizzle setup are that scaffolding; everything else was built for the AI Builder Cup."

   **Alternative: keep the history.** Skip the block above; the commit dates (5 Oct onward) show the work in the window on their own. Then D's scans must cover every commit, and any hit means rewriting history before the push, not after.

## D. Secret scan, before the push

1. **gitleaks** if installed (not on the Windows machine today; a release binary from github.com/gitleaks/gitleaks/releases, or `brew install gitleaks`). On 8.19 and later, in `ofcourse-public`:

   ```bash
   gitleaks dir --no-banner .      # the working tree
   gitleaks git --no-banner .      # every commit (only matters if history is kept)
   ```

   (Before 8.19: `gitleaks detect --source . --no-banner`, with `--no-git` for the tree only.)

2. **Otherwise, grep** the tree for the key shapes we could have leaked. Must print nothing except known false positives:

   ```bash
   git grep -n -I -E \
     'AIza[0-9A-Za-z_-]{35}|GOCSPX-[0-9A-Za-z_-]{20,}|[0-9]{10,}-[0-9a-z]{32}\.apps\.googleusercontent\.com|-----BEGIN [A-Z ]*PRIVATE KEY-----|"private_key_id"|postgres(ql)?://[^:/[:space:]]+:[^@[:space:]]+@|ya29\.[0-9A-Za-z_-]{20,}|ghp_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{22,}|sk-[A-Za-z0-9_-]{20,}|(BETTER_AUTH_SECRET|DEV_LOGIN_SECRET|GOOGLE_CLIENT_SECRET|PGPASSWORD|DATABASE_URL)[[:space:]]*[=:][[:space:]]*["'"'"']?[A-Za-z0-9+/=_-]{16,}' \
     -- . ':!bun.lock'
   ```

   If history is kept, the same expression over every commit: `git log -p --all | grep -n -E '<the expression>'`.

3. Known false positives (the expression was run on the tree on 11 Oct): the local development database URL `postgres://app:app@127.0.0.1:5433/app` (docker-compose.yml's credentials, in `.env.example`, the plans and `e2e/README.md`), and a document that shows how a secret is made or copied (deploy.md's `openssl rand … | gcloud secrets create` and `grep '^GOOGLE_CLIENT_SECRET=' .env` lines). Confirm by eye that each hit is the command or the local URL, not a value. A real hit means the value is already compromised: rotate it (the Google OAuth secret in the Cloud console; `BETTER_AUTH_SECRET` and the database password as new secret versions per deploy.md) before anything else, then remove it from the tree.

4. Heubert-internal names. `git grep -n -w -E 'Expert|Edge|CRM' -- README.md` must print nothing (SR1). The decision register (`docs/decisions/`) names the CRM and the portal as the product's context in several ADRs; that is product truth and stays, unless Nikhil wants those ADRs trimmed, which is a decision for him before the push.

5. The clone runs from what is public: `bun install && bun run type-check && bun run test:run` in `ofcourse-public` (no `.env`; the unit suite needs none).

## E. Create the repository and push

1. On GitHub, under the organisation the team chooses: a new repository, **empty** (no README, no `.gitignore`, no licence template, so the first push is ours). Create it **private**, flip it to public after the check in F1; the flip keeps the history as pushed.
2. Push `main` and only `main`:

   ```bash
   git remote remove origin
   git remote add origin git@github.com:<org>/ofcourse.git
   git push -u origin main
   ```

3. On GitHub: the default branch is `main`; About → description (one sentence from the README), Website = the live URL, topics (`google-cloud`, `cloud-run`, `gemini`, `nextjs`); no other branch, no release, no GitHub Pages.

## F. Check, then make it public

1. Read the repository on GitHub as a judge would: the README renders with `docs/architecture.svg` in light and dark, the licence shows the A2 choice, `docs/hackathon/deploy.md` is there, no `.env`, no `.heubert/`, no `research_notes/`. Then Settings → General → Danger Zone → Change visibility → Public.
2. From a private browser window (signed out): the repository opens, `git clone https://github.com/<org>/ofcourse.git` works without credentials, and the raw link to `docs/architecture.svg` loads.
3. Nothing is force-pushed afterwards. Fixes after publication go through Bitbucket `main` and the same clone, as ordinary commits.

## G. The submission

1. The four artifacts, all English: the repository URL; the live URL `https://ofcourse-44805428675.asia-southeast1.run.app` (deployed per deploy.md, smoke-checked signed out); the video, under three minutes, as a public YouTube, Vimeo or Google Drive link; the deck as a PDF (docs/hackathon/pitch.md has the script and the slides).
2. Submit on the Hack2skill dashboard before 18 Oct 2026, 23:59 IST, under Media, Content & Digital Experiences (ADR-128); one entry per team.
3. Keep the live service and the repository unchanged through the evaluation window (19 Oct to 6 Nov).
