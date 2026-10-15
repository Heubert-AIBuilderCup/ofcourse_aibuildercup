// The real provider: Gemini on Vertex AI, for text and for cover art. The client authenticates
// with Application Default Credentials (gcloud locally, the service account on Cloud Run), so no
// key lives here. It is created on the first call, so importing this module never needs credentials.

import { GoogleGenAI, ThinkingLevel } from '@google/genai'
import type { CallPurpose, GroundedSource, ImageData, Provider } from './client'
import type { AiConfig } from './config'
import type { Usage } from './telemetry'

export const NO_TEXT_IN_ART =
  'No text, letters, numbers, signage, logos or watermarks anywhere in the image.'

/** Said when a page's reference images go with the prompt (criterion 105): their look, never their content. */
export const STYLE_REFERENCES =
  'The attached images are style references: match their medium, texture, line and light, not their subjects.'

export type BillingLabels = {
  app: string
  use_case: string
  tier: string
  prompt_version: string
  env: string
}

// Vertex accepts label values of lowercase letters, digits, underscores and dashes, up to 63 characters.
const LABEL_MAX = 63
function labelValue(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .slice(0, LABEL_MAX)
}

/**
 * The billing labels on every generateContent call (SR7), so Cloud Billing splits spend by use
 * case, tier and prompt version. Only what the call is for goes on: never who asked, which post,
 * or any text. Each value is normalised, so none is ever refused as invalid.
 */
export function labelsFor(
  req: CallPurpose,
  env: string = process.env.NODE_ENV ?? '',
): BillingLabels {
  return {
    app: 'ofcourse',
    use_case: labelValue(req.useCase),
    tier: labelValue(req.tier),
    prompt_version: labelValue(req.promptVersion),
    env: labelValue(env),
  }
}

/** The generateContent request for one JSON answer: the system rules, the user text with any images, the schema, the thinking level and the labels. */
export function jsonRequest(req: Parameters<Provider['json']>[0]) {
  const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [
    { text: req.user },
  ]
  for (const image of req.images ?? [])
    parts.push({ inlineData: { mimeType: image.mime, data: image.base64 } })
  return {
    model: req.model,
    contents: [{ role: 'user', parts }],
    config: {
      systemInstruction: req.system,
      temperature: req.temperature,
      responseMimeType: 'application/json',
      responseJsonSchema: req.jsonSchema,
      thinkingConfig: thinkingFor(req.model),
      labels: labelsFor(req),
      abortSignal: req.signal,
    },
  }
}

/**
 * The generateContent request for one JSON answer with the Google Search tool. The schema goes
 * with the tool: @google/genai 2.27 sets no rule against it, and Gemini 3 models take structured
 * output together with Google Search; the answer is checked against the schema in code all the same.
 */
export function searchRequest(req: Parameters<NonNullable<Provider['search']>>[0]) {
  const base = jsonRequest(req)
  return { ...base, config: { ...base.config, tools: [{ googleSearch: {} }] } }
}

type GroundingResponse = {
  candidates?: Array<{
    groundingMetadata?: {
      groundingChunks?: Array<{ web?: { uri?: string; title?: string; domain?: string } }>
      searchEntryPoint?: { renderedContent?: string }
    }
  }>
}

/**
 * The pages an answer was grounded on, each web chunk with a URI once, titled by its title or else
 * its domain; and the search entry point HTML Google's display rules require to be shown with them.
 */
export function groundingOf(res: GroundingResponse): {
  sources: GroundedSource[]
  entryPoint: string | null
} {
  const meta = res.candidates?.[0]?.groundingMetadata
  const sources: GroundedSource[] = []
  const seen = new Set<string>()
  for (const { web } of meta?.groundingChunks ?? []) {
    if (!web?.uri || seen.has(web.uri)) continue
    seen.add(web.uri)
    sources.push({ url: web.uri, title: web.title || web.domain || web.uri })
  }
  return { sources, entryPoint: meta?.searchEntryPoint?.renderedContent || null }
}

/**
 * The generateContent request for one cover: the prompt plus the no-text rule, an IMAGE-only
 * answer, PNG out, the labels. A page's reference images (criterion 105) follow the text as
 * `inlineData` parts, the shape `Part.inlineData` (a Blob: data, mimeType) takes in @google/genai 2.27.
 */
export function imageRequest(
  req: CallPurpose & {
    model: string
    prompt: string
    aspectRatio: string
    signal: AbortSignal
    references?: ImageData[]
  },
) {
  const references = req.references ?? []
  const text =
    references.length > 0
      ? `${req.prompt} ${STYLE_REFERENCES} ${NO_TEXT_IN_ART}`
      : `${req.prompt} ${NO_TEXT_IN_ART}`
  return {
    model: req.model,
    contents: [
      {
        role: 'user',
        parts: [
          { text },
          ...references.map((r) => ({ inlineData: { mimeType: r.mime, data: r.base64 } })),
        ],
      },
    ],
    config: {
      responseModalities: ['IMAGE'],
      imageConfig: { aspectRatio: req.aspectRatio, outputMimeType: 'image/png' },
      labels: labelsFor(req),
      abortSignal: req.signal,
    },
  }
}

type ImageResponse = {
  candidates?: Array<{
    finishReason?: string
    content?: { parts?: Array<{ inlineData?: { mimeType?: string; data?: string } }> }
  }>
}

/** The first image part's bytes. Throws naming the finish reason when there is none, so the log says why. */
export function imageBytes(res: ImageResponse): Uint8Array {
  const candidate = res.candidates?.[0]
  const data = candidate?.content?.parts?.find((part) => part.inlineData?.data)?.inlineData?.data
  if (!data) {
    const reason = candidate?.finishReason ? ` (${candidate.finishReason})` : ''
    throw new Error(`The model returned no image${reason}`)
  }
  return new Uint8Array(Buffer.from(data, 'base64'))
}

/**
 * The thinking level a JSON call asks for. Flash models think at their default level when none is
 * set, which on the draft prompt took 64 s and 8,430 billed tokens; LOW answered the same in
 * 7.5 s. MINIMAL is refused by 3.8 Flash, so LOW, which Flash-Lite (the lite tier) accepts too.
 * Pro and unknown models keep their default.
 */
export function thinkingFor(model: string): { thinkingLevel: ThinkingLevel } | undefined {
  return model.includes('flash') ? { thinkingLevel: ThinkingLevel.LOW } : undefined
}

type UsageResponse = {
  usageMetadata?: {
    promptTokenCount?: number
    candidatesTokenCount?: number
    thoughtsTokenCount?: number
  }
}

/**
 * The token counts a response reports, for the span and the log line (SR5, SR6). Output is the
 * answer plus the thinking, since both are billed as output; a count the response leaves out stays out.
 */
export function usageOf(res: UsageResponse): Usage {
  const meta = res.usageMetadata
  const usage: Usage = {}
  if (meta?.promptTokenCount !== undefined) usage.inputTokens = meta.promptTokenCount
  if (meta?.candidatesTokenCount !== undefined || meta?.thoughtsTokenCount !== undefined)
    usage.outputTokens = (meta.candidatesTokenCount ?? 0) + (meta.thoughtsTokenCount ?? 0)
  return usage
}

export function vertexProvider(config: AiConfig): Provider {
  let client: GoogleGenAI | null = null
  const genai = () => {
    client ??= new GoogleGenAI({
      vertexai: true,
      project: config.project ?? undefined,
      location: config.location,
    })
    return client
  }

  return {
    async json(req) {
      const res = await genai().models.generateContent(jsonRequest(req))
      req.onUsage?.(usageOf(res))
      const text = res.text
      if (!text) throw new Error('The model returned no text')
      return text
    },

    async search(req) {
      const res = await genai().models.generateContent(searchRequest(req))
      req.onUsage?.(usageOf(res))
      const text = res.text
      if (!text) throw new Error('The model returned no text')
      return { text, ...groundingOf(res) }
    },

    async image(req) {
      const res = await genai().models.generateContent(imageRequest(req))
      req.onUsage?.(usageOf(res))
      return imageBytes(res)
    },
  }
}
