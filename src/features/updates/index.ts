// Targeted updates (ADR-057: the scholarship update with its audience preview, scripted on mock
// data): the mock students an update's audience rule is matched against, and the sample updates
// the list shows beside real ones (rule changes, scholarships, new programs, government grants),
// each one a full update that can fill the form. Repo files parsed at load, as
// content/markets/index.ts does; every figure drawn from them is labelled mock. Client-safe: JSON
// and zod only.

import { z } from 'zod'
import { COURSES } from '@/features/engine'
import { audienceOf, TOPIC_IDS } from './lib/audience'
import type { UpdateInput, UpdateKind } from './lib/update'
import mockUpdates from './mock-updates.json'
import students from './students.json'

const COURSE_IDS = new Set(COURSES.map((c) => c.id))

const StudentSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  homeCountry: z.string().min(1),
  /** Her ranked routes, first first: catalogue course ids. */
  ranked: z.array(z.string().refine((id) => COURSE_IDS.has(id))).min(1),
  /** The fields she said she is drawn to. */
  interests: z.array(z.enum(TOPIC_IDS)).default([]),
})
export type MockStudent = z.infer<typeof StudentSchema>

export const MOCK_STUDENTS: readonly MockStudent[] = z
  .object({ mock: z.literal(true), students: z.array(StudentSchema).min(1) })
  .parse(students).students

/** The home countries the audience rule can narrow to: the mock students', sorted. */
export const HOME_COUNTRIES: readonly string[] = [
  ...new Set(MOCK_STUDENTS.map((s) => s.homeCountry)),
].sort((a, b) => a.localeCompare(b))

const KINDS = ['opportunity', 'rule_change', 'intake'] as const satisfies readonly UpdateKind[]
const day = z.iso.date()

/**
 * A sample update: a full update's fields, so it can fill the form, and its mock status line.
 * Its shape is checked here; lib/update.test.ts checks each one against the form's rules.
 */
const MockUpdateSchema = z.object({
  id: z.string().min(1),
  status: z.string().min(1),
  kind: z.enum(KINDS),
  category: z.string().min(1),
  institution: z.string().min(1),
  title: z.string().min(1),
  body: z.string().min(1),
  applyBy: day.nullable(),
  sourceTitle: z.string().min(1),
  sourceCheckedAt: day,
  audience: z
    .object({ institution: z.string().min(1), homeCountry: z.string().min(1).nullable() })
    .transform(audienceOf),
})
export type MockUpdate = UpdateInput & { id: string; status: string }

export const MOCK_UPDATES: readonly MockUpdate[] = z
  .object({ mock: z.literal(true), updates: z.array(MockUpdateSchema) })
  .parse(mockUpdates).updates

/** The Updates page. */
export const UPDATES_PATH = '/admin/updates'
