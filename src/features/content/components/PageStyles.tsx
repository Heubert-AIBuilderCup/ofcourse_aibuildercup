'use client'

import { ImageIcon, Sparkles } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useId, useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/shared/components/ui/button'
import { Label } from '@/shared/components/ui/label'
import { NativeSelect } from '@/shared/components/ui/native-select'
import { Textarea } from '@/shared/components/ui/textarea'
import { Spin, Working } from '@/shared/components/Working'
import { canEdit, type Staff } from '@/shared/lib/auth/access'
import { cn } from '@/shared/lib/utils'
import type { ActionResult } from '@/shared/types/action-result'
import type { DesignFields } from '../ai/design-language'
import { PAGE_BRANDS } from '../brands'
import { PAGE_STYLE_ERRORS, REFERENCE_TYPES, REFERENCES_MAX, STYLE_MAX } from '../lib/page-style'
import type { Brand } from '../model/types'
import type { PageStyle } from '../server/page-style'
import { TEMPLATES } from '../templates'
import { reasonText, tag } from './parts'
import { usePress } from './usePostAction'

const NETWORK_ERROR = 'Could not reach the server. Please try again.'

export type PageStylesProps = {
  viewer: Staff
  /** Each page's saved design language, by brand id; a page with none is absent. */
  styles: Record<string, PageStyle>
  /** The page passes the server actions by name. */
  actions: {
    uploadReferenceAction: (data: unknown) => Promise<ActionResult<{ assetId: string }>>
    describePageStyleAction: (
      brandId: unknown,
      ids: unknown,
    ) => Promise<ActionResult<{ fields: DesignFields }>>
    savePageStyleAction: (input: unknown) => Promise<ActionResult>
  }
}

/**
 * Page styles (criterion 105): one card per page brand with its design language. An editor
 * uploads one or two reference images, has them described, edits the three fields and saves;
 * everyone else who may see the Board reads them. The server checks every image and field again.
 */
export function PageStyles({ viewer, styles, actions }: PageStylesProps) {
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(min(24rem,100%),1fr))] gap-8">
      {PAGE_BRANDS.map((brand) => (
        <PageStyleCard
          key={brand.id}
          brand={brand}
          style={styles[brand.id] ?? null}
          editable={canEdit(viewer)}
          actions={actions}
        />
      ))}
    </div>
  )
}

type CardProps = {
  brand: Brand
  style: PageStyle | null
  editable: boolean
  actions: PageStylesProps['actions']
}

function PageStyleCard({ brand, style, editable, actions }: CardProps) {
  const ids = useId()
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [refs, setRefs] = useState<string[]>(style?.referenceAssetIds ?? [])
  const [artStyle, setArtStyle] = useState(style?.artStyle ?? '')
  const [copyStyle, setCopyStyle] = useState(style?.copyStyle ?? '')
  const [templateId, setTemplateId] = useState(style?.closestTemplateId ?? TEMPLATES[0].id)
  const [error, setError] = useState<string | null>(null)
  // A drag of files over the drop zone, so it can say it will take them.
  const [over, setOver] = useState(false)
  const files = useRef<HTMLInputElement>(null)
  // Which step is running, so only "Describe the style" waits as "Running…" for its own press.
  const { mark, pressed } = usePress<'upload' | 'describe' | 'save'>(pending)
  const describing = pressed('describe')

  /** Runs one step; a refusal or a lost request shows beside the card. */
  const step = (kind: 'upload' | 'describe' | 'save', work: () => Promise<void>) => {
    mark(kind)
    setError(null)
    startTransition(async () => {
      try {
        await work()
      } catch {
        setError(NETWORK_ERROR)
      }
    })
  }

  // Each image is its own request, so neither ever carries more than 5 MB; the new set replaces
  // the saved one only when every image is stored.
  const upload = (files: File[]) => {
    if (files.length < 1 || files.length > REFERENCES_MAX) {
      setError(PAGE_STYLE_ERRORS.images)
      return
    }
    step('upload', async () => {
      const stored: string[] = []
      for (const file of files) {
        const data = new FormData()
        data.set('brandId', brand.id)
        data.set('file', file)
        const res = await actions.uploadReferenceAction(data)
        if (!res.ok) {
          setError(res.error)
          return
        }
        stored.push(res.assetId)
      }
      setRefs(stored)
    })
  }

  const describe = () =>
    step('describe', async () => {
      const res = await actions.describePageStyleAction(brand.id, refs)
      if (!res.ok) {
        setError(res.error)
        return
      }
      setArtStyle(res.fields.artStyle)
      setCopyStyle(res.fields.copyStyle)
      setTemplateId(res.fields.closestTemplateId)
    })

  const save = () =>
    step('save', async () => {
      const res = await actions.savePageStyleAction({
        brandId: brand.id,
        artStyle,
        copyStyle,
        closestTemplateId: templateId,
        referenceAssetIds: refs,
      })
      if (!res.ok) {
        setError(res.error)
        return
      }
      toast.success(`Design language saved · ${brand.name}`)
      router.refresh()
    })

  const template = TEMPLATES.find((t) => t.id === (style?.closestTemplateId ?? ''))
  const filled = artStyle.trim() !== '' && copyStyle.trim() !== ''

  return (
    <section
      aria-labelledby={`${ids}-name`}
      className="flex flex-col gap-5 border border-foreground/18 p-5 @max-xl:p-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 id={`${ids}-name`} className="text-h3 leading-tight font-semibold">
            {brand.name}
          </h2>
          {brand.instagram && <p className={reasonText}>{`@${brand.instagram.handle}`}</p>}
        </div>
        <span className={tag}>{style ? 'Styled' : 'No design language yet'}</span>
      </div>

      {refs.length > 0 && (
        <ul className="grid grid-cols-2 gap-4" aria-label="Reference images in use">
          {refs.map((id, i) => (
            <li key={id}>
              {/* Stored bytes behind the session, shown as they are. */}
              {/* biome-ignore lint/performance/noImgElement: next/image would re-encode a staff-only asset. */}
              <img
                src={`/admin/assets/${encodeURIComponent(id)}`}
                alt={`Reference ${i + 1} for ${brand.name}`}
                loading="lazy"
                className="block aspect-4/5 w-full border object-cover"
              />
            </li>
          ))}
        </ul>
      )}

      {editable ? (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor={`${ids}-files`}>Reference images</Label>
            {/* The drop zone takes dropped images through the same upload as the file picker. */}
            {/* biome-ignore lint/a11y/noStaticElementInteractions: dropping is a pointer shortcut; "Choose files" is the keyboard's way to the same upload. */}
            <div
              data-drop
              onDragOver={(e) => {
                if (pending) return
                e.preventDefault()
                setOver(true)
              }}
              onDragLeave={() => setOver(false)}
              onDrop={(e) => {
                e.preventDefault()
                setOver(false)
                if (!pending) upload(Array.from(e.dataTransfer?.files ?? []))
              }}
              className={cn(
                'flex items-center gap-3.5 border border-dashed border-foreground/35 bg-[repeating-linear-gradient(135deg,transparent_0_0.5rem,color-mix(in_oklch,var(--color-foreground)_3%,transparent)_0.5rem_1rem)] p-4 text-muted-foreground @max-xl:flex-wrap',
                over && 'border-primary bg-accent-100',
              )}
            >
              <ImageIcon aria-hidden="true" strokeWidth={1.5} className="size-icon-lg shrink-0" />
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="font-medium text-foreground">
                  Add one or two of the page's posts
                </span>
                <span id={`${ids}-files-note`} className="text-caption">
                  PNG or JPEG, up to 5 MB each. Colours and fonts stay the brand's.
                </span>
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={() => files.current?.click()}
              >
                Choose files
              </Button>
              <input
                ref={files}
                id={`${ids}-files`}
                type="file"
                accept={REFERENCE_TYPES.join(',')}
                multiple
                disabled={pending}
                tabIndex={-1}
                aria-describedby={`${ids}-files-note`}
                className="sr-only"
                onChange={(e) => {
                  upload(Array.from(e.target.files ?? []))
                  e.target.value = ''
                }}
              />
            </div>
          </div>
          <Button
            variant="outline"
            className="self-start"
            disabled={pending || refs.length === 0}
            onClick={describe}
          >
            {describing ? (
              <Spin />
            ) : (
              <Sparkles aria-hidden="true" strokeWidth={1.5} className="size-icon-sm" />
            )}
            {describing ? 'Running…' : 'Describe the style'}
          </Button>
          {describing && <Working words="Describing the style…" />}
          <div className="flex flex-col gap-2">
            <Label htmlFor={`${ids}-art`}>Art style</Label>
            <Textarea
              id={`${ids}-art`}
              value={artStyle}
              rows={3}
              maxLength={STYLE_MAX}
              onChange={(e) => setArtStyle(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor={`${ids}-copy`}>Copy style</Label>
            <Textarea
              id={`${ids}-copy`}
              value={copyStyle}
              rows={3}
              maxLength={STYLE_MAX}
              onChange={(e) => setCopyStyle(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor={`${ids}-template`}>Closest template</Label>
            <NativeSelect
              id={`${ids}-template`}
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
            >
              {TEMPLATES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="flex items-center gap-4">
            <Button disabled={pending || refs.length === 0 || !filled} onClick={save}>
              Save
            </Button>
            {error && (
              <p role="alert" className="text-caption text-destructive">
                {error}
              </p>
            )}
          </div>
        </div>
      ) : style ? (
        <dl className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <dt className="text-overline uppercase text-muted-foreground">Art style</dt>
            <dd>{style.artStyle}</dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="text-overline uppercase text-muted-foreground">Copy style</dt>
            <dd>{style.copyStyle}</dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="text-overline uppercase text-muted-foreground">Closest template</dt>
            <dd>{template?.name ?? style.closestTemplateId}</dd>
          </div>
        </dl>
      ) : null}

      {style && (
        <p className={reasonText}>
          {`Saved by ${style.updatedByName ?? 'someone'} · ${new Date(style.updatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`}
        </p>
      )}
    </section>
  )
}
