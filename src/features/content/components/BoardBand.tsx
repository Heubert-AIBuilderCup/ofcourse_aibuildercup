'use client'

import { useRouter } from 'next/navigation'
import { AdminBand } from '@/features/admin/components/AdminBand'
import { type BoardParams, boardHref, MINE_COLUMNS, type MineColumn } from '../lib/board'
import { useBoardHighlight } from './BoardHighlight'

const LABELS: Record<MineColumn, (n: number) => string> = {
  structures: (n) => (n === 1 ? 'structure to pick' : 'structures to pick'),
  in_review: () => 'in review',
  ready: () => 'ready to publish',
}

/**
 * The board's band: the viewer's own posts in the three columns where they have to act, whatever
 * the filters show. Pressing a number turns the Assignee filter to Mine on the All tab, keeping
 * the other filters, and lights its column up.
 */
export function BoardBand({
  name,
  mine,
  params,
}: {
  name: string | undefined
  mine: Record<MineColumn, number>
  params: BoardParams
}) {
  const router = useRouter()
  const { highlight } = useBoardHighlight()
  const firstName = name?.trim().split(/\s+/)[0]
  const total = MINE_COLUMNS.reduce((sum, id) => sum + mine[id], 0)
  return (
    <AdminBand
      duck
      kicker={firstName ? `Assigned to you, ${firstName}` : 'Assigned to you'}
      title={`${total} of your posts ${total === 1 ? 'needs' : 'need'} you`}
      stats={MINE_COLUMNS.map((id) => ({
        value: mine[id],
        label: LABELS[id](mine[id]),
        onSelect: () => {
          router.replace(boardHref({ ...params, filter: 'all', assignee: 'mine' }), {
            scroll: false,
          })
          highlight(id)
        },
      }))}
    />
  )
}
