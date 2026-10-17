'use client'

import Link from 'next/link'
import { useId, useState } from 'react'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { Textarea } from '@/shared/components/ui/textarea'
import { Spin, Working } from '@/shared/components/Working'
import type { Staff } from '@/shared/lib/auth/access'
import { cn } from '@/shared/lib/utils'
import { boardBackHref } from '../lib/board'
import { ACTION_STAGES, actionError, exportError, WORKFLOW_ERRORS } from '../lib/workflow'
import type { Pointers } from '../model/artifacts'
import type { CurrentPost } from '../model/current'
import { STAGE_LABELS, type Stage } from '../model/stages'
import type { PersonStamp } from '../model/types'
import { Control, RenderedSlides, tag } from './parts'
import { SlidePreview, slideWords } from './SlidePreview'
import { usePressedAction } from './usePostAction'
import { useRefreshWhileRunning } from './useRefreshWhileRunning'
import type { WorkbenchActions } from './Workbench'

export type SocialView = {
  id: string
  title: string
  stage: Stage
  version: number
  pointers: Pointers
  current: CurrentPost
  /** The steps running on this post now (server/steps.ts runningSteps). */
  running: string[]
  /** The steps whose last run failed (server/steps.ts failedSteps). */
  failed?: string[]
  /** The feed post this version was adapted from. */
  parentTitle: string
  /** The zip's name, from layout/zip.ts exportName on the server. */
  fileName: string
  /** Where the exported Instagram version was posted, and who added the link (criterion 89). */
  socialLink: { url: string; by: PersonStamp } | null
}

export type SocialWorkbenchProps = {
  view: SocialView
  viewer: Staff
  /** The board's filters it was opened from, as lib/board.ts boardFrom keeps them. */
  from: string
  actions: Pick<
    WorkbenchActions,
    | 'approveLayoutAction'
    | 'renderSocialAction'
    | 'editCaptionAction'
    | 'checkCaptionAction'
    | 'resetCaptionAction'
    | 'markExportedAction'
    | 'recordPostUrlAction'
  >
}

const reasonText = 'text-caption text-muted-foreground'
const hashtagsOf = (text: string) => text.split(/\s+/).filter(Boolean)

/** A control shown to whoever may run it, with its refusal beside it; hidden from anyone who may not. */
function shown(action: keyof typeof ACTION_STAGES, viewer: Staff, stage: Stage) {
  const gate = actionError(action, viewer, stage)
  return {
    gate,
    visible: gate !== WORKFLOW_ERRORS.notAuthorised && ACTION_STAGES[action].includes(stage),
  }
}

/**
 * A social version (criteria 63–68): the feed post's facts, locked; the layout in the page brand
 * with "Quick approve layout", then "Render"; the caption and hashtags, with the source check and
 * "Reset to approved wording"; and "Export", unavailable while the caption is unchecked or has
 * unsaved changes. Export downloads the stored files; nothing is posted anywhere.
 */
export function SocialWorkbench({ view, viewer, from, actions }: SocialWorkbenchProps) {
  const ids = useId()
  // Which press is running, so only its control waits as "Running…" with its words beside it.
  const { pending, run, pressed } = usePressedAction<'render' | 'check'>()
  useRefreshWhileRunning(view.running.length > 0)
  const { layout, render, caption } = view.current
  const [text, setText] = useState(caption?.body.text ?? '')
  const [tags, setTags] = useState(caption?.body.hashtags.join(' ') ?? '')
  const [url, setUrl] = useState('')

  const approve = shown('socialApproveLayout', viewer, view.stage)
  const link = shown('socialLink', viewer, view.stage)
  const renderStep = shown('socialRender', viewer, view.stage)
  const edit = shown('socialCaption', viewer, view.stage)
  const check = shown('socialCheck', viewer, view.stage)
  const reset = shown('socialReset', viewer, view.stage)
  const exporting = shown('socialExport', viewer, view.stage)

  const rendering = view.running.includes('render') || pressed('render')
  const checking = view.running.includes('caption_check') || pressed('check')
  const hashtags = hashtagsOf(tags)
  const dirty =
    caption !== null &&
    (text !== caption.body.text || hashtags.join(' ') !== caption.body.hashtags.join(' '))
  const approvedWording =
    caption?.body.checked &&
    caption.body.text === caption.body.approvedText &&
    caption.body.hashtags.join(' ') === caption.body.approvedHashtags.join(' ')
  const exportReason =
    exporting.gate ?? (dirty ? WORKFLOW_ERRORS.captionCheck : exportError(view.current))
  const exportUrl = `/admin/posts/${encodeURIComponent(view.id)}/export`
  const platform = view.pointers.social?.platform ?? caption?.body.platform ?? 'instagram'

  return (
    <div className="workbench flex min-w-0 flex-col gap-8">
      <div className="flex flex-col gap-4">
        <Link
          href={boardBackHref(from)}
          className="self-start text-caption text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          ← Board
        </Link>
        <div className="flex items-start justify-between gap-4">
          <h1 className="min-w-0 text-h1 wrap-anywhere">{view.title}</h1>
          <span className={cn(tag, 'shrink-0')}>{STAGE_LABELS[view.stage]}</span>
        </div>
        <p className={reasonText}>{`Facts locked · from feed post ${view.parentTitle}`}</p>
      </div>

      <section aria-labelledby={`${ids}-slides`} className="flex flex-col gap-6">
        <h2 id={`${ids}-slides`} className="text-h3">
          {render ? 'Slides' : 'Layout'}
        </h2>
        {render ? (
          <RenderedSlides render={render.body} layout={layout?.body.slides} />
        ) : layout ? (
          <div className="grid grid-cols-3 gap-2">
            {layout.body.slides.map((laid, i) => (
              <SlidePreview
                // biome-ignore lint/suspicious/noArrayIndexKey: a slide is its position in the layout.
                key={i}
                slide={i + 1}
                layout={{ postId: view.id, layoutId: layout.id }}
                text={slideWords(laid)}
              />
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground">No layout yet.</p>
        )}
        {approve.visible && (
          <Control reason={approve.gate}>
            <Button
              disabled={pending || approve.gate !== null}
              onClick={() =>
                run(() => actions.approveLayoutAction(view.id, view.version), 'Layout approved')
              }
            >
              Quick approve layout
            </Button>
          </Control>
        )}
        {renderStep.visible && (
          <Control reason={renderStep.gate}>
            {rendering ? (
              <Button disabled>
                <Spin />
                Running…
              </Button>
            ) : (
              <Button
                disabled={pending || renderStep.gate !== null}
                onClick={() =>
                  run(
                    () => actions.renderSocialAction(view.id, view.version),
                    `Rendered · ${layout?.body.slides.length ?? 0} slides`,
                    { press: 'render' },
                  )
                }
              >
                Render
              </Button>
            )}
          </Control>
        )}
        {pressed('render') && <Working words="Writing the caption and drawing the cover…" />}
      </section>

      {caption && (
        <section aria-labelledby={`${ids}-caption`} className="flex flex-col gap-4">
          <h2 id={`${ids}-caption`} className="text-h3">
            {platform === 'linkedin' ? 'Post text' : 'Caption and hashtags'}
          </h2>
          <div className="flex flex-col gap-2">
            <Label htmlFor={`${ids}-text`}>Caption</Label>
            <Textarea
              id={`${ids}-text`}
              value={text}
              rows={8}
              maxLength={5000}
              readOnly={!edit.visible}
              onChange={(e) => setText(e.target.value)}
            />
          </div>
          {platform === 'instagram' && (
            <div className="flex flex-col gap-2">
              <Label htmlFor={`${ids}-tags`}>Hashtags</Label>
              <Input
                id={`${ids}-tags`}
                value={tags}
                maxLength={600}
                readOnly={!edit.visible}
                onChange={(e) => setTags(e.target.value)}
              />
            </div>
          )}
          {caption.body.notFound.length > 0 && (
            <div className="flex flex-col gap-1 text-destructive">
              <p className="text-overline uppercase">Not found in the source</p>
              <ul className="flex flex-col gap-1 text-caption">
                {caption.body.notFound.map((sentence) => (
                  <li key={sentence}>{sentence}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-3">
            {edit.visible && (
              <Button
                variant="outline"
                disabled={pending || !dirty || edit.gate !== null}
                onClick={() =>
                  run(
                    () => actions.editCaptionAction(view.id, view.version, text, hashtags),
                    'Caption saved',
                  )
                }
              >
                Save caption
              </Button>
            )}
            {check.visible &&
              (checking ? (
                <Button variant="outline" disabled>
                  <Spin />
                  Running…
                </Button>
              ) : (
                <Button
                  variant="outline"
                  disabled={pending || dirty || check.gate !== null}
                  onClick={() =>
                    run(
                      () => actions.checkCaptionAction(view.id, view.version),
                      'Source check done',
                      { press: 'check' },
                    )
                  }
                >
                  Run source check
                </Button>
              ))}
            {reset.visible && (
              <Button
                variant="outline"
                disabled={pending || approvedWording || reset.gate !== null}
                onClick={() =>
                  run(
                    () => actions.resetCaptionAction(view.id, view.version),
                    'Approved wording restored',
                  )
                }
              >
                Reset to approved wording
              </Button>
            )}
          </div>
          {pressed('check') && <Working words="Checking the caption against the source…" />}
          {exporting.visible && (
            <Control reason={exportReason}>
              <Button
                disabled={pending || exportReason !== null}
                onClick={() =>
                  run(
                    () => actions.markExportedAction(view.id, view.version),
                    `Exported · ${view.fileName}`,
                    { onDone: () => window.location.assign(exportUrl) },
                  )
                }
              >
                Export
              </Button>
            </Control>
          )}
          {view.stage === 'exported' && view.current.export && (
            <a href={exportUrl} className="self-start text-caption underline underline-offset-4">
              {`Download ${view.current.export.body.fileName}`}
            </a>
          )}
          {link.visible && platform === 'instagram' && view.current.export && (
            // After posting by hand (ADR-033): the post's link, kept as its own record (criterion 89).
            <div className="flex flex-col gap-2">
              <Label htmlFor={`${ids}-link`}>Instagram link</Label>
              <div className="flex flex-wrap items-center gap-3">
                <Input
                  id={`${ids}-link`}
                  type="url"
                  value={url}
                  maxLength={2048}
                  placeholder="https://www.instagram.com/p/…"
                  className="max-w-md"
                  onChange={(e) => setUrl(e.target.value)}
                />
                <Button
                  variant="outline"
                  disabled={pending || url.trim() === '' || link.gate !== null}
                  onClick={() =>
                    run(
                      () => actions.recordPostUrlAction(view.id, view.version, url.trim()),
                      'Link saved',
                      { onDone: () => setUrl('') },
                    )
                  }
                >
                  Save link
                </Button>
              </div>
            </div>
          )}
          {view.socialLink && (
            <p className={reasonText}>
              Posted:{' '}
              <a
                href={view.socialLink.url}
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-4"
              >
                {view.socialLink.url}
              </a>
              {` · by ${view.socialLink.by.name}`}
            </p>
          )}
        </section>
      )}
    </div>
  )
}
