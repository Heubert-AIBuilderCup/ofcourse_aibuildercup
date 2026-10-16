ALTER TABLE "content_post" ADD COLUMN "slug" text;--> statement-breakpoint
CREATE UNIQUE INDEX "content_post_slug_idx" ON "content_post" USING btree ("slug");--> statement-breakpoint
-- A slug for every feed post already live (criterion 107): the steps of slugOf in
-- src/features/content/lib/public-post.ts (accents dropped, lowercase, runs of anything but a-z
-- and 0-9 one hyphen, none at either end, at most 80 characters, "post" when nothing is left),
-- and for a second post with the same slug the next number from 2, oldest first; "assets" is the
-- image route's, so it starts at 2. Posts that go live later get theirs from the store.
WITH base AS (
  SELECT
    id,
    created_at,
    coalesce(nullif(rtrim(left(trim(both '-' from regexp_replace(
      lower(regexp_replace(normalize(title, NFKD), '[̀-ͯ]', '', 'g')),
      '[^a-z0-9]+', '-', 'g'
    )), 80), '-'), ''), 'post') AS slug
  FROM "content_post"
  WHERE "kind" = 'feed' AND "parent_id" IS NULL AND "stage" IN ('live', 'exported')
),
numbered AS (
  SELECT
    id,
    slug,
    row_number() OVER (PARTITION BY slug ORDER BY created_at, id)
      + CASE WHEN slug = 'assets' THEN 1 ELSE 0 END AS n
  FROM base
)
UPDATE "content_post" AS p
SET "slug" = CASE WHEN numbered.n = 1 THEN numbered.slug ELSE numbered.slug || '-' || numbered.n END
FROM numbered
WHERE p.id = numbered.id;
