// Targeted updates (ADR-057: the scholarship update with its audience preview, scripted on mock
// data): the mock students an update's audience rule is matched against, and the three mock live
// updates the list shows beside real ones. Repo files parsed at load, as content/markets/index.ts
// does; every figure drawn from them is labelled mock. Client-safe: JSON and zod only.

import { z } from 'zod'
import { COURSES } from '@/features/engine'
import mockUpdates from './mock-updates.json'
import students from './students.json'

const COURSE_IDS = new Set(COURSES.map((c) => c.id))

const StudentSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  homeCountry: z.string().min(1),
  /** Her ranked routes, first first: catalogue course ids. */
  ranked: z.array(z.string().refine((id) => COURSE_IDS.has(id))).min(1),
})
export type MockStudent = z.infer<typeof StudentSchema>

export const MOCK_STUDENTS: readonly MockStudent[] = z
  .object({ mock: z.literal(true), students: z.array(StudentSchema).min(1) })
  .parse(students).students

/** The home countries the audience rule can narrow to: the mock students', sorted. */
export const HOME_COUNTRIES: readonly string[] = [
  ...new Set(MOCK_STUDENTS.map((s) => s.homeCountry)),
].sort((a, b) => a.localeCompare(b))

const MockUpdateSchema = z.object({
  id: z.string().min(1),
  overline: z.string().min(1),
  title: z.string().min(1),
  status: z.string().min(1),
})
export type MockUpdate = z.infer<typeof MockUpdateSchema>

export const MOCK_UPDATES: readonly MockUpdate[] = z
  .object({ mock: z.literal(true), updates: z.array(MockUpdateSchema) })
  .parse(mockUpdates).updates

/** The Updates page. */
export const UPDATES_PATH = '/admin/updates'
