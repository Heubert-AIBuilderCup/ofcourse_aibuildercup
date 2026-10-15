// Where a post is in its life, and which board column shows it. The wall after the Text column
// is the text approval: nothing crosses it unapproved (AD-R1).

import { STAGES, type Stage } from '@/shared/lib/db/content-shapes'

export { STAGES, type Stage }

export const COLUMNS = [
  { id: 'structures', label: 'Structures · pick one', stages: ['source', 'structures'] },
  { id: 'approved', label: 'Approved · to render', stages: ['approved'] },
  { id: 'rendered', label: 'Rendered · edit & check', stages: ['rendered'] },
  { id: 'in_review', label: 'In review', stages: ['in_review'] },
  { id: 'ready', label: 'Ready · publish or export', stages: ['ready'] },
  { id: 'live', label: 'Live in feed · exported', stages: ['live', 'exported'] },
] as const
export type ColumnId = (typeof COLUMNS)[number]['id']

/** The column the render gate wall stands after. */
export const GATE_AFTER: ColumnId = 'structures'

export function columnOf(stage: Stage): ColumnId {
  const column = COLUMNS.find((c) => (c.stages as readonly Stage[]).includes(stage))
  if (!column) throw new Error(`No column for stage ${stage}`)
  return column.id
}

/** The step word for a status tag (Industry: "Status is one word in a tag"; GD25: never "Structures"). */
export const STAGE_LABELS: Record<Stage, string> = {
  source: 'Source',
  structures: 'Text',
  approved: 'Images',
  rendered: 'Settings',
  in_review: 'Review',
  ready: 'Review',
  live: 'Live',
  exported: 'Live',
}
