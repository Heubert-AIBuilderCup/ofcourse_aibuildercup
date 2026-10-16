import { PAID_WORK_TEXTS, PAID_WORK_TITLE } from './paid-work'
import { TWIN_TEXTS, TWIN_TITLE } from './paid-work-twin'

export type DemoSource = { key: string; title: string; kind: string; text: string }

const KIND = 'research summary'

export const DEMO_SOURCES: readonly DemoSource[] = [
  { key: 'paid-work', title: PAID_WORK_TITLE, kind: KIND, text: PAID_WORK_TEXTS.join('\n\n') },
  { key: 'paid-work-twin', title: TWIN_TITLE, kind: KIND, text: TWIN_TEXTS.join('\n\n') },
]
