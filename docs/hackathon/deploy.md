# Deploying OfCourse to Cloud Run (applyims)

_Runbook, 11 Oct 2026. Decisions: ADR-120 (hosting shape), ADR-132 (project `applyims`), approved by Nikhil on 11 Oct for the 12 Oct user test: billable resources yes, students sign in with Google only. Run from `C:\Projects\main` in Git Bash with `gcloud` signed in (`gcloud auth login`); `G=gcloud` in Git Bash may need `gcloud.cmd`._

| Setting | Value |
| --- | --- |
| Project | `applyims` (number 44805428675) |
| Region | `asia-southeast1` (Singapore); Gemini on `global` |
| Service | `ofcourse` → `https://ofcourse-44805428675.asia-southeast1.run.app` |
| Database | Cloud SQL `ofcourse-db`, PostgreSQL 17, Enterprise edition, `db-custom-1-3840`, database `ofcourse`, user `ofcourse` |
| Runtime account | `ofcourse-run@applyims.iam.gserviceaccount.com` |
| Secrets | `ofcourse-database-url`, `ofcourse-db-password`, `ofcourse-better-auth-secret`, `ofcourse-google-client-id`, `ofcourse-google-client-secret` |

## 1. APIs

```bash
gcloud services enable cloudbuild.googleapis.com artifactregistry.googleapis.com \
  sqladmin.googleapis.com secretmanager.googleapis.com \
  cloudtrace.googleapis.com billingbudgets.googleapis.com --project applyims
```

`cloudtrace.googleapis.com` receives the spans (`OTEL_ENABLED=1`, section 5); `billingbudgets.googleapis.com` is needed once, for the budget in section 8.

## 2. Database

```bash
gcloud sql instances create ofcourse-db --project applyims --region asia-southeast1 \
  --database-version POSTGRES_17 --edition ENTERPRISE --tier db-custom-1-3840 \
  --storage-size 10 --storage-type SSD --backup
gcloud sql databases create ofcourse --instance ofcourse-db --project applyims
DB_PASSWORD=$(openssl rand -base64 30 | tr -d '/+=' | cut -c1-32)
gcloud sql users create ofcourse --instance ofcourse-db --project applyims --password "$DB_PASSWORD"
```

The app connects through the Cloud SQL socket that Cloud Run mounts. postgres.js (3.4.9) refuses a URL with an empty host and ignores a `host` query parameter, so the URL names only the database, and the socket, user and password come from the standard variables (tested with the image on 11 Oct, Task 59): `DATABASE_URL=postgres:///ofcourse`, `PGHOST=/cloudsql/applyims:asia-southeast1:ofcourse-db`, `PGUSER=ofcourse`, and `PGPASSWORD` from a secret.

## 3. Runtime account and roles

```bash
gcloud iam service-accounts create ofcourse-run --project applyims --display-name "OfCourse on Cloud Run"
for role in roles/aiplatform.user roles/cloudsql.client roles/secretmanager.secretAccessor roles/logging.logWriter roles/cloudtrace.agent; do
  gcloud projects add-iam-policy-binding applyims \
    --member serviceAccount:ofcourse-run@applyims.iam.gserviceaccount.com --role "$role" --condition None
done
```

## 4. Secrets

The database URL and a fresh production auth secret are created by Claude:

```bash
printf '%s' 'postgres:///ofcourse' | gcloud secrets create ofcourse-database-url --project applyims --data-file=-
printf '%s' "$DB_PASSWORD" | gcloud secrets create ofcourse-db-password --project applyims --data-file=-
openssl rand -base64 48 | tr -d '\n' | gcloud secrets create ofcourse-better-auth-secret --project applyims --data-file=-
```

The Google sign-in pair is copied from `.env` by Nikhil (Claude cannot read `.env`), in Git Bash from `C:\Projects\main`:

```bash
grep '^GOOGLE_CLIENT_ID=' .env | cut -d= -f2- | tr -d '\r\n' | gcloud secrets create ofcourse-google-client-id --project applyims --data-file=-
grep '^GOOGLE_CLIENT_SECRET=' .env | cut -d= -f2- | tr -d '\r\n' | gcloud secrets create ofcourse-google-client-secret --project applyims --data-file=-
```

## 5. Build and deploy

```bash
gcloud run deploy ofcourse --project applyims --region asia-southeast1 --source . \
  --service-account ofcourse-run@applyims.iam.gserviceaccount.com \
  --add-cloudsql-instances applyims:asia-southeast1:ofcourse-db \
  --set-secrets DATABASE_URL=ofcourse-database-url:latest,PGPASSWORD=ofcourse-db-password:latest,BETTER_AUTH_SECRET=ofcourse-better-auth-secret:latest,GOOGLE_CLIENT_ID=ofcourse-google-client-id:latest,GOOGLE_CLIENT_SECRET=ofcourse-google-client-secret:latest \
  --set-env-vars PGHOST=/cloudsql/applyims:asia-southeast1:ofcourse-db,PGUSER=ofcourse,BETTER_AUTH_URL=https://ofcourse-44805428675.asia-southeast1.run.app,AI_PROVIDER=vertex,GOOGLE_CLOUD_PROJECT=applyims,GOOGLE_CLOUD_LOCATION=global,GEMINI_LITE_MODEL=gemini-3.5-flash-lite,GEMINI_FLASH_MODEL=gemini-3.8-flash,GEMINI_PRO_MODEL=gemini-3.1-pro-preview,GEMINI_IMAGE_MODEL=gemini-nano-banana-2.1,AI_DAILY_CAP_PRO=200,AI_DAILY_CAP_IMAGE=60,OTEL_ENABLED=1 \
  --min-instances 1 --max-instances 3 --cpu 1 --memory 1Gi --concurrency 40 --timeout 300 \
  --no-cpu-throttling --cpu-boost --allow-unauthenticated
```

Never set `DEV_LOGIN_SECRET` here. `--no-cpu-throttling` (instance-based billing) keeps the after-response steps (source check, drafts) running after a reply.

- `OTEL_ENABLED=1` turns the tracer on: every Gemini attempt becomes a `gen_ai <use case>` span in Cloud Trace (the exporter authenticates as the runtime account, hence `roles/cloudtrace.agent` in section 3). Unset, nothing loads.
- `GEMINI_LITE_MODEL` is the lite tier (the source check, the art check, captions, market rewording, the design-language description). Unset, the lite tier uses the Flash model.
- `TRUSTED_PROXY_HOPS` is not set: the public pages' rate limit keys on the right-most `X-Forwarded-For` entry, the address Cloud Run's front end appended (default 1). Put a load balancer in front of the service and set `TRUSTED_PROXY_HOPS=2`, so the limiter reads the entry the balancer appended rather than the balancer's own address.

On a service that is already deployed, the two new variables go on without a rebuild:

```bash
gcloud run services update ofcourse --project applyims --region asia-southeast1 \
  --update-env-vars OTEL_ENABLED=1,GEMINI_LITE_MODEL=gemini-3.5-flash-lite
```

## 6. Migrations

Run the migrations as a Cloud Run job from the same image before the first use and after every schema change:

```bash
gcloud run jobs deploy ofcourse-migrate --project applyims --region asia-southeast1 \
  --image "$(gcloud run services describe ofcourse --project applyims --region asia-southeast1 --format='value(spec.template.spec.containers[0].image)')" \
  --service-account ofcourse-run@applyims.iam.gserviceaccount.com \
  --set-cloudsql-instances applyims:asia-southeast1:ofcourse-db \
  --set-secrets DATABASE_URL=ofcourse-database-url:latest,PGPASSWORD=ofcourse-db-password:latest \
  --set-env-vars PGHOST=/cloudsql/applyims:asia-southeast1:ofcourse-db,PGUSER=ofcourse \
  --command bun --args scripts/migrate.ts
gcloud run jobs execute ofcourse-migrate --project applyims --region asia-southeast1 --wait
```

The migrator applies only migrations newer (by the journal's `when`) than the last one the database ran. Since the merge with dev on 15 Oct, the migrations are in date order, and dev's `0010_student_profile_onboarded_at` sits between ours. A database last migrated from the admin branch after 13 Oct 11:29 UTC (at `0011_content_step_progress` or later) skips it, and `0018_roadmaps` then fails. Before the job, check with `select max(created_at) from drizzle.__drizzle_migrations`; if it is 1791890988254 or later, run the one statement by hand first: `ALTER TABLE "student_profile" ADD COLUMN IF NOT EXISTS "onboarded_at" timestamp with time zone;`.

## 7. Google sign-in (Nikhil)

In the Google Cloud console of the project that owns the OAuth client in `.env`: APIs & Services → Credentials → the OAuth client → Authorised redirect URIs → add
`https://ofcourse-44805428675.asia-southeast1.run.app/api/auth/callback/google`, and the origin `https://ofcourse-44805428675.asia-southeast1.run.app`.

## 8. Metrics on the Gemini calls

Every finished Gemini call writes one JSON line to stdout (`event: "ai_call"`, with `use_case`, `tier`, `model`, `prompt_version`, `cached`, `outcome`, `ms`, `input_tokens`, `output_tokens`; never a prompt, an answer or a user id). Cloud Run parses it into `jsonPayload`, so the filter is `jsonPayload.event="ai_call"`. Two log-based metrics read it: a counter by use case and outcome, and a latency distribution. Labels and distributions need `--config-from-file` (the plain `--log-filter` form makes an unlabelled counter only), so each metric is a small YAML file first.

```bash
cat > /tmp/ofcourse_ai_call_count.yaml <<'EOF'
name: ofcourse_ai_call_count
description: Gemini calls by use case and outcome (one log line per finished call)
filter: jsonPayload.event="ai_call"
metricDescriptor:
  metricKind: DELTA
  valueType: INT64
  labels:
    - key: use_case
      valueType: STRING
    - key: outcome
      valueType: STRING
labelExtractors:
  use_case: EXTRACT(jsonPayload.use_case)
  outcome: EXTRACT(jsonPayload.outcome)
EOF
gcloud logging metrics create ofcourse_ai_call_count --project applyims --config-from-file /tmp/ofcourse_ai_call_count.yaml

cat > /tmp/ofcourse_ai_call_ms.yaml <<'EOF'
name: ofcourse_ai_call_ms
description: Gemini call latency in milliseconds, by use case and outcome
filter: jsonPayload.event="ai_call"
valueExtractor: EXTRACT(jsonPayload.ms)
metricDescriptor:
  metricKind: DELTA
  valueType: DISTRIBUTION
  unit: ms
  labels:
    - key: use_case
      valueType: STRING
    - key: outcome
      valueType: STRING
labelExtractors:
  use_case: EXTRACT(jsonPayload.use_case)
  outcome: EXTRACT(jsonPayload.outcome)
bucketOptions:
  exponentialBuckets:
    numFiniteBuckets: 16
    growthFactor: 2
    scale: 250
EOF
gcloud logging metrics create ofcourse_ai_call_ms --project applyims --config-from-file /tmp/ofcourse_ai_call_ms.yaml
```

The buckets run 250 ms × 2ⁿ up to about 4.5 hours, which covers a cached lite call and a Pro retry ladder alike. Check both with `gcloud logging metrics list --project applyims`; they appear in Metrics Explorer as `logging.googleapis.com/user/ofcourse_ai_call_count` and `…/ofcourse_ai_call_ms` once the first `ai_call` line is logged (metrics count from creation, not backwards).

## 9. Spend cap on Vertex AI

A monthly budget on the billing account that pays for `applyims`, filtered to the project and to the Vertex AI service, with alerts at 50%, 90% and 100% of the amount. Default notifications go to the Billing Account Administrators and Users by e-mail; a budget never stops spend by itself, so the app's daily caps above (`AI_DAILY_CAP_PRO`, `AI_DAILY_CAP_IMAGE`) remain the hard stop.

Two ids to find first. The billing account that pays for the project:

```bash
gcloud billing projects describe applyims --format='value(billingAccountName)'
# billingAccounts/XXXXXX-XXXXXX-XXXXXX  → the part after the slash is BILLING_ACCOUNT below
```

The Vertex AI service id, from the Cloud Billing Catalog (gcloud has no `billing services` command; the Catalog API lists them, and its display name is "Vertex AI"):

```bash
curl -s -H "Authorization: Bearer $(gcloud auth print-access-token)" \
  'https://cloudbilling.googleapis.com/v1/services?pageSize=5000' \
  | grep -B 2 '"displayName": "Vertex AI"'
# "name": "services/XXXX-XXXX-XXXX"  → this is VERTEX_SERVICE below
```

Then, with the two ids filled in (the project is named by its number, 44805428675, which is how the Budget API stores it):

```bash
BILLING_ACCOUNT=XXXXXX-XXXXXX-XXXXXX
VERTEX_SERVICE=services/XXXX-XXXX-XXXX
gcloud billing budgets create --billing-account "$BILLING_ACCOUNT" \
  --display-name "OfCourse Vertex AI (applyims)" \
  --budget-amount 100USD --calendar-period month \
  --filter-projects projects/44805428675 \
  --filter-services "$VERTEX_SERVICE" \
  --threshold-rule percent=0.5 --threshold-rule percent=0.9 --threshold-rule percent=1.0
```

`--budget-amount` is the monthly figure to agree on (100 USD here); the currency must be the billing account's. Creating a budget needs the Billing Account Costs Manager or Administrator role on the account, not a project role. Check with `gcloud billing budgets list --billing-account "$BILLING_ACCOUNT"`.

## 10. Checks

- Smoke: `/` (student sign-in), `/admin/sign-in`, sign in as the first account (it becomes superadmin on an empty database), make one post end to end, open its `/posts/<slug>` signed out.
- Trace: in the console, Trace → Trace explorer, filter the span name `gen_ai` after the post above; each attempt is one span with `ofcourse.use_case`, `ofcourse.tier`, `ofcourse.outcome`.
- Logs: `gcloud logging read 'jsonPayload.event="ai_call"' --project applyims --limit 5 --format json` shows the lines the metrics count.

## Tear-down after the hackathon

```bash
gcloud run services delete ofcourse --project applyims --region asia-southeast1
gcloud run jobs delete ofcourse-migrate --project applyims --region asia-southeast1
gcloud sql instances delete ofcourse-db --project applyims
gcloud secrets delete ofcourse-database-url ofcourse-db-password ofcourse-better-auth-secret ofcourse-google-client-id ofcourse-google-client-secret --project applyims
```
