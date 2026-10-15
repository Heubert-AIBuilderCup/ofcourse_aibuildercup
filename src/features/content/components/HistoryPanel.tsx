'use client'

import { useId } from 'react'
import { Button } from '@/shared/components/ui/button'
import type { Staff } from '@/shared/lib/auth/access'
import { formatWhen } from '@/shared/lib/site'
import { historyLine } from '../lib/lines'
import { actionError, restoreError, WORKFLOW_ERRORS } from '../lib/workflow'
import type { HistoryEntry } from '../server/store'
import { Control, reasonText, tag } from './parts'
import { usePostAction } from './usePostAction'
import type { WorkbenchActions, WorkbenchView } from './Workbench'

export type HistoryPanelProps = {
  view: Pick<WorkbenchView, 'id' | 'version' | 'stage' | 'current' | 'history'>
  viewer: Staff
  actions: Pick<WorkbenchActions, 'restoreVersionAction'>
}

/**
 * The post's saved text versions, newest first (criterion 101): what each changed, who saved it
 * and when, "Current" on the one the post points at, and "Restore" on the others for an editor
 * while the text may still change. Restoring points the post back at that record as a new version;
 * no record is ever changed or lost. Reviewers and admins, and anyone once the post is in review
 * or live, see the history read-only.
 */
export function HistoryPanel({ view, viewer, actions }: HistoryPanelProps) {
  const { pending, run } = usePostAction()
  const ids = useId()
  const { current } = view
  const entries = view.history ?? []
  // Past approval the revision is the text; before it, the structures record.
  const currentId = current.revision?.id ?? current.drafts?.id ?? null
  // Hidden for anyone who may not restore, and at the stages where nothing restores.
  const canRestore = actionError('restore', viewer, view.stage) === null

  const restore = (entry: HistoryEntry) =>
    run(() => actions.restoreVersionAction(view.id, view.version, entry.id), 'Version restored')

  return (
    <section aria-labelledby={`${ids}-heading`} className="flex flex-col gap-4">
      <h2 id={`${ids}-heading`} className="text-h3">
        History
      </h2>
      {entries.length === 0 ? (
        <p className={reasonText}>No versions saved yet.</p>
      ) : (
        <ol className="flex flex-col gap-4">
          {entries.map((entry) => {
            const isCurrent = entry.id === currentId
            // A structure brings back the facts and source it was drafted from (criterion 113);
            // a revision must rest on the facts the post points at.
            const sameFacts = entry.factsId === current.facts?.id
            const reason =
              restoreError(entry.kind, view.stage) ??
              (entry.kind === 'drafts' || sameFacts ? null : WORKFLOW_ERRORS.earlierFacts)
            return (
              <li key={entry.id} className="flex flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="min-w-0 wrap-anywhere">{historyLine(entry.note)}</p>
                  {isCurrent && <span className={tag}>Current</span>}
                </div>
                <p className={reasonText}>
                  {entry.by ?? 'Someone'} · {formatWhen(entry.at)}
                </p>
                {canRestore && !isCurrent && (
                  <Control reason={reason}>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pending || reason !== null}
                      onClick={() => restore(entry)}
                    >
                      Restore
                    </Button>
                    {reason === null && !sameFacts && (
                      <p className={reasonText}>Brings back the facts it was made from</p>
                    )}
                  </Control>
                )}
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}
