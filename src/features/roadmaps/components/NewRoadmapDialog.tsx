'use client'

import { useRouter } from 'next/navigation'
import { useId, useState } from 'react'
import { Note } from '@/shared/components/Note'
import { Button } from '@/shared/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@/shared/components/ui/dialog'
import { newRoadmapPath, PICTURE_PATH } from '@/shared/lib/student-paths'
import { cn } from '@/shared/lib/utils'
import type { ActionResult } from '@/shared/types/action-result'
import styles from './roadmaps.module.css'

type Choice = 'copy' | 'scratch'

type Props = {
  open: boolean
  /** Hers, in the list's order; the first is the one copied unless she picks another. */
  roadmaps: { id: string; name: string }[]
  onOpenChange: (open: boolean) => void
  startFromScratchAction: () => Promise<ActionResult>
  onCloseAutoFocus: (event: Event) => void
}

const TITLE = 'How do you want to start?'

const CHOICES: { value: Choice; title: string; description: string }[] = [
  {
    value: 'copy',
    title: 'Copy a roadmap and change some answers',
    description: 'Quickest. It starts with the same answers; you change only what’s different.',
  },
  {
    value: 'scratch',
    title: 'Start from scratch',
    description:
      'Answer every question again, from your character to your ten coins. About 8 minutes.',
  },
]

/**
 * New roadmap: copy one of hers (the default; on to its draft) or start from scratch (a new roadmap
 * to answer, from onboarding's first question). Escape and Cancel close it.
 */
export function NewRoadmapDialog({
  open,
  roadmaps,
  onOpenChange,
  startFromScratchAction,
  onCloseAutoFocus,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        aria-describedby={undefined}
        onCloseAutoFocus={onCloseAutoFocus}
        className={styles.dialog}
      >
        <NewRoadmapForm
          roadmaps={roadmaps}
          startFromScratchAction={startFromScratchAction}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  )
}

/** Inside the dialog's content, so each opening starts on copying the first roadmap. */
function NewRoadmapForm({
  roadmaps,
  startFromScratchAction,
  onCancel,
}: Pick<Props, 'roadmaps' | 'startFromScratchAction'> & { onCancel: () => void }) {
  const router = useRouter()
  const id = useId()
  const [choice, setChoice] = useState<Choice>('copy')
  const [fromId, setFromId] = useState(roadmaps[0]?.id ?? '')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function go() {
    if (busy) return
    if (choice === 'copy') {
      router.replace(newRoadmapPath(fromId))
      return
    }
    setBusy(true)
    setError(null)
    const result = await startFromScratchAction()
    if (result.ok) {
      router.replace(PICTURE_PATH)
      return
    }
    setError(result.error)
    setBusy(false)
  }

  return (
    <>
      <div className={cn(styles.dialogBody, 'gap-4')}>
        <div className="flex flex-col gap-1">
          <p className="m-0 font-heading text-overline font-medium text-muted-foreground uppercase">
            New roadmap
          </p>
          <DialogTitle className="m-0 font-heading text-h2 font-semibold">{TITLE}</DialogTitle>
        </div>

        <div role="radiogroup" aria-label={TITLE} className="flex flex-col gap-3">
          {CHOICES.map((c) => (
            <label
              key={c.value}
              className="flex cursor-pointer items-start gap-3.5 border border-foreground/25 px-4.5 py-4 hover:border-foreground has-checked:border-primary has-checked:ring-1 has-checked:ring-primary has-checked:ring-inset has-checked:bg-accent-100 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-primary"
            >
              <input
                type="radio"
                name={`${id}-choice`}
                value={c.value}
                checked={choice === c.value}
                onChange={() => setChoice(c.value)}
                aria-labelledby={`${id}-${c.value}`}
                aria-describedby={`${id}-${c.value}-d`}
                className="peer sr-only"
              />
              <span aria-hidden="true" className={cn(styles.dot, 'mt-0.5')} />
              <span className="flex flex-col gap-1">
                <span id={`${id}-${c.value}`} className="font-heading text-h4 font-semibold">
                  {c.title}
                </span>
                <span id={`${id}-${c.value}-d`} className="text-muted-foreground">
                  {c.description}
                </span>
              </span>
            </label>
          ))}
        </div>

        {choice === 'copy' ? (
          <div className={cn(styles.fromPick, 'flex flex-col gap-2')}>
            <p id={`${id}-from`} className="m-0 text-caption font-medium text-muted-foreground">
              Copy which roadmap?
            </p>
            <div role="radiogroup" aria-labelledby={`${id}-from`} className="flex flex-col">
              {roadmaps.map((r) => (
                <label
                  key={r.id}
                  className="flex min-h-11 cursor-pointer items-center gap-3 border-t border-border px-3 last:border-b has-checked:font-semibold has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-primary"
                >
                  <input
                    type="radio"
                    name={`${id}-from`}
                    value={r.id}
                    checked={fromId === r.id}
                    onChange={() => setFromId(r.id)}
                    className="peer sr-only"
                  />
                  <span aria-hidden="true" className={styles.dot} />
                  <span>{r.name}</span>
                </label>
              ))}
            </div>
          </div>
        ) : null}

        {error ? (
          <Note tone="limit" role="alert">
            {error}
          </Note>
        ) : null}
      </div>

      <div className={styles.actions}>
        <Button type="button" variant="outline" size="lg" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          type="button"
          variant="strong"
          size="lg"
          aria-disabled={busy}
          aria-busy={busy}
          onClick={go}
        >
          {choice === 'copy' ? 'Copy and change answers' : 'Start the questions'}
        </Button>
      </div>
    </>
  )
}
