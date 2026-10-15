/// <reference lib="dom" />
/// <reference path="../../../../node_modules/@testing-library/jest-dom/types/bun.d.ts" />
import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import * as navigation from 'next/navigation'
import { MOCK_STUDENTS, MOCK_UPDATES } from '..'
import { matchAudience } from '../lib/audience'
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

const reach = (institution: string, homeCountry: string | null) =>
  matchAudience({ institution, homeCountry }, MOCK_STUDENTS)

describe('UpdatesScreen', () => {
  it('lists the mock live updates, labelled mock, and offers the empty state', () => {
    screenFor({ canWrite: false, canApprove: false })
    for (const m of MOCK_UPDATES) expect(screen.getByText(m.title)).toBeInTheDocument()
    expect(screen.getAllByText('Mock').length).toBe(MOCK_UPDATES.length)
    expect(screen.getByText('Create a targeted update')).toBeInTheDocument()
    expect(screen.queryAllByRole('button', { name: '+ New update' }).length).toBe(0)
  })

  it('as the editor changes the rule, the reach and the preview follow it', () => {
    screenFor({ canWrite: true, canApprove: false })
    fireEvent.click(screen.getByRole('button', { name: '+ New update' }))
    const ecu = reach('ECU', null)
    expect(screen.getByText(`Reaches ${ecu.length} students (mock)`)).toBeInTheDocument()
    const preview = within(screen.getByRole('region', { name: /feed$/ }))
    expect(screen.getByRole('region', { name: "In Priya's feed" })).toBeInTheDocument()
    expect(preview.getByText(/Because you ranked ECU Cyber Security/)).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Home country'), { target: { value: 'India' } })
    const india = reach('ECU', 'India')
    expect(screen.getByText(`Reaches ${india.length} students (mock)`)).toBeInTheDocument()
    expect(
      screen.getByRole('region', { name: `In ${india[0].student.name}'s feed` }),
    ).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Ranked a route at'), { target: { value: 'Monash' } })
    const monash = reach('Monash', 'India')
    expect(screen.getByText(`Reaches ${monash.length} students (mock)`)).toBeInTheDocument()
    expect(
      within(screen.getByRole('region', { name: /feed$/ })).getByText(monash[0].why, {
        exact: false,
      }),
    ).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Monash data grant' } })
    expect(
      within(screen.getByRole('region', { name: /feed$/ })).getByText('Monash data grant'),
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
})
