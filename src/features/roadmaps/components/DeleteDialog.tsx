'use client'

import { useState } from 'react'
import { Note } from '@/shared/components/Note'
import { Button } from '@/shared/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/shared/components/ui/dialog'
import { cn } from '@/shared/lib/utils'
import type { ActionResult } from '@/shared/types/action-result'
import styles from './roadmaps.module.css'

type Props = {
  open: boolean
  name: string
  onOpenChange: (open: boolean) => void
  /** Deletes it; the dialog stays and says why when refused. */
  onConfirm: () => Promise<ActionResult>
  onCloseAutoFocus: (event: Event) => void
}

/** Delete, asked first: what goes and what stays. Keep it and Escape close it. */
export function DeleteDialog({ open, name, onOpenChange, onConfirm, onCloseAutoFocus }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onCloseAutoFocus={onCloseAutoFocus}
        className={cn(styles.dialog, styles.dialogSm)}
      >
        <div className={cn(styles.dialogBody, 'gap-4')}>
          <DialogTitle className="m-0 font-heading text-h2 font-semibold">
            Delete “{name}”?
          </DialogTitle>
          <DialogDescription className="m-0 text-lead text-muted-foreground">
            Its answers and its board go with it. Your other roadmaps stay as they are.
          </DialogDescription>
        </div>
        <Confirm onConfirm={onConfirm} onCancel={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  )
}

function Confirm({ onConfirm, onCancel }: { onConfirm: Props['onConfirm']; onCancel: () => void }) {
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function confirm() {
    if (busy) return
    setBusy(true)
    setError(null)
    const result = await onConfirm()
    if (!result.ok) {
      setError(result.error)
      setBusy(false)
    }
  }

  return (
    <>
      {error ? (
        <Note tone="limit" role="alert">
          {error}
        </Note>
      ) : null}
      <div className={styles.actions}>
        <Button type="button" variant="outline" size="lg" onClick={onCancel}>
          Keep it
        </Button>
        <Button
          type="button"
          variant="strong"
          size="lg"
          aria-disabled={busy}
          aria-busy={busy}
          onClick={confirm}
          className="border-destructive bg-destructive text-destructive-foreground hover:border-destructive hover:bg-destructive/90 active:bg-destructive"
        >
          Delete
        </Button>
      </div>
    </>
  )
}
