/// <reference lib="dom" />
/// <reference path="../../../../node_modules/@testing-library/jest-dom/types/bun.d.ts" />
import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import * as navigation from 'next/navigation'
import { MOCK_STUDENTS, MOCK_UPDATES } from '..'
import {
  ALL_INSTITUTIONS,
  ALL_TOPICS,
  INSTITUTIONS,
  matchAudience,
  NO_TOPIC,
  TOPIC_IDS,
  topicName,
} from '../lib/audience'
import { DEMO_DRAFT, type StoredUpdate } from '../lib/update'

const refresh = mock(() => {})
mock.module('next/navigation', () => ({
  ...navigation,
  useRouter: () => ({ push: () => {}, replace: () => {}, refresh }),
}))

const { UpdatesScreen } = await import('./UpdatesScreen')

afterEach(cleanup)

const create = mock(async (_input: unknown) => ({ ok: true as const, id: 'u-new' }))
const sendToReview = mock(async (_id: unknown) => ({ ok: true as const }))
const approve = mock(async (_id: unknown) => ({ ok: true as const }))

beforeEach(() => {
  create.mockClear()
  sendToReview.mockClear()
  approve.mockClear()
  refresh.mockClear()
})

const IN_REVIEW: StoredUpdate = {
  ...DEMO_DRAFT,
  title: 'ECU research travel grant',
  id: '7c0e7f3e-8c1a-4a55-9d61-3b7a5f0c2d11',
  status: 'in_review',
}

const screenFor = (
  role: { canWrite: boolean; canApprove: boolean },
  updates: StoredUpdate[] = [],
) =>
  render(
    <UpdatesScreen
      updates={updates}
      mockUpdates={MOCK_UPDATES}
      students={MOCK_STUDENTS}
      {...role}
      actions={{ create, sendToReview, approve }}
    />,
  )

const EMPTY = 'Pick an update to see who it reaches, or start a new one.'
const [SAMPLE] = MOCK_UPDATES
const escaped = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const sampleRow = (title: string) =>
  screen.getByRole('button', { name: new RegExp(escaped(title)) })

const reach = (institution: string, homeCountry: string | null) =>
  matchAudience({ institution, homeCountry, topic: ALL_TOPICS }, MOCK_STUDENTS)

describe('UpdatesScreen', () => {
  it('lists the sample updates, labelled mock, and says what to do with nothing picked', () => {
    screenFor({ canWrite: false, canApprove: false })
    for (const m of MOCK_UPDATES) expect(screen.getByText(m.title)).toBeInTheDocument()
    expect(screen.getAllByText('Mock').length).toBe(MOCK_UPDATES.length)
    expect(screen.getAllByText(EMPTY).length).toBe(1)
    expect(screen.queryAllByText('Create a targeted update').length).toBe(0)
    expect(screen.queryAllByRole('button', { name: '+ New update' }).length).toBe(0)
  })

  it('as the editor changes the rule, the reach and the preview follow it', () => {
    screenFor({ canWrite: true, canApprove: false })
    fireEvent.click(screen.getByRole('button', { name: '+ New update' }))
    const ecu = reach('ECU', null)
    expect(screen.getByText(`Reaches ${ecu.length} students (mock)`)).toBeInTheDocument()
    const preview = within(screen.getByRole('region', { name: /^Student preview/ }))
    expect(
      screen.getAllByRole('region', { name: 'Student preview · Priya (mock student)' }).length,
    ).toBe(1)
    expect(preview.getAllByText('Matched student').length).toBe(1)
    expect(preview.queryAllByText('For you').length).toBe(0)
    expect(
      preview.getAllByText('Why Priya sees this: Because you ranked ECU Cyber Security').length,
    ).toBe(1)

    fireEvent.change(screen.getByLabelText('Home country'), { target: { value: 'India' } })
    const india = reach('ECU', 'India')
    expect(screen.getByText(`Reaches ${india.length} students (mock)`)).toBeInTheDocument()
    expect(
      screen.getByRole('region', {
        name: `Student preview · ${india[0].student.name} (mock student)`,
      }),
    ).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Ranked a route at'), { target: { value: 'Monash' } })
    const monash = reach('Monash', 'India')
    expect(screen.getByText(`Reaches ${monash.length} students (mock)`)).toBeInTheDocument()
    expect(
      within(screen.getByRole('region', { name: /^Student preview/ })).getByText(monash[0].why, {
        exact: false,
      }),
    ).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Monash data grant' } })
    expect(
      within(screen.getByRole('region', { name: /^Student preview/ })).getByText(
        'Monash data grant',
      ),
    ).toBeInTheDocument()
  })

  it("saves the editor's draft through the action with the form's values", async () => {
    screenFor({ canWrite: true, canApprove: false })
    fireEvent.click(screen.getByRole('button', { name: '+ New update' }))
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save draft' }))
    })
    expect(create).toHaveBeenCalledWith(DEMO_DRAFT)
    expect(refresh).toHaveBeenCalled()
  })

  it('offers a reviewer Approve on an update in review, and an editor only Send to review on a draft', async () => {
    screenFor({ canWrite: false, canApprove: true }, [IN_REVIEW])
    fireEvent.click(screen.getByRole('button', { name: new RegExp(IN_REVIEW.title) }))
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Approve' }))
    })
    expect(approve).toHaveBeenCalledWith(IN_REVIEW.id)
    cleanup()

    screenFor({ canWrite: true, canApprove: false }, [{ ...IN_REVIEW, status: 'draft' }])
    fireEvent.click(screen.getByRole('button', { name: new RegExp(IN_REVIEW.title) }))
    expect(screen.queryAllByRole('button', { name: 'Approve' }).length).toBe(0)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Send to review' }))
    })
    expect(sendToReview).toHaveBeenCalledWith(IN_REVIEW.id)
  })

  it('shows a picked sample, and a writer can start a targeted update from it', () => {
    screenFor({ canWrite: true, canApprove: false })
    expect(screen.queryAllByRole('heading', { level: 2, name: SAMPLE.title }).length).toBe(0)
    fireEvent.click(sampleRow(SAMPLE.title))
    expect(sampleRow(SAMPLE.title).getAttribute('aria-current')).toBe('true')
    expect(screen.getAllByRole('heading', { level: 2, name: SAMPLE.title }).length).toBe(1)
    expect(screen.queryAllByText(EMPTY).length).toBe(0)

    fireEvent.click(screen.getByRole('button', { name: 'Create a targeted update' }))
    expect((screen.getByLabelText('Title') as HTMLInputElement).value).toBe(SAMPLE.title)
    expect((screen.getByLabelText('Body') as HTMLTextAreaElement).value).toBe(SAMPLE.body)
    expect((screen.getByLabelText('Ranked a route at') as HTMLSelectElement).value).toBe(
      SAMPLE.audience.institution,
    )
  })

  it('offers no button to a reader who cannot write', () => {
    screenFor({ canWrite: false, canApprove: true }, [IN_REVIEW])
    fireEvent.click(sampleRow(SAMPLE.title))
    expect(screen.getAllByRole('heading', { level: 2, name: SAMPLE.title }).length).toBe(1)
    expect(screen.queryAllByRole('button', { name: 'Create a targeted update' }).length).toBe(0)
  })

  it('offers even a writer no feed post made from an update, sample or stored', () => {
    screenFor({ canWrite: true, canApprove: false }, [IN_REVIEW])
    fireEvent.click(sampleRow(SAMPLE.title))
    expect(screen.queryAllByRole('link', { name: 'Make a feed post' }).length).toBe(0)
    fireEvent.click(sampleRow(IN_REVIEW.title))
    expect(screen.queryAllByRole('link', { name: 'Make a feed post' }).length).toBe(0)
  })

  it('starts on All topics, and choosing a topic changes the reach and the preview why', () => {
    screenFor({ canWrite: true, canApprove: false })
    fireEvent.click(screen.getByRole('button', { name: '+ New update' }))
    const select = screen.getByLabelText('Topic') as HTMLSelectElement
    expect(select.value).toBe(ALL_TOPICS)
    expect([...select.options].map((o) => o.value)).toEqual([ALL_TOPICS, ...TOPIC_IDS])
    expect(select.options[TOPIC_IDS.indexOf('psych') + 1].text).toBe(topicName('psych'))

    fireEvent.change(screen.getByLabelText('Ranked a route at'), {
      target: { value: ALL_INSTITUTIONS },
    })
    expect(screen.getByText(`Reaches ${MOCK_STUDENTS.length} students (mock)`)).toBeInTheDocument()

    fireEvent.change(select, { target: { value: 'psych' } })
    const psych = matchAudience(
      { institution: ALL_INSTITUTIONS, homeCountry: null, topic: 'psych' },
      MOCK_STUDENTS,
    )
    expect(psych.length).toBeGreaterThan(0)
    expect(psych.length).toBeLessThan(MOCK_STUDENTS.length)
    expect(screen.getByText(`Reaches ${psych.length} students (mock)`)).toBeInTheDocument()
    expect(
      within(screen.getByRole('region', { name: /^Student preview/ })).getByText(psych[0].why, {
        exact: false,
      }),
    ).toBeInTheDocument()
  })

  it('shows an update whose topic is unknown as such in the form, never as All topics', () => {
    const unknown = { ...SAMPLE, audience: { ...SAMPLE.audience, topic: NO_TOPIC } }
    render(
      <UpdatesScreen
        updates={[]}
        mockUpdates={[unknown]}
        students={MOCK_STUDENTS}
        canWrite
        canApprove={false}
        actions={{ create, sendToReview, approve }}
      />,
    )
    fireEvent.click(sampleRow(unknown.title))
    fireEvent.click(screen.getByRole('button', { name: 'Create a targeted update' }))
    const select = screen.getByLabelText('Topic') as HTMLSelectElement
    expect(select.value).toBe(NO_TOPIC)
    expect(select.options[select.selectedIndex].text).toBe('No topic (unknown)')
    expect(select.options[select.selectedIndex].disabled).toBe(true)
  })

  it('offers All institutions first in both institution selects', () => {
    screenFor({ canWrite: true, canApprove: false })
    fireEvent.click(screen.getByRole('button', { name: '+ New update' }))
    for (const label of ['Institution', 'Ranked a route at']) {
      const options = [...(screen.getByLabelText(label) as HTMLSelectElement).options]
      expect(options.map((o) => o.value)).toEqual([ALL_INSTITUTIONS, ...INSTITUTIONS])
    }
    fireEvent.change(screen.getByLabelText('Institution'), { target: { value: ALL_INSTITUTIONS } })
    expect(screen.getAllByText(`Reaches ${MOCK_STUDENTS.length} students (mock)`).length).toBe(1)
  })
})
