// The cover-art request and response helpers: pure, so no SDK client, network or credentials.

import { describe, expect, it } from 'bun:test'
import { ThinkingLevel } from '@google/genai'
import {
  groundingOf,
  imageBytes,
  imageRequest,
  jsonRequest,
  labelsFor,
  NO_TEXT_IN_ART,
  STYLE_REFERENCES,
  searchRequest,
  thinkingFor,
  usageOf,
} from './vertex'

const ART = { useCase: 'art', tier: 'image', promptVersion: 'image.v1' } as const

describe('labelsFor', () => {
  it('names the app, use case, tier, prompt version and environment, and nothing else (SR7)', () => {
    // The whole provider request, as the client sends it: only its purpose may reach the labels.
    const req = {
      useCase: 'source_check',
      tier: 'lite',
      promptVersion: 'source_check.v2',
      postId: 'p1',
      data: { userId: 'user-77', claim: 'secret text' },
    } as const
    const labels = labelsFor(req, 'production')
    expect(labels).toEqual({
      app: 'ofcourse',
      use_case: 'source_check',
      tier: 'lite',
      prompt_version: 'source_check-v2',
      env: 'production',
    })
    expect(JSON.stringify(labels)).not.toContain('user-77')
    expect(JSON.stringify(labels)).not.toContain('p1')
  })

  it('normalises every value to lowercase [a-z0-9_-] of at most 63 characters, so no label is ever invalid', () => {
    const labels = labelsFor(
      { ...ART, promptVersion: `Draft Slide.V2/${'x'.repeat(80)}` },
      'Preview Branch!',
    )
    expect(labels.prompt_version).toMatch(/^[a-z0-9_-]+$/)
    expect(labels.prompt_version).toHaveLength(63)
    expect(labels.prompt_version.startsWith('draft-slide-v2-')).toBe(true)
    expect(labels.env).toBe('preview-branch-')
  })

  it('reads the environment from NODE_ENV when none is given', () => {
    expect(labelsFor(ART).env).toBe(process.env.NODE_ENV)
  })
})

describe('jsonRequest', () => {
  it('sends the labels, the JSON schema, the thinking level and the images on one JSON call', () => {
    const signal = new AbortController().signal
    const req = jsonRequest({
      model: 'gemini-3.5-flash-lite',
      system: 'Rules',
      user: 'DATA',
      temperature: 0,
      jsonSchema: { type: 'object' },
      images: [{ mime: 'image/png', base64: 'AAA' }],
      signal,
      useCase: 'art_check',
      tier: 'lite',
      promptVersion: 'art_check.v1',
      data: {},
    })
    expect(req).toEqual({
      model: 'gemini-3.5-flash-lite',
      contents: [
        {
          role: 'user',
          parts: [{ text: 'DATA' }, { inlineData: { mimeType: 'image/png', data: 'AAA' } }],
        },
      ],
      config: {
        systemInstruction: 'Rules',
        temperature: 0,
        responseMimeType: 'application/json',
        responseJsonSchema: { type: 'object' },
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        labels: labelsFor({ useCase: 'art_check', tier: 'lite', promptVersion: 'art_check.v1' }),
        abortSignal: signal,
      },
    })
  })
})

describe('searchRequest', () => {
  it('asks for JSON with the Google Search tool, the schema, the thinking level and the labels', () => {
    const signal = new AbortController().signal
    const req = searchRequest({
      model: 'gemini-3.8-flash',
      system: 'Rules',
      user: 'DATA',
      temperature: 0,
      jsonSchema: { type: 'object' },
      signal,
      useCase: 'suggest_sources',
      tier: 'flash',
      promptVersion: 'suggest_sources.v1',
      data: {},
    })
    expect(req).toEqual({
      model: 'gemini-3.8-flash',
      contents: [{ role: 'user', parts: [{ text: 'DATA' }] }],
      config: {
        systemInstruction: 'Rules',
        temperature: 0,
        responseMimeType: 'application/json',
        responseJsonSchema: { type: 'object' },
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        tools: [{ googleSearch: {} }],
        labels: labelsFor({
          useCase: 'suggest_sources',
          tier: 'flash',
          promptVersion: 'suggest_sources.v1',
        }),
        abortSignal: signal,
      },
    })
  })
})

describe('groundingOf', () => {
  it('reads each web chunk once as a source, its title or else its domain, and the entry point HTML', () => {
    const redirect = 'https://vertexaisearch.cloud.google.com/grounding-api-redirect/AbC123'
    const res = {
      candidates: [
        {
          groundingMetadata: {
            groundingChunks: [
              { web: { uri: redirect, title: 'studyaustralia.gov.au' } },
              { web: { uri: 'https://a.example/page', domain: 'a.example' } },
              { web: { uri: redirect, title: 'again' } },
              { web: { title: 'no uri' } },
              { retrievedContext: { uri: 'gs://bucket/file' } },
            ],
            searchEntryPoint: { renderedContent: '<div>chips</div>' },
          },
        },
      ],
    }
    expect(groundingOf(res)).toEqual({
      sources: [
        { url: redirect, title: 'studyaustralia.gov.au' },
        { url: 'https://a.example/page', title: 'a.example' },
      ],
      entryPoint: '<div>chips</div>',
    })
  })

  it('has no sources and no entry point when the answer was not grounded', () => {
    expect(groundingOf({})).toEqual({ sources: [], entryPoint: null })
    expect(groundingOf({ candidates: [{}] })).toEqual({ sources: [], entryPoint: null })
  })
})

describe('imageRequest', () => {
  it('asks for an IMAGE-only PNG answer at the aspect ratio, with the no-text rule appended and the labels', () => {
    const signal = new AbortController().signal
    const req = imageRequest({ ...ART, model: 'm', prompt: 'A desk.', aspectRatio: '4:5', signal })
    expect(req).toEqual({
      model: 'm',
      contents: [{ role: 'user', parts: [{ text: `A desk. ${NO_TEXT_IN_ART}` }] }],
      config: {
        responseModalities: ['IMAGE'],
        imageConfig: { aspectRatio: '4:5', outputMimeType: 'image/png' },
        labels: labelsFor(ART),
        abortSignal: signal,
      },
    })
    expect(req.config.abortSignal).toBe(signal)
    expect(req.config.labels).toMatchObject({ app: 'ofcourse', use_case: 'art', tier: 'image' })
  })

  it("sends a page's reference images as extra inlineData parts after the text, as style references (105)", () => {
    const signal = new AbortController().signal
    const req = imageRequest({
      ...ART,
      model: 'm',
      prompt: 'A desk.',
      aspectRatio: '4:5',
      signal,
      references: [
        { mime: 'image/png', base64: 'AAA' },
        { mime: 'image/jpeg', base64: 'BBB' },
      ],
    })
    expect(req.contents).toEqual([
      {
        role: 'user',
        parts: [
          { text: `A desk. ${STYLE_REFERENCES} ${NO_TEXT_IN_ART}` },
          { inlineData: { mimeType: 'image/png', data: 'AAA' } },
          { inlineData: { mimeType: 'image/jpeg', data: 'BBB' } },
        ],
      },
    ])
  })
})

describe('imageBytes', () => {
  it('returns the first image part decoded from base64', () => {
    const data = Buffer.from([1, 2, 3]).toString('base64')
    const res = {
      candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data } }] } }],
    }
    expect(imageBytes(res)).toEqual(new Uint8Array([1, 2, 3]))
  })

  it('throws naming the finish reason when the answer has no image', () => {
    const res = { candidates: [{ finishReason: 'IMAGE_SAFETY', content: { parts: [] } }] }
    expect(() => imageBytes(res)).toThrow(/IMAGE_SAFETY/)
  })

  it('throws "no image" on an empty response', () => {
    expect(() => imageBytes({})).toThrow(/no image/i)
  })
})

describe('thinkingFor', () => {
  // Measured 9 Oct 2026 on the draft prompt: gemini-3.8-flash with no setting thinks at its
  // default for 64 s and 8,430 billed tokens; at LOW it answers the same in 7.5 s with none.
  it('thinks LOW on a Flash model, Flash-Lite included', () => {
    expect(thinkingFor('gemini-3.8-flash')).toEqual({ thinkingLevel: ThinkingLevel.LOW })
    expect(thinkingFor('gemini-3.5-flash-lite')).toEqual({ thinkingLevel: ThinkingLevel.LOW })
  })

  it('leaves a Pro or unknown model at its default', () => {
    expect(thinkingFor('gemini-3.1-pro-preview')).toBeUndefined()
    expect(thinkingFor('some-other-model')).toBeUndefined()
  })
})

describe('usageOf', () => {
  it('reads the prompt tokens as input and the answer plus thinking tokens as output', () => {
    const usage = usageOf({
      usageMetadata: { promptTokenCount: 900, candidatesTokenCount: 120, thoughtsTokenCount: 80 },
    })
    expect(usage).toEqual({ inputTokens: 900, outputTokens: 200 })
  })

  it('reports nothing it was not told', () => {
    expect(usageOf({})).toEqual({})
    expect(usageOf({ usageMetadata: { promptTokenCount: 10 } })).toEqual({ inputTokens: 10 })
  })
})
