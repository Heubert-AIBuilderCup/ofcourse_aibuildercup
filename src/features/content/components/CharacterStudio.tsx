'use client'

import { useRouter } from 'next/navigation'
import { useId, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Blueprint } from '@/shared/components/Blueprint'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { Textarea } from '@/shared/components/ui/textarea'
import { Spin, Working } from '@/shared/components/Working'
import { canEdit, type Staff } from '@/shared/lib/auth/access'
import type { ActionResult } from '@/shared/types/action-result'
import type { CharacterView } from '../ai/character'
import type { Character } from '../server/character'
import { Control, reasonText, tag } from './parts'

const NETWORK_ERROR = 'Could not reach the server. Please try again.'
/** The description "Plan the sheet" starts from: no digits, so the art prompt guard passes it. */
const DEFAULT_DESCRIPTION = 'A gender-neutral student in their early twenties, casual clothes'

type Busy = 'plan' | 'view' | 'draw' | 'redraw' | 'approve'

export type CharacterStudioProps = {
  viewer: Staff
  character: Character | null
  /** The page passes the server actions by name. */
  actions: {
    planCharacterAction: (input: unknown) => Promise<ActionResult>
    editCharacterViewAction: (input: unknown) => Promise<ActionResult>
    drawCharacterAction: (input: unknown) => Promise<ActionResult>
    approveCharacterAction: () => Promise<ActionResult>
  }
}

/**
 * The comic character (RC9): the description, "Plan the sheet", the planned views as a storyboard
 * of cards, each label and scene editable, "Draw the sheet", the drawn sheet with "Redraw with a
 * note" and "Approve this character", and beside it the sheet approved for panels. Editors act;
 * everyone else who may see the Board reads. The server checks every step again.
 */
export function CharacterStudio({ viewer, character, actions }: CharacterStudioProps) {
  const ids = useId()
  const router = useRouter()
  const editable = canEdit(viewer)
  const [pending, startTransition] = useTransition()
  const [busy, setBusy] = useState<Busy | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [description, setDescription] = useState(character?.description ?? DEFAULT_DESCRIPTION)
  const [note, setNote] = useState('')

  /** Runs one action: a toast when it lands, its refusal beside the controls, the page refreshed. */
  const run = (
    step: Busy,
    work: () => Promise<ActionResult>,
    success: string,
    done?: () => void,
  ) => {
    setBusy(step)
    setError(null)
    startTransition(async () => {
      try {
        const res = await work()
        if (res.ok) {
          toast.success(success)
          done?.()
        } else {
          setError(res.error)
        }
      } catch {
        setError(NETWORK_ERROR)
      }
      router.refresh()
    })
  }

  const views = character?.views ?? []
  const sheet = character?.sheetAssetId ?? null
  const approved = character?.approvedAssetId ?? null
  const spin = (step: Busy) => pending && busy === step && <Spin />
  // The one filled button is the next step on the way to an approved sheet; the rest are outlined.
  const next: Busy | null =
    views.length === 0 ? 'plan' : !sheet ? 'draw' : sheet !== approved ? 'approve' : null
  const variant = (step: Busy) => (next === step ? 'default' : 'outline')

  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby={`${ids}-who`} className="flex max-w-2xl flex-col gap-4">
        <h2 id={`${ids}-who`} className="text-h3">
          Character
        </h2>
        {editable ? (
          <div className="flex flex-col gap-2">
            <Label htmlFor={`${ids}-description`}>Description</Label>
            <Input
              id={`${ids}-description`}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <Button
              variant={variant('plan')}
              className="self-start"
              disabled={pending || description.trim() === ''}
              onClick={() =>
                run('plan', () => actions.planCharacterAction({ description }), 'Sheet planned')
              }
            >
              {spin('plan')}
              Plan the sheet
            </Button>
            {pending && busy === 'plan' && <Working words="Planning the character…" />}
          </div>
        ) : (
          <p>{character?.description ?? 'No character yet.'}</p>
        )}
      </section>

      <section aria-labelledby={`${ids}-views`} className="flex flex-col gap-4">
        <h2 id={`${ids}-views`} className="text-h3">
          Views
        </h2>
        {views.length > 0 ? (
          <ol className="grid grid-cols-[repeat(auto-fit,minmax(16rem,1fr))] gap-6">
            {views.map((v, i) => (
              // The card's key carries its saved words, so a refreshed view starts from them.
              // biome-ignore lint/suspicious/noArrayIndexKey: a view is its place on the sheet.
              <li key={`${i}-${v.label}-${v.scene}`}>
                <ViewCard
                  n={i + 1}
                  view={v}
                  editable={editable}
                  disabled={pending}
                  onSave={(label, scene) =>
                    run(
                      'view',
                      () => actions.editCharacterViewAction({ index: i, label, scene }),
                      'View saved',
                    )
                  }
                />
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-muted-foreground">No views yet.</p>
        )}
      </section>

      <section aria-labelledby={`${ids}-sheet`} className="flex flex-col gap-4">
        <h2 id={`${ids}-sheet`} className="text-h3">
          Sheet
        </h2>
        {(sheet || approved) && (
          <div className="grid grid-cols-[repeat(auto-fit,minmax(20rem,1fr))] gap-6">
            {sheet && (
              <SheetFigure
                assetId={sheet}
                alt="The drawn sheet"
                caption={character?.sheetNote ? `Redrawn with: ${character.sheetNote}` : 'Drawn'}
                tagged={sheet === approved}
              />
            )}
            {approved && approved !== sheet && (
              <SheetFigure assetId={approved} alt="The approved sheet" caption="In use" tagged />
            )}
          </div>
        )}
        {!sheet && !approved && <p className="text-muted-foreground">No sheet yet.</p>}

        {editable && (
          <div className="flex flex-col gap-4">
            <Control reason={views.length === 0 ? 'Plan the character first.' : null}>
              <Button
                variant={variant('draw')}
                disabled={pending || views.length === 0}
                onClick={() =>
                  run('draw', () => actions.drawCharacterAction({ note: null }), 'Sheet drawn')
                }
              >
                {spin('draw')}
                Draw the sheet
              </Button>
            </Control>
            {pending && busy === 'draw' && <Working words="Drawing the character sheet…" />}
            {sheet && (
              <div className="flex max-w-2xl flex-col gap-2">
                <Label htmlFor={`${ids}-note`}>Note</Label>
                <Input id={`${ids}-note`} value={note} onChange={(e) => setNote(e.target.value)} />
                <Button
                  variant="outline"
                  className="self-start"
                  disabled={pending || note.trim() === ''}
                  onClick={() =>
                    run(
                      'redraw',
                      () => actions.drawCharacterAction({ note }),
                      'Sheet redrawn',
                      () => setNote(''),
                    )
                  }
                >
                  {spin('redraw')}
                  Redraw with a note
                </Button>
                {pending && busy === 'redraw' && <Working words="Drawing the character sheet…" />}
              </div>
            )}
            <Control reason={sheet ? null : 'Draw the character first.'}>
              <Button
                variant={variant('approve')}
                disabled={pending || !sheet || sheet === approved}
                onClick={() => run('approve', actions.approveCharacterAction, 'Character approved')}
              >
                {spin('approve')}
                Approve this character
              </Button>
            </Control>
          </div>
        )}
        {error && (
          <p role="alert" className="text-caption text-destructive">
            {error}
          </p>
        )}
      </section>
    </div>
  )
}

/** One view of the sheet: its label and scene, edited on the card by an editor. */
function ViewCard({
  n,
  view,
  editable,
  disabled,
  onSave,
}: {
  n: number
  view: CharacterView
  editable: boolean
  disabled: boolean
  onSave: (label: string, scene: string) => void
}) {
  const ids = useId()
  const [label, setLabel] = useState(view.label)
  const [scene, setScene] = useState(view.scene)
  const changed = label !== view.label || scene !== view.scene

  return (
    <Blueprint as="article" aria-label={`View ${n}`} className="flex h-full flex-col gap-3 p-4">
      {editable ? (
        <>
          <div className="flex flex-col gap-2">
            <Label htmlFor={`${ids}-label`}>Label</Label>
            <Input id={`${ids}-label`} value={label} onChange={(e) => setLabel(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor={`${ids}-scene`}>Scene</Label>
            <Textarea
              id={`${ids}-scene`}
              value={scene}
              rows={4}
              onChange={(e) => setScene(e.target.value)}
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            className="self-start"
            disabled={disabled || !changed}
            onClick={() => onSave(label, scene)}
          >
            Save view
          </Button>
        </>
      ) : (
        <>
          <h3 className="text-h4">{view.label}</h3>
          <p>{view.scene}</p>
        </>
      )}
    </Blueprint>
  )
}

/** A stored sheet behind the session, square and hairline-framed, "Approved" when panels use it. */
function SheetFigure({
  assetId,
  alt,
  caption,
  tagged,
}: {
  assetId: string
  alt: string
  caption: string
  tagged: boolean
}) {
  return (
    <figure className="flex flex-col gap-2">
      {/* biome-ignore lint/performance/noImgElement: next/image would re-encode a staff-only asset. */}
      <img
        src={`/admin/assets/${encodeURIComponent(assetId)}`}
        alt={alt}
        className="block aspect-square w-full border object-cover"
      />
      <figcaption className="flex flex-wrap items-center gap-3">
        {tagged && <span className={tag}>Approved</span>}
        <span className={reasonText}>{caption}</span>
      </figcaption>
    </figure>
  )
}
