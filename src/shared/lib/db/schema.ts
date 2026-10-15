import { type SQL, sql } from 'drizzle-orm'
import {
  type AnyPgColumn,
  boolean,
  check,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core'
import {
  type Coins,
  PERSONAS,
  type Relative,
  type Reminder,
  type RoadmapChoices,
  STEPS,
  type StoredAnswers,
} from '@/shared/types/student'
import { INVITE_ROLES, ROLES } from '../auth/access'

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
 * A role waiting for an address's first sign-in, named by a superadmin. The email is stored
 * trimmed and lowercased, and the row is used up when that account is created. Personal data
 * (an email address): for the admin pages only.
 */
export const roleInvite = pgTable(
  'role_invite',
  {
    email: text('email').primaryKey(),
    role: text('role', { enum: INVITE_ROLES }).notNull(),
    createdByUserId: text('created_by_user_id').references(() => user.id, {
      onDelete: 'set null',
    }),
    createdAt: tz('created_at').notNull().defaultNow(),
  },
  (t) => [check('role_invite_role_check', oneOf(t.role, INVITE_ROLES))],
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
