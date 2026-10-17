// A finder card's detail (criteria 23 and 24): the fields one step from the course's field, its
// jobs grouped by every subject it combines (the primary's from its extras, each other's from that
// field's occupations, none twice), and each job's sample market in the card's city. Pure, from
// the catalogue.

import { describe, expect, it, mock } from 'bun:test'
import { FIELD_EDGES, FIELDS } from '@/features/roads/data/fields'
import { jobMarketFor } from '@/features/roads/data/job-market'
import { FINDER_EXTRAS } from '../data/catalogue'
import { FIELD_OCCUPATIONS } from '../data/field-occupations'

mock.module('server-only', () => ({}))

const { courseDetail } = await import('./detail')

const PERTH_BUSINESS = 'f-diploma-of-business-tafe-perth'
const CYBERPSYCH = 'f-master-of-cyber-psychology-utas-sandy-bay'

describe('courseDetail', () => {
  it('lists the fields one step from its graph field, named and defined, in FIELD_EDGES order', () => {
    const detail = courseDetail(PERTH_BUSINESS, 'perth')
    const near = FIELD_EDGES.flatMap((e) =>
      e.from === 'business' ? [e.to] : e.to === 'business' ? [e.from] : [],
    ).filter((id, i, all) => all.indexOf(id) === i)
    const named = near.map((id) => {
      const f = FIELDS.find((x) => x.id === id)
      return { name: f?.name, definition: f?.definition }
    })
    expect(JSON.stringify(detail?.fieldsNear)).toBe(JSON.stringify(named))
    expect(detail?.fieldsNear[0]?.name).toBe('Information systems')
  })

  it('gives a plain course one primary group: the jobs its extras give, in their order, with the sample market in the city asked', () => {
    const detail = courseDetail(PERTH_BUSINESS, 'perth')
    expect(detail?.jobGroups.map((g) => `${g.field} ${g.name} ${g.primary}`)).toEqual([
      'business Business true',
    ])
    const jobs = detail?.jobGroups[0]?.jobs
    expect(jobs?.map((j) => `${j.code} ${j.name}`)).toEqual([
      '224999 Business Analyst',
      '511112 Program or Project Administrator',
      '221111 Accountant (General)',
      '133611 Supply and Distribution Manager',
    ])
    expect(jobs?.[0]?.market?.openings).toBe(350)
    expect(jobs?.[0]?.market?.cityId).toBe('perth')
    expect(courseDetail(PERTH_BUSINESS, 'sydney')?.jobGroups[0]?.jobs[0]?.market?.openings).toBe(
      700,
    )
  })

  it('gives a job no market in a city with no sample row', () => {
    const jobs = courseDetail(PERTH_BUSINESS, 'wollongong')?.jobGroups[0]?.jobs
    expect(jobs?.length).toBe(4)
    expect(jobs?.every((j) => j.market === null)).toBe(true)
  })

  it('gives a Cyberpsychology course Psychology roles first, then Cyber security roles', () => {
    const detail = courseDetail(CYBERPSYCH, 'hobart')
    const extra = FINDER_EXTRAS.find((x) => x.courseId === CYBERPSYCH)
    expect(detail?.jobGroups.map((g) => `${g.field} ${g.name} ${g.primary}`)).toEqual([
      'psych Psychology true',
      'cyber Cyber security false',
    ])
    const [psych, cyber] = detail?.jobGroups ?? []
    expect(psych?.jobs.map((j) => j.code)).toEqual(extra?.occupationCodes ?? ['missing'])
    const primaryCodes = psych?.jobs.map((j) => j.code) ?? []
    expect(cyber?.jobs.map((j) => j.code)).toEqual(
      FIELD_OCCUPATIONS.cyber.filter((c) => !primaryCodes.includes(c)),
    )
    expect((cyber?.jobs.length ?? 0) > 0).toBe(true)
    expect(JSON.stringify(cyber?.jobs.map((j) => j.market))).toBe(
      JSON.stringify(cyber?.jobs.map((j) => jobMarketFor(j.code, 'hobart'))),
    )
  })

  it('lists no job twice across a combined course groups', () => {
    for (const extra of FINDER_EXTRAS.filter((x) => x.fields.length > 1)) {
      const codes = courseDetail(extra.courseId, 'melbourne')?.jobGroups.flatMap((g) =>
        g.jobs.map((j) => j.code),
      )
      expect(new Set(codes).size, extra.courseId).toBe(codes?.length ?? -1)
    }
  })

  it('gives one group per subject, in the order of its fields', () => {
    for (const extra of FINDER_EXTRAS) {
      const groups = courseDetail(extra.courseId, 'melbourne')?.jobGroups
      expect(groups?.map((g) => g.field).join(','), extra.courseId).toBe(extra.fields.join(','))
    }
  })

  it('follows every extra: each primary job is jobMarketFor its code and city', () => {
    const extra = FINDER_EXTRAS.find((x) => x.occupationCodes.length > 1)
    if (!extra) throw new Error('no extra with two occupations')
    const markets = courseDetail(extra.courseId, 'melbourne')?.jobGroups[0]?.jobs.map(
      (j) => j.market,
    )
    expect(JSON.stringify(markets)).toBe(
      JSON.stringify(extra.occupationCodes.map((c) => jobMarketFor(c, 'melbourne'))),
    )
  })

  it('is null for a course the finder does not know', () => {
    expect(courseDetail('no-such-course', 'perth')).toBeNull()
  })
})
