import { describe, expect, it } from 'bun:test'
import { getRoad } from './road-data'
import { lessonById, panelAt, routeStep } from './routes'

const road = getRoad()

describe('lessonById', () => {
  it('finds the road’s lesson by its id', () => {
    expect(lessonById(road, 'masters-years')?.title).toBe('The Master’s years, in 3 minutes')
  })

  it('gives null for an id the road has no lesson for', () => {
    expect(lessonById(road, 'masters')).toBeNull()
    expect(lessonById(road, '')).toBeNull()
  })
})

describe('routeStep', () => {
  it('finds the step a route id names', () => {
    expect(routeStep(road, 'student-visa-500')?.id).toBe('student-visa-500')
    expect(routeStep(road, 'masters-cyber-security-ecu')?.name).toBe('Master’s · Cyber Security')
  })

  it('gives null for a tile that is not a route step, or an unknown id', () => {
    expect(routeStep(road, 'perth')).toBeNull()
    expect(routeStep(road, 'nowhere')).toBeNull()
  })
})

describe('panelAt', () => {
  it('reads the lesson or the route step from the segments below /road', () => {
    expect(panelAt(road, ['learn', 'masters-years'])).toEqual({
      kind: 'lesson',
      lesson: road.lesson,
    })
    expect(panelAt(road, ['route', 'student-visa-500'])).toEqual({
      kind: 'route',
      step: routeStep(road, 'student-visa-500') as NonNullable<ReturnType<typeof routeStep>>,
    })
  })

  it('gives null at /road, and for an id the road does not know', () => {
    expect(panelAt(road, [])).toBeNull()
    expect(panelAt(road, ['learn', 'masters'])).toBeNull()
    expect(panelAt(road, ['route', 'perth'])).toBeNull()
    expect(panelAt(road, ['elsewhere', 'masters-years'])).toBeNull()
  })
})
