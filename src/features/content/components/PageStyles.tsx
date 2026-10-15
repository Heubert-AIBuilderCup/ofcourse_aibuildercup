'use client'

import { useRouter } from 'next/navigation'
import { useId, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Blueprint } from '@/shared/components/Blueprint'
import { Button } from '@/shared/components/ui/button'
import { Label } from '@/shared/components/ui/label'
import { NativeSelect } from '@/shared/components/ui/native-select'
import { Textarea } from '@/shared/components/ui/textarea'
import { canEdit, type Staff } from '@/shared/lib/auth/access'
import type { ActionResult } from '@/shared/types/action-result'
import type { DesignFields } from '../ai/design-language'
import { PAGE_BRANDS } from '../brands'
import { PAGE_STYLE_ERRORS, REFERENCE_TYPES, REFERENCES_MAX, STYLE_MAX } from '../lib/page-style'
import type { Brand } from '../model/types'
import type { PageStyle } from '../server/page-style'
import { TEMPLATES } from '../templates'
import { reasonText, tag } from './parts'

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

  /** Runs one step; a refusal or a lost request shows beside the card. */
  const step = (work: () => Promise<void>) => {
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
    step(async () => {
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
    step(async () => {
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
    step(async () => {
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
    <Blueprint as="section" aria-labelledby={`${ids}-name`} className="flex flex-col gap-6 p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 id={`${ids}-name`} className="text-h4">
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
            <input
              id={`${ids}-files`}
              type="file"
              accept={REFERENCE_TYPES.join(',')}
              multiple
              disabled={pending}
              aria-describedby={`${ids}-files-note`}
              className="text-caption file:mr-4 file:border file:bg-transparent file:px-3 file:py-1"
              onChange={(e) => {
                upload(Array.from(e.target.files ?? []))
                e.target.value = ''
              }}
            />
            <p id={`${ids}-files-note`} className={reasonText}>
              One or two PNG or JPEG images of the page's posts, up to 5 MB each. Colours and fonts
              stay the brand's.
            </p>
          </div>
          <Button
            variant="outline"
            className="self-start"
            disabled={pending || refs.length === 0}
            onClick={describe}
          >
            {pending ? 'Running…' : 'Describe the style'}
          </Button>
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
    </Blueprint>
  )
}
