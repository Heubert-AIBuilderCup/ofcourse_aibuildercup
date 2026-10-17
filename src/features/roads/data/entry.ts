// What a course asks of a student to enter it: the lowest qualification she may hold, a degree
// in a field if the course is field-specific, and the English score it asks for. Mock figures,
// like the rest of the catalogue. Pure, so matching and the course card read the same rule.

import type { Level } from '@/features/engine/types'
import { courseById } from './courses'

export type EntryQual = 'High school' | 'Diploma' | "Bachelor's"
export type Entry = {
  minQual: EntryQual
  needsDegreeIn: string | null
  ielts: number
  /** A finder course's typical figure for its level, labelled sample like the rest of its catalogue. */
  sample?: true
}

/** The lowest qualification a level asks for: a Master's a bachelor's, the rest a school certificate. */
const MIN_QUAL: Record<Level, EntryQual> = {
  "Master's": "Bachelor's",
  "Bachelor's": 'High school',
  Diploma: 'High school',
}

/** Each course's own overall IELTS score, in half bands. */
const IELTS: Readonly<Record<string, number>> = {
  'ecu-cyber': 6.5,
  'curtin-it': 6.5,
  'curtin-infosys': 6.5,
  'curtin-commerce': 6.5,
  'ecu-data': 6.5,
  'ecu-bsc-cyber': 6,
  'tafe-cyber': 6,
  'unisa-cyber': 6.5,
  'unisa-it': 6.5,
  'unisa-nursing': 7,
  'unisa-dip-it': 6,
  'uts-cyber': 7,
  'uts-data': 7,
  'uts-civil': 6.5,
  'uts-bus-analytics': 7,
  'monash-data': 6.5,
  'monash-it': 6.5,
  'monash-mph': 6.5,
  'monash-dip-health': 6,
  'swin-cyberpsych': 7,
  'swin-ux': 6.5,
  'deakin-ba': 6.5,
  'deakin-cyber': 6.5,
  'deakin-civil': 6.5,
  'deakin-dip-business': 6,
  'utas-it': 6.5,
  'utas-data': 6.5,
  'utas-nursing': 7,
  'uow-cyber': 6.5,
  'ecu-bus-analytics': 6.5,
  'unisa-software': 6.5,
  'unisa-mph': 6.5,
  'unisa-health-admin': 6.5,
  'uts-infosec': 7,
  'uts-forensics': 6.5,
  'uts-structural': 6.5,
  'uts-eng-management': 6.5,
  'uts-accounting': 7,
  'monash-design': 6.5,
  'swin-design-strategy': 6.5,
  'monash-org-psych': 7,
  'monash-health-informatics': 6.5,
  'deakin-commerce': 6.5,
  'deakin-supply-chain': 6.5,
  'deakin-cyber-governance': 6.5,
  'deakin-network-security': 6.5,
  'deakin-mechanical': 6.5,
  'deakin-electrical': 6.5,
  'utas-infosys': 6.5,
  'utas-computing': 6.5,
  'utas-mph': 6.5,
}

/** A finder course's ("f-…") typical overall IELTS by level, for a course with no score of its own. */
const SAMPLE_IELTS: Partial<Record<Level, number>> = { Diploma: 5.5, "Master's": 6.5 }

/** The courses that need a degree in one field; Nursing is graduate entry, open to any bachelor's. */
const NEEDS_DEGREE_IN: Readonly<Record<string, string>> = {
  'uts-civil': 'engineering',
  'deakin-civil': 'engineering',
  'uts-structural': 'engineering',
  'uts-eng-management': 'engineering',
  'deakin-mechanical': 'engineering',
  'deakin-electrical': 'engineering',
}

/** A course's entry rule; undefined for a course the catalogue has none for. */
export function entryOf(courseId: string): Entry | undefined {
  const course = courseById(courseId)
  if (!course) return undefined
  const minQual = MIN_QUAL[course.level]
  const ielts = IELTS[courseId]
  if (ielts !== undefined)
    return { minQual, needsDegreeIn: NEEDS_DEGREE_IN[courseId] ?? null, ielts }
  const sample = courseId.startsWith('f-') ? SAMPLE_IELTS[course.level] : undefined
  if (sample === undefined) return undefined
  return { minQual, needsDegreeIn: null, ielts: sample, sample: true }
}

/** A course open to any graduate of its entry level: it asks no degree in its own field. */
export const openEntry = (courseId: string): boolean => !entryOf(courseId)?.needsDegreeIn

/**
 * The overall IELTS score each course with an entry rule asks for, one per course: the onboarding's
 * English line counts how many her score meets. Plain data, so the onboarding page hands it to the
 * question screen and the opening loads nothing of the roads.
 */
export const englishScores = (): number[] => Object.values(IELTS)
