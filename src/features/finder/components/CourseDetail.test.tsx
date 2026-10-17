/// <reference lib="dom" />
// A found course's detail: one jobs section per subject it combines, titled "<Subject> roles · Job
// market (sample data)", the caveat under each subject that is not its primary one, and, on a
// combined course, once above them, the subject her visa and PR route follow. Compared as strings
// and counts.
import { afterEach, describe, expect, it } from 'bun:test'
import { cleanup, render, screen } from '@testing-library/react'
import type { CourseDetailData } from '../model/types'
import { CourseDetail } from './CourseDetail'

afterEach(cleanup)

const job = (code: string, name: string) => ({ code, name, market: null })

const SAMPLE = ' · Job market (sample data)'
const ROUTE = /^Your visa and PR route follow/

const CYBER_CAVEAT = 'Roles in Cyber security may need your degree assessed for that field.'

/** The text of the section whose title is `title`. */
const sectionText = (title: string) =>
  screen.getByRole('heading', { name: title }).closest('section')?.textContent ?? ''

describe('CourseDetail', () => {
  it('shows a combined course two groups by subject, the caveat only under the second, the route once', () => {
    const detail: CourseDetailData = {
      fieldsNear: [],
      jobGroups: [
        {
          field: 'psych',
          name: 'Psychology',
          primary: true,
          jobs: [job('272399', 'Psychologist')],
        },
        {
          field: 'cyber',
          name: 'Cyber security',
          primary: false,
          jobs: [job('262112', 'ICT Security Specialist')],
        },
      ],
    }
    render(<CourseDetail detail={detail} />)
    const titles = screen.queryAllByRole('heading').map((h) => h.textContent)
    expect(titles).toEqual([`Psychology roles${SAMPLE}`, `Cyber security roles${SAMPLE}`])
    expect(screen.queryAllByText(/may need your degree assessed/).length).toBe(1)
    expect(sectionText(`Cyber security roles${SAMPLE}`).includes(CYBER_CAVEAT)).toBe(true)
    expect(sectionText(`Psychology roles${SAMPLE}`).includes('may need your degree assessed')).toBe(
      false,
    )
    expect(screen.queryAllByText('Your visa and PR route follow Psychology.').length).toBe(1)
  })

  it('shows a plain course one group and no caveat', () => {
    const detail: CourseDetailData = {
      fieldsNear: [],
      jobGroups: [
        {
          field: 'business',
          name: 'Business',
          primary: true,
          jobs: [job('224999', 'Business Analyst')],
        },
      ],
    }
    render(<CourseDetail detail={detail} />)
    const titles = screen.queryAllByRole('heading').map((h) => h.textContent)
    expect(titles).toEqual([`Business roles${SAMPLE}`])
    expect(screen.queryAllByText(/may need your degree assessed/).length).toBe(0)
    expect(screen.queryAllByText(ROUTE).length).toBe(0)
  })
})
