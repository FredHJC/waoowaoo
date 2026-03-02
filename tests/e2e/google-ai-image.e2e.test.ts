/**
 * E2E test: Google AI (Gemini) Image Generation
 *
 * Calls the real Google AI API to generate an image with Gemini.
 * Requires GOOGLE_AI_API_KEY in .env.test.local.
 * Skipped automatically when the key is absent.
 */
import { describe, expect, it } from 'vitest'
import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from '@google/genai'

const GOOGLE_AI_API_KEY = process.env.GOOGLE_AI_API_KEY ?? ''

// Models to try in order — availability depends on API key's region/tier
const IMAGE_MODELS = [
  'gemini-2.5-flash-preview-image-generation',
  'gemini-2.5-flash-image',
  'gemini-3-pro-image-preview',
]

const safetySettings = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
]

describe.skipIf(!GOOGLE_AI_API_KEY)('e2e: Google AI (Gemini) image generation', () => {
  it(
    'generates an image from a text prompt and returns base64 data',
    async (ctx) => {
      const ai = new GoogleGenAI({ apiKey: GOOGLE_AI_API_KEY })

      let response: Awaited<ReturnType<typeof ai.models.generateContent>> | null = null
      let usedModel = ''

      for (const model of IMAGE_MODELS) {
        try {
          console.log(`[E2E] Trying image model: ${model}`)
          response = await ai.models.generateContent({
            model,
            contents: [
              {
                parts: [
                  { text: 'Generate a simple watercolor illustration of a small orange cat sitting on a book.' },
                ],
              },
            ],
            config: {
              responseModalities: ['TEXT', 'IMAGE'],
              safetySettings,
            },
          })
          usedModel = model
          break
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error)
          if (msg.includes('not found') || msg.includes('not available') || msg.includes('404')) {
            console.warn(`[E2E] Model ${model} not available, trying next...`)
            continue
          }
          throw error
        }
      }

      if (!response) {
        console.warn('[E2E] No Gemini image model available. Skipping.')
        ctx.skip()
        return
      }

      expect(response.candidates).toBeDefined()
      expect(response.candidates!.length).toBeGreaterThanOrEqual(1)

      const parts = response.candidates![0].content?.parts || []
      const imagePart = parts.find((p) => p.inlineData?.data)

      expect(imagePart).toBeTruthy()
      expect(imagePart!.inlineData!.data!.length).toBeGreaterThan(100)
      expect(imagePart!.inlineData!.mimeType).toMatch(/^image\//)

      console.log(
        `[E2E] Gemini image generated (model=${usedModel}):`,
        `mime=${imagePart!.inlineData!.mimeType}`,
        `base64_length=${imagePart!.inlineData!.data!.length}`,
      )
    },
    { timeout: 120_000 },
  )
})
