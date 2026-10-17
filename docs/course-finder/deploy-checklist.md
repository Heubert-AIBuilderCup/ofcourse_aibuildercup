# Deploying the course finder: the morning checklist

_For Nikhil, who runs every step. Git Bash in `C:\Projects\main`, `gcloud` signed in. The runbook behind each step is docs/hackathon/deploy.md (§5 the service, §6 migrations, §6b the finder seed). The stack ships with its three switches off (`FINDER_ON`, `COURSE_DETAIL_ON`, `COMPARE_ON`), so the site looks unchanged until step 6._

## 1. Before deploying

The pull requests target GitHub `main`; each branch is synced onto `origin/main` (`9317bda`). Merge them in this order, each through its PR, so each one's diff is its own once the one before it is in:

1. `feat/update-topics`
2. `feat/course-finder` (PR 1, the finder)
3. `feat/course-detail` (PR 2, course detail)
4. `feat/course-compare` (PR 3, what changes)

Then confirm the tree is clean on a pushed commit. `gcloud run deploy --source .` uploads the working directory, uncommitted changes included:

```bash
git checkout main && git pull
git status            # must say: nothing to commit, working tree clean
git log -1 --oneline  # the commit you are about to deploy
```

## 2. Deploy the service, finder off

First note the revision now serving. Step 7 rolls back to it:

```bash
gcloud run services describe ofcourse --project applyims --region asia-southeast1 \
  --format='value(status.traffic[0].revisionName)'
```

Then deploy. The service already exists, so a redeploy keeps its service account, Cloud SQL connection, secrets, environment variables and scaling. Only the code and the label change, and `FINDER_ON`, `COURSE_DETAIL_ON` and `COMPARE_ON` stay unset. §5's full command is for a first deploy only.

```bash
gcloud run deploy ofcourse --project applyims --region asia-southeast1 --source . \
  --labels commit=$(git rev-parse --short HEAD)
```

## 3. Migrations

Point `ofcourse-migrate` at the image step 2 built, then run it. This adds the `vector` extension and the `course_doc` table. Check the §6 note on `0010_student_profile_onboarded_at` first.

The job already exists, so `update` changes only its image and keeps its connection, secrets and command:

```bash
gcloud run jobs update ofcourse-migrate --project applyims --region asia-southeast1 \
  --image "$(gcloud run services describe ofcourse --project applyims --region asia-southeast1 --format='value(spec.template.spec.containers[0].image)')"
gcloud run jobs execute ofcourse-migrate --project applyims --region asia-southeast1 --wait
```

## 4. Seed the finder

Run this only after step 3's migrations have finished: the seed writes into `course_doc`, which they create. Deploy and run the §6b job from the same image. It is a new job, so it needs the database secrets once. Set `JOB_SECRETS` to the exact `--set-secrets` value of the migrations job in `docs/hackathon/deploy.md` §6 (the database URL and the database password, both `:latest`):

```bash
JOB_SECRETS='<the --set-secrets value from deploy.md §6>'
gcloud run jobs deploy ofcourse-finder-seed --project applyims --region asia-southeast1 \
  --image "$(gcloud run services describe ofcourse --project applyims --region asia-southeast1 --format='value(spec.template.spec.containers[0].image)')" \
  --service-account ofcourse-run@applyims.iam.gserviceaccount.com \
  --set-cloudsql-instances applyims:asia-southeast1:ofcourse-db \
  --set-secrets "$JOB_SECRETS" \
  --set-env-vars PGHOST=/cloudsql/applyims:asia-southeast1:ofcourse-db,PGUSER=ofcourse,GOOGLE_CLOUD_PROJECT=applyims,GOOGLE_CLOUD_LOCATION=global \
  --command bun --args dist/finder-seed.js
gcloud run jobs execute ofcourse-finder-seed --project applyims --region asia-southeast1 --wait
```

Expect `embedded N of N · removed 0` in the job's log; with today's catalogue that is `embedded 479 of 479`. To read the log:

```bash
gcloud logging read 'resource.type="cloud_run_job" AND resource.labels.job_name="ofcourse-finder-seed"' \
  --project applyims --limit 20 --format='value(textPayload)'
```

Running the job a second time must print `embedded 0 of N`.

## 5. Smoke test, finder off

- The site is unchanged: `/`, student sign-in, a roadmap board, `/admin/sign-in`.
- `/admin/updates` shows the topics.

## 6. Switch the finder, the course detail and what changes on

```bash
gcloud run services update ofcourse --project applyims --region asia-southeast1 --update-env-vars FINDER_ON=1
```

This makes a new revision and needs no rebuild. On a finished roadmap's board, run the three demo searches and time each one. Each must show results within 2 seconds on a warm instance (criterion 7):

- Q1 "I like understanding why people do things, and I'm good with computers": Cyberpsychology is in the top three.
- Q2 "I'm good at numbers and I like working out the chances of bad things happening and what they would cost": an Actuarial Studies course is in the top three.
- Q3 "I like drawing and I want to make apps people enjoy using": a Human–Computer Interaction or UX course is in the top three.

Then the course detail (PR 2), a new revision with no rebuild:

```bash
gcloud run services update ofcourse --project applyims --region asia-southeast1 --update-env-vars COURSE_DETAIL_ON=1
```

Every course card, on the board and in Find, shows the fields close to its course, its jobs and the job market marked "sample data".

Then what changes (PR 3), a new revision with no rebuild:

```bash
gcloud run services update ofcourse --project applyims --region asia-southeast1 --update-env-vars COMPARE_ON=1
```

The other-city and other-course tiles, and the courses Find shows, offer "What changes" and "Start a new roadmap from it".

Each switch works with the others off (criterion 41).

## 7. Rollback

Hide one part, each a new revision with no rebuild:

```bash
# the finder
gcloud run services update ofcourse --project applyims --region asia-southeast1 --remove-env-vars FINDER_ON
# the course detail
gcloud run services update ofcourse --project applyims --region asia-southeast1 --remove-env-vars COURSE_DETAIL_ON
# what changes
gcloud run services update ofcourse --project applyims --region asia-southeast1 --remove-env-vars COMPARE_ON
```

Bring back the whole site, using the revision noted in step 2:

```bash
gcloud run services update-traffic ofcourse --project applyims --region asia-southeast1 --to-revisions <previous>=100
```

The database changes only add things (an extension and a table), so the previous revision runs against them unchanged.

## 8. A note on testing before switching on

A tagged revision with no traffic cannot be tested signed in. Google sign-in redirects only to `BETTER_AUTH_URL`, the main URL. So test the finder with the switch on, on the main URL, as in step 6.

## 9. Local database

The branch moves local Postgres to the pgvector image on a new volume (`pg-data-vector`). The old `pg-data` volume stays for branches without the change. On `feat/course-finder`:

```bash
bun run dev          # starts the pgvector container on its new, empty volume and migrates it
bun run db:restore   # in a second terminal: loads the newest snapshot from db-dumps/
GOOGLE_CLOUD_PROJECT=applyims GOOGLE_CLOUD_LOCATION=global bun run finder:seed
```

Tell Jenish to do the same.
