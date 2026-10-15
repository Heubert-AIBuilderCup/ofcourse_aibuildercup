'use client'

import { type FormEvent, useState } from 'react'
import { Note } from '@/shared/components/Note'
import { Button } from '@/shared/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@/shared/components/ui/dialog'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { cn } from '@/shared/lib/utils'
import type { ActionResult } from '@/shared/types/action-result'
import { ROADMAP_NAME_MAX } from '@/shared/types/student'
import styles from './roadmaps.module.css'

type Props = {
  open: boolean
  name: string
  onOpenChange: (open: boolean) => void
  /** Saves the name; the dialog stays and says why when refused. */
  onSave: (name: string) => Promise<ActionResult>
  onCloseAutoFocus: (event: Event) => void
}

/** Rename: her name for a roadmap, at most 60 characters. Escape and Cancel close it unsaved. */
export function RenameDialog({ open, name, onOpenChange, onSave, onCloseAutoFocus }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        aria-describedby={undefined}
        onCloseAutoFocus={onCloseAutoFocus}
        className={cn(styles.dialog, styles.dialogSm)}
      >
        <DialogTitle className="m-0 font-heading text-h2 font-semibold">Rename roadmap</DialogTitle>
        <RenameForm name={name} onSave={onSave} onCancel={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  )
}

/** Inside the dialog's content, so each opening starts from her current name. */
function RenameForm({
  name,
  onSave,
  onCancel,
}: {
  name: string
  onSave: Props['onSave']
  onCancel: () => void
}) {
  const [value, setValue] = useState(name)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError(null)
    const result = await onSave(value)
    // On success the dialog closes; only a refusal stays to be read.
    if (!result.ok) {
      setError(result.error)
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="flex min-h-0 flex-col gap-2">
      <div className={cn(styles.dialogBody, 'gap-2')}>
        <Label htmlFor="rename-roadmap">Name</Label>
        <Input
          id="rename-roadmap"
          type="text"
          value={value}
          maxLength={ROADMAP_NAME_MAX}
          onChange={(event) => setValue(event.target.value)}
          className="h-12 border-foreground px-3.5 text-lead"
        />
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
        <Button type="submit" variant="strong" size="lg" aria-disabled={busy} aria-busy={busy}>
          Save
        </Button>
      </div>
    </form>
  )
}
