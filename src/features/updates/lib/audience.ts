import { COURSES } from '@/features/engine'
import type { Course, FieldId } from '@/features/engine/types'
import { FIELDS } from '@/features/roads/data/fields'
import type { MockStudent } from '..'

// An update's audience, pure: the students who ranked a route at an institution (or every
// student, for an update that applies to all institutions), optionally only those from one home
// country and in one topic, each with the line that tells her why she sees it.

/**
 * Students who ranked a route at `institution`, or every student when it is ALL_INSTITUTIONS;
 * from `homeCountry` only, when one is chosen; in `topic` only (a ranked course in that field, or
 * the field among her stated interests), unless it is ALL_TOPICS.
 */
export type AudienceRule = {
  institution: string
  homeCountry: string | null
  topic: typeof ALL_TOPICS | typeof NO_TOPIC | TopicId
}

/** An update not tied to one field: the topic is left out. */
export const ALL_TOPICS = 'All topics' as const

/** A stored topic that is none of the eight: it matches no student, never everyone. */
export const NO_TOPIC = 'No topic' as const

/** The eight broad fields an update can be aimed at. */
export const TOPIC_IDS = [
  'cyber',
  'data',
  'business',
  'it',
  'psych',
  'health',
  'engineering',
  'design',
] as const satisfies readonly FieldId[]
export type TopicId = (typeof TOPIC_IDS)[number]

/** Whether a field is one of the eight topics. */
export const isTopic = (field: string): field is TopicId =>
  (TOPIC_IDS as readonly string[]).includes(field)

/** "Data science": a topic by its field's name. */
export const topicName = (id: string): string => FIELDS.find((f) => f.id === id)?.name ?? id

/** "Because you said you're drawn to Data science": the why of a stated interest in a topic. */
export const drawnToWhy = (topic: string) => `Because you said you're drawn to ${topicName(topic)}`

const topicOf = (stored: string | undefined): AudienceRule['topic'] =>
  stored === undefined || stored === ALL_TOPICS ? ALL_TOPICS : isTopic(stored) ? stored : NO_TOPIC

/**
 * A stored audience as a rule: one saved before topics reads as all topics; a stored topic that is
 * not one of the topics reads as NO_TOPIC, which reaches no one.
 */
export function audienceOf(stored: {
  institution: string
  homeCountry: string | null
  topic?: string
}): AudienceRule {
  return {
    institution: stored.institution,
    homeCountry: stored.homeCountry,
    topic: topicOf(stored.topic),
  }
}

export type Match = { student: MockStudent; why: string }

/** The catalogue's institutions, once each, sorted. */
export const INSTITUTIONS: readonly string[] = [...new Set(COURSES.map((c) => c.university))].sort(
  (a, b) => a.localeCompare(b),
)

/** An update not tied to one institution (a visa rule, a national grant): it reaches everyone. */
export const ALL_INSTITUTIONS = 'All institutions'

const DEGREE = /^(Master|Bachelor|Diploma|Graduate Certificate|Graduate Diploma) of /

/** "ECU Cyber Security": the institution, then the course without its degree. */
export const routeName = (course: Course) =>
  `${course.university} ${course.name.replace(DEGREE, '')}`

/**
 * The students the rule reaches, in the order given, each with her why line, named from the
 * highest route she ranked at the institution ("Because you ranked ECU Cyber Security"); for all
 * institutions, "Because it applies to every student" (from her country, when one is chosen); and,
 * with a topic, whatever the institution, "Because Data science is on a route you ranked" or
 * "Because you said you're drawn to Data science", as her feed says it.
 */
export function matchAudience(
  rule: AudienceRule,
  students: readonly MockStudent[],
  courses: readonly Course[] = COURSES,
): Match[] {
  const byId = new Map(courses.map((c) => [c.id, c]))
  const everyone = `Because it applies to every student${rule.homeCountry === null ? '' : ` from ${rule.homeCountry}`}`
  const name = topicName(rule.topic)
  /** Her why line for every institution, or null when the topic leaves her out. */
  const topicWhy = (student: MockStudent): string | null => {
    if (rule.topic === ALL_TOPICS) return everyone
    if (student.ranked.some((id) => byId.get(id)?.field === rule.topic)) {
      return `Because ${name} is on a route you ranked`
    }
    if (student.interests.some((t) => t === rule.topic)) return drawnToWhy(rule.topic)
    return null
  }
  return students.flatMap((student) => {
    if (rule.homeCountry !== null && student.homeCountry !== rule.homeCountry) return []
    const why = topicWhy(student)
    if (why === null) return []
    if (rule.institution === ALL_INSTITUTIONS) return [{ student, why }]
    const course = student.ranked
      .map((id) => byId.get(id))
      .find((c) => c?.university === rule.institution)
    if (!course) return []
    // With a topic, the topic's why, as her feed gives it.
    const ranked = `Because you ranked ${routeName(course)}`
    return [{ student, why: rule.topic === ALL_TOPICS ? ranked : why }]
  })
}
