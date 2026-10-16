import { type SQL, sql } from 'drizzle-orm'
import {
  type AnyPgColumn,
  boolean,
  check,
  customType,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import {
  type Coins,
  type OwnWords,
  PERSONAS,
  type Relative,
  type Reminder,
  type RoadmapChoices,
  type RoadmapTag,
  STEPS,
  type StoredAnswers,
} from '@/shared/types/student'
import { INVITE_ROLES, ROLES } from '../auth/access'
import { ARTIFACT_KINDS, type Pointers, STAGES } from './content-shapes'

/**
 * The schema. Field keys are camelCase (Better Auth's adapter maps by key); column names are
 * snake_case. Every timestamp is timestamptz. Add your feature's tables below the access section,
 * then run `bun run db:generate`.
 */

const tz = (name: string) => timestamp(name, { withTimezone: true })

// A CHECK that a text column holds one of a fixed list of the app's own constants.
const oneOf = (column: AnyPgColumn, values: readonly string[]): SQL =>
  sql`${column} in (${sql.raw(values.map((v) => `'${v}'`).join(', '))})`

// ── Better Auth ─────────────────────────────────────────────────────────────────────────────

export const user = pgTable(
  'user',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    email: text('email').notNull().unique(),
    emailVerified: boolean('email_verified').notNull().default(false),
    image: text('image'),
    // User, admin or superadmin (auth/access.ts): set at sign-up, then only by a superadmin;
    // never accepted from the client.
    role: text('role', { enum: ROLES }).notNull().default('user'),
    // The content capabilities (ADR-108), beside the role: set at sign-up from a waiting invite,
    // then only by a superadmin; never accepted from the client.
    editor: boolean('editor').notNull().default(false),
    reviewer: boolean('reviewer').notNull().default(false),
    // A suspension by an admin, with their reason; both null while the account is active.
    suspendedAt: tz('suspended_at'),
    suspendReason: text('suspend_reason'),
    lastSeenAt: tz('last_seen_at'),
    createdAt: tz('created_at').notNull().defaultNow(),
    updatedAt: tz('updated_at').notNull().defaultNow(),
  },
  (t) => [check('user_role_check', oneOf(t.role, ROLES))],
)

export const session = pgTable(
  'session',
  {
    id: text('id').primaryKey(),
    expiresAt: tz('expires_at').notNull(),
    token: text('token').notNull().unique(),
    createdAt: tz('created_at').notNull().defaultNow(),
    updatedAt: tz('updated_at').notNull().defaultNow(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
  },
  (t) => [index('session_user_id_idx').on(t.userId)],
)

export const account = pgTable(
  'account',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    // OAuth tokens, encrypted by Better Auth (account.encryptOAuthTokens).
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: tz('access_token_expires_at'),
    refreshTokenExpiresAt: tz('refresh_token_expires_at'),
    scope: text('scope'),
    password: text('password'),
    createdAt: tz('created_at').notNull().defaultNow(),
    updatedAt: tz('updated_at').notNull().defaultNow(),
  },
  (t) => [index('account_user_id_idx').on(t.userId)],
)

export const verification = pgTable(
  'verification',
  {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: tz('expires_at').notNull(),
    createdAt: tz('created_at').notNull().defaultNow(),
    updatedAt: tz('updated_at').notNull().defaultNow(),
  },
  (t) => [index('verification_identifier_idx').on(t.identifier)],
)

// ── Access ──────────────────────────────────────────────────────────────────────────────────

/**
 * A role, the content capabilities or both, waiting for an address's first sign-in, named by a
 * superadmin: say an admin who is also a reviewer, or a plain editor (role null). The email is
 * stored trimmed and lowercased, and the row is used up when that account is created. Personal
 * data (an email address): for the admin pages only.
 */
export const roleInvite = pgTable(
  'role_invite',
  {
    email: text('email').primaryKey(),
    role: text('role', { enum: INVITE_ROLES }),
    editor: boolean('editor').notNull().default(false),
    reviewer: boolean('reviewer').notNull().default(false),
    createdByUserId: text('created_by_user_id').references(() => user.id, {
      onDelete: 'set null',
    }),
    createdAt: tz('created_at').notNull().defaultNow(),
  },
  (t) => [
    check('role_invite_role_check', oneOf(t.role, INVITE_ROLES)),
    // An invite that gives nothing is no invite.
    check('role_invite_has_something', sql`${t.role} is not null or ${t.editor} or ${t.reviewer}`),
  ],
)

// ── Student opening ─────────────────────────────────────────────────────────────────────────

/**
 * One student's opening: her picture, reminders and whether she has seen the futures. Her answers
 * live on her roadmaps (below). The JSON columns follow the contract in shared/types/student.ts
 * and are parsed by its schemas on every read and write. Read and written only for the signed-in
 * student herself, by features/opening/server/profile.ts.
 */
export const studentProfile = pgTable(
  'student_profile',
  {
    userId: text('user_id')
      .primaryKey()
      .references(() => user.id, { onDelete: 'cascade' }),
    // Null until the picture question is answered or skipped.
    persona: text('persona', { enum: PERSONAS }),
    reminders: jsonb('reminders').$type<Reminder[]>().notNull().default([]),
    seenFutures: boolean('seen_futures').notNull().default(false),
    createdAt: tz('created_at').notNull().defaultNow(),
    updatedAt: tz('updated_at').notNull().defaultNow(),
  },
  (t) => [
    check(
      'student_profile_persona_check',
      sql`${t.persona} is null or ${oneOf(t.persona, PERSONAS)}`,
    ),
  ],
)

/**
 * One set of a student's answers and the board it draws. She has many; at most one is unfinished
 * (the one she is answering), and the first is made when she finishes onboarding. Each holds its
 * own full copy of the answers, never shared with another roadmap. Personal data (her
 * circumstances, a relative's name and place): read and written only for the signed-in student
 * herself, by features/roadmaps/server/roadmaps.ts.
 */
export const roadmap = pgTable(
  'roadmap',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    // Null: named from its road (features/roadmaps/model/roadmap.ts, roadmapName).
    name: text('name'),
    answers: jsonb('answers').$type<StoredAnswers>().notNull().default({}),
    relative: jsonb('relative').$type<Relative>(),
    coins: jsonb('coins').$type<Coins>(),
    // What she did on its board: swapped, added, read, walked to the city or the country.
    choices: jsonb('choices').$type<RoadmapChoices>().notNull().default({}),
    // Her own words per question screen, and the tags read from them; null until she writes any.
    ownWords: jsonb('own_words').$type<OwnWords>(),
    tags: jsonb('tags').$type<RoadmapTag[]>(),
    // Where she left off while answering.
    lastStep: text('last_step', { enum: STEPS }).notNull().default('picture'),
    copiedFrom: text('copied_from').references((): AnyPgColumn => roadmap.id, {
      onDelete: 'set null',
    }),
    createdAt: tz('created_at').notNull().defaultNow(),
    // Null while she is still answering.
    finishedAt: tz('finished_at'),
    // Null: never opened (it shows as New).
    lastOpenedAt: tz('last_opened_at'),
    // Null: alive. Set: deleted, and Undo can still bring it back.
    deletedAt: tz('deleted_at'),
    // Null: in her list. Set: folded away under Archived; its board still opens by URL.
    archivedAt: tz('archived_at'),
  },
  (t) => [
    index('roadmap_user_idx').on(t.userId),
    uniqueIndex('roadmap_one_unfinished')
      .on(t.userId)
      .where(sql`finished_at is null and deleted_at is null`),
    check('roadmap_last_step_check', oneOf(t.lastStep, STEPS)),
    check('roadmap_name_check', sql`${t.name} is null or char_length(${t.name}) between 1 and 60`),
  ],
)

// ── Content ─────────────────────────────────────────────────────────────────────────────────

// Images as raw bytes: drizzle-orm has no bytea column of its own.
const bytea = customType<{ data: Uint8Array; driverData: Buffer }>({
  dataType: () => 'bytea',
  toDriver: (v) => Buffer.from(v),
  fromDriver: (v) => new Uint8Array(v),
})

/**
 * A post: the only mutable content row. Its pointers name the immutable records it is made of
 * (content/model/artifacts.ts) and change only with its version, so a stale write is refused.
 * A Nepal variant or a social version points at its feed post by parentId. A blog is a post of
 * kind 'blog'.
 */
export const contentPost = pgTable(
  'content_post',
  {
    id: text('id').primaryKey(),
    kind: text('kind').notNull(),
    parentId: text('parent_id').references((): AnyPgColumn => contentPost.id, {
      onDelete: 'cascade',
    }),
    title: text('title').notNull(),
    /**
     * A feed post's public page, /posts/<slug> (criterion 107): set from its title when it first
     * goes live and never changed after, so a shared or indexed link keeps working. Null before.
     */
    slug: text('slug'),
    /**
     * The approval students see (criteria 116, 117): set by approveAndPublish in its save and never
     * cleared by a later move, so a live post taken back for editing keeps its published version
     * until the next one replaces it. Null before a post is first published.
     */
    publishedApprovalId: text('published_approval_id'),
    /**
     * The blog this post belongs to (BR6–BR8): made from it or linked to it. Deleting the blog
     * leaves the post, unlinked.
     */
    blogId: text('blog_id').references((): AnyPgColumn => contentPost.id, {
      onDelete: 'set null',
    }),
    /** The path a comic tells (RC2): a catalogue course id. Null on every other post. */
    courseId: text('course_id'),
    stage: text('stage').notNull(),
    pointers: jsonb('pointers').notNull().$type<Pointers>(),
    version: integer('version').notNull().default(1),
    createdByUserId: text('created_by_user_id').references(() => user.id, {
      onDelete: 'set null',
    }),
    updatedByUserId: text('updated_by_user_id').references(() => user.id, {
      onDelete: 'set null',
    }),
    /**
     * The post's owner on the board and a note to them (server/assign.ts): one member of the
     * board's staff, or none. An assignment is not an edit: it leaves `updated_*` as they are.
     */
    assigneeUserId: text('assignee_user_id').references(() => user.id, { onDelete: 'set null' }),
    assignmentNote: text('assignment_note'),
    assignedByUserId: text('assigned_by_user_id').references(() => user.id, {
      onDelete: 'set null',
    }),
    assignedAt: tz('assigned_at'),
    createdAt: tz('created_at').notNull().defaultNow(),
    updatedAt: tz('updated_at').notNull().defaultNow(),
  },
  (t) => [
    check('content_post_kind_check', oneOf(t.kind, ['feed', 'social', 'blog'])),
    check('content_post_stage_check', oneOf(t.stage, STAGES)),
    index('content_post_stage_idx').on(t.stage),
    index('content_post_parent_id_idx').on(t.parentId),
    index('content_post_blog_id_idx').on(t.blogId),
    index('content_post_course_id_idx').on(t.courseId),
    uniqueIndex('content_post_slug_idx').on(t.slug),
  ],
)

/**
 * One immutable record of a post (source, facts, drafts, revision, layout, render, checks,
 * approval), identified by the hash of its content (content/server/hash.ts). Written once; the
 * database refuses any update (migration 0003_content_artifact_immutable). The same record
 * written twice is one row.
 */
export const contentArtifact = pgTable(
  'content_artifact',
  {
    id: text('id').primaryKey(),
    postId: text('post_id')
      .notNull()
      .references(() => contentPost.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull(),
    body: jsonb('body').notNull(),
    createdByUserId: text('created_by_user_id').references(() => user.id, {
      onDelete: 'set null',
    }),
    createdAt: tz('created_at').notNull().defaultNow(),
  },
  (t) => [
    check('content_artifact_kind_check', oneOf(t.kind, ARTIFACT_KINDS)),
    index('content_artifact_post_id_idx').on(t.postId),
  ],
)

/**
 * A stored image, identified by the hash of its bytes, so one art image used by two renders is
 * one row. Written once; the database refuses any update. Served to staff only.
 */
export const contentAsset = pgTable('content_asset', {
  id: text('id').primaryKey(),
  mime: text('mime').notNull(),
  bytes: bytea('bytes').notNull(),
  createdAt: tz('created_at').notNull().defaultNow(),
})

/**
 * The step lock: one row per post and step. A second click while a step is running is refused,
 * and a refresh shows what is running.
 */
export const contentStep = pgTable(
  'content_step',
  {
    postId: text('post_id')
      .notNull()
      .references(() => contentPost.id, { onDelete: 'cascade' }),
    step: text('step').notNull(),
    status: text('status').notNull(),
    startedVersion: integer('started_version').notNull(),
    startedAt: tz('started_at').notNull(),
    finishedAt: tz('finished_at'),
    error: text('error'),
    // How far a run is, as it records it (the images drawn of those planned), or null.
    progress: jsonb('progress').$type<{ done: number; total: number }>(),
    // When the run last said it is alive: a lock is stale counted from this, else from started_at.
    beatAt: tz('beat_at'),
  },
  (t) => [
    primaryKey({ columns: [t.postId, t.step] }),
    check('content_step_status_check', oneOf(t.status, ['running', 'done', 'failed'])),
  ],
)

/**
 * The log of model calls, one row per call: the daily caps count it by (day, tier). No foreign
 * key on the post: the log outlives posts.
 */
export const aiCall = pgTable(
  'ai_call',
  {
    id: text('id').primaryKey(),
    // The UTC day of the call.
    day: date('day', { mode: 'string' }).notNull(),
    useCase: text('use_case').notNull(),
    tier: text('tier').notNull(),
    model: text('model').notNull(),
    promptVersion: text('prompt_version').notNull(),
    ok: boolean('ok').notNull(),
    cached: boolean('cached').notNull(),
    ms: integer('ms').notNull(),
    fallback: text('fallback'),
    postId: text('post_id'),
    createdAt: tz('created_at').notNull().defaultNow(),
  },
  (t) => [
    check('ai_call_tier_check', oneOf(t.tier, ['lite', 'flash', 'pro', 'image'])),
    index('ai_call_day_tier_idx').on(t.day, t.tier),
  ],
)

/**
 * Validated model answers by the sha256 of everything the answer depends on: model, prompt
 * version, system, prompt, schema, temperature and image hash. An image answer is `{ assetId }`.
 */
export const aiCache = pgTable('ai_cache', {
  key: text('key').primaryKey(),
  useCase: text('use_case').notNull(),
  model: text('model').notNull(),
  promptVersion: text('prompt_version').notNull(),
  value: jsonb('value').notNull(),
  createdAt: tz('created_at').notNull().defaultNow(),
})

/**
 * A page brand's design language (criterion 105): its art style, copy style and closest template,
 * written once by a model from one or two reference images (content_asset ids) and then edited by
 * an editor. One row per page brand; mutable settings, not a content record, so each save replaces
 * the row and names who saved it and when. Colours and fonts are never here: the brand file owns
 * them. Editors and superadmins write it; everyone who may see the Board reads it. No personal data.
 */
export const pageStyle = pgTable('page_style', {
  brandId: text('brand_id').primaryKey(),
  artStyle: text('art_style').notNull(),
  copyStyle: text('copy_style').notNull(),
  closestTemplateId: text('closest_template_id').notNull(),
  referenceAssetIds: text('reference_asset_ids').array().notNull(),
  updatedByUserId: text('updated_by_user_id').references(() => user.id, { onDelete: 'set null' }),
  updatedAt: tz('updated_at').notNull().defaultNow(),
})

/**
 * The one character every comic of a page brand shows (RC9): described in a line, planned as views
 * (front, side, expressions), drawn as a sheet, and approved before any panel is drawn (RC10). One
 * row per page brand; mutable settings like pageStyle, so each save replaces the row. `updatedBy`
 * has no foreign key, so removing a user keeps the row; the approver goes to null instead.
 */
export const comicCharacter = pgTable('comic_character', {
  brandId: text('brand_id').primaryKey(),
  description: text('description').notNull(),
  views: jsonb('views').notNull().$type<{ label: string; scene: string }[]>(),
  /** The latest drawn sheet (a content_asset id) and the note it was redrawn with. */
  sheetAssetId: text('sheet_asset_id'),
  sheetNote: text('sheet_note'),
  approvedAssetId: text('approved_asset_id'),
  approvedBy: text('approved_by').references(() => user.id, { onDelete: 'set null' }),
  approvedAt: tz('approved_at'),
  updatedBy: text('updated_by').notNull(),
  updatedAt: tz('updated_at').notNull(),
})

/**
 * The paths students are shown on `/futures` (RC12): one row per UTC day, course and viewer key,
 * so a student counts once per path per day. The viewer key is an HMAC of the day and the user id
 * under the server's secret, so no user id is kept, no row refers to a user, and one student's days
 * cannot be linked. Rows older than 31 days are deleted as new ones come in.
 */
export const pathView = pgTable(
  'path_view',
  {
    day: date('day', { mode: 'string' }).notNull(),
    courseId: text('course_id').notNull(),
    viewerKey: text('viewer_key').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.day, t.courseId, t.viewerKey] }),
    index('path_view_day_idx').on(t.day),
  ],
)

/**
 * How each path was shown on `/futures` (RC17): one row per path per draw, with the future it
 * appeared as and the strengths and costs shown, or out of reach with how far over budget (in
 * thousands). A redraw after a changed answer adds rows marked `redraw`. The viewer key is
 * path_view's daily key, so one student's showings on a day group without an identity; no answer
 * and no user id is kept. Rows older than 31 days are deleted as new ones come in.
 */
export const pathShowing = pgTable(
  'path_showing',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    day: date('day', { mode: 'string' }).notNull(),
    courseId: text('course_id').notNull(),
    viewerKey: text('viewer_key').notNull(),
    futureId: text('future_id').$type<'cost' | 'staying' | 'career'>(),
    strongOn: text('strong_on').array().notNull().default(sql`'{}'::text[]`),
    costsOn: text('costs_on').array().notNull().default(sql`'{}'::text[]`),
    outOfReach: boolean('out_of_reach').notNull().default(false),
    overByK: integer('over_by_k'),
    redraw: boolean('redraw').notNull().default(false),
    createdAt: tz('created_at').notNull().defaultNow(),
  },
  (t) => [index('path_showing_day_course_idx').on(t.day, t.courseId)],
)

/**
 * An editor's decision on an Ideas queue suggestion (ADR-042), by the idea's id in the ideas file
 * (content/ideas-queue/ideas.json): accepted or dismissed, once. A dismissed idea is never shown
 * again; an accepted content idea records the post started from it when that post is made.
 * Deleting the post or the editor leaves the decision.
 */
export const contentIdeaDecision = pgTable(
  'content_idea_decision',
  {
    ideaId: text('idea_id').primaryKey(),
    decision: text('decision').notNull().$type<'accepted' | 'dismissed'>(),
    postId: text('post_id').references(() => contentPost.id, { onDelete: 'set null' }),
    decidedByUserId: text('decided_by_user_id').references(() => user.id, {
      onDelete: 'set null',
    }),
    decidedAt: tz('decided_at').notNull().defaultNow(),
  },
  (t) => [
    check('content_idea_decision_decision_check', oneOf(t.decision, ['accepted', 'dismissed'])),
  ],
)

/**
 * A targeted update (ADR-057): a rule change, an intake change or an opportunity, written by an
 * editor, sent to review, and made live by a reviewer. `audience` is the rule it reaches students
 * by (updates/lib/audience.ts): an institution they ranked a route at, and a home country or none.
 * Delivery into the student feed and email is not built: reach is matched against mock students.
 */
export const adminUpdate = pgTable(
  'admin_update',
  {
    id: text('id').primaryKey(),
    kind: text('kind').notNull().$type<'opportunity' | 'rule_change' | 'intake'>(),
    category: text('category').notNull(),
    institution: text('institution').notNull(),
    title: text('title').notNull(),
    body: text('body').notNull(),
    applyBy: date('apply_by', { mode: 'string' }),
    sourceTitle: text('source_title').notNull(),
    sourceCheckedAt: date('source_checked_at', { mode: 'string' }).notNull(),
    audience: jsonb('audience')
      .notNull()
      .$type<{ institution: string; homeCountry: string | null }>(),
    status: text('status').notNull().$type<'draft' | 'in_review' | 'live'>(),
    createdByUserId: text('created_by_user_id').references(() => user.id, {
      onDelete: 'set null',
    }),
    approvedByUserId: text('approved_by_user_id').references(() => user.id, {
      onDelete: 'set null',
    }),
    createdAt: tz('created_at').notNull().defaultNow(),
    updatedAt: tz('updated_at').notNull().defaultNow(),
  },
  (t) => [
    check('admin_update_kind_check', oneOf(t.kind, ['opportunity', 'rule_change', 'intake'])),
    check('admin_update_status_check', oneOf(t.status, ['draft', 'in_review', 'live'])),
    index('admin_update_status_updated_idx').on(t.status, t.updatedAt),
  ],
)

/**
 * What a student asked on a roadmap's tile and what she was answered, one row per question: the
 * daily cap counts it by (user, day). Personal data: read and written only for the signed-in
 * student herself.
 */
export const studentAsk = pgTable(
  'student_ask',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    roadmapId: text('roadmap_id')
      .notNull()
      .references(() => roadmap.id, { onDelete: 'cascade' }),
    tileId: text('tile_id').notNull(),
    question: text('question').notNull(),
    reply: text('reply').notNull(),
    outcome: text('outcome', { enum: ['answered', 'refused', 'failed'] }).notNull(),
    // The UTC day of the question.
    day: date('day', { mode: 'string' }).notNull(),
    createdAt: tz('created_at').notNull().defaultNow(),
  },
  (t) => [index('student_ask_user_day_idx').on(t.userId, t.day)],
)
