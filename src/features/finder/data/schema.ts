import { z } from 'zod'
import type { FieldId } from '@/features/engine/types'

/** The cities the finder's sample catalogue covers. */
export const FINDER_CITIES = [
  'perth',
  'adelaide',
  'sydney',
  'melbourne',
  'geelong',
  'hobart',
] as const

/** The campuses in those cities that some course already names, so each one's university is known. */
export const FINDER_CAMPUSES = [
  'ecu-joondalup',
  'curtin-bentley',
  'tafe-perth',
  'unisa-city-west',
  'uts-ultimo',
  'monash-clayton',
  'swinburne-hawthorn',
  'deakin-waurn-ponds',
  'utas-sandy-bay',
] as const

const FIELD_IDS = [
  'cyber',
  'data',
  'business',
  'it',
  'psych',
  'health',
  'engineering',
  'design',
] as const satisfies readonly FieldId[]

const sentences = (text: string) => text.match(/[.!?](\s|$)/g)?.length ?? 0

/** One generated course, as an agent writes it to src/features/finder/data/raw/<field>.json. */
export const rawCourseSchema = z.object({
  name: z.string().min(8).max(90),
  campusId: z.enum(FINDER_CAMPUSES),
  level: z.enum(['Diploma', "Master's"]),
  years: z.union([z.literal(1), z.literal(2)]),
  feeK: z.number().int().min(12).max(60),
  field: z.enum(FIELD_IDS),
  graphField: z.string(),
  niche: z.boolean(),
  placements: z.boolean(),
  description: z
    .string()
    .min(120)
    .max(600)
    .refine((text) => sentences(text) >= 2 && sentences(text) <= 4, '2 to 4 sentences'),
  majors: z.array(z.string()).min(1).max(4),
  units: z.array(z.string()).min(3).max(8),
})

export type RawCourse = z.infer<typeof rawCourseSchema>
