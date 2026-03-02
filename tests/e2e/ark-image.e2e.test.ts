/**
 * E2E test: Volcengine ARK Image Generation
 *
 * Calls the real ARK API to generate an image.
 * Requires ARK_API_KEY in .env.test.local.
 * Skipped automatically when the key is absent.
 */
import { describe, expect, it } from 'vitest'
import { arkImageGeneration } from '@/lib/ark-api'

const ARK_API_KEY = process.env.ARK_API_KEY ?? ''
const ARK_IMAGE_MODEL = 'doubao-seedream-4-5-251128'

describe.skipIf(!ARK_API_KEY)('e2e: ARK image generation', () => {
  it(
    'generates an image from a text prompt and returns a URL',
    async () => {
      const response = await arkImageGeneration(
        {
          model: ARK_IMAGE_MODEL,
          prompt: 'A small white cat sitting on a windowsill, watercolor style',
          response_format: 'url',
          watermark: false,
        },
        {
          apiKey: ARK_API_KEY,
          timeoutMs: 120_000,
          maxRetries: 2,
          logPrefix: '[E2E ARK Image]',
        },
      )

      expect(response).toBeDefined()
      expect(response.data).toBeInstanceOf(Array)
      expect(response.data.length).toBeGreaterThanOrEqual(1)

      const firstImage = response.data[0]
      // ARK returns either a url or b64_json
      const hasOutput = !!(firstImage.url || firstImage.b64_json)
      expect(hasOutput).toBe(true)

      if (firstImage.url) {
        expect(firstImage.url).toMatch(/^https?:\/\//)
        console.log('[E2E] ARK image URL:', firstImage.url.slice(0, 120), '...')
      } else {
        console.log('[E2E] ARK image returned b64_json, length:', firstImage.b64_json!.length)
      }
    },
    { timeout: 180_000 },
  )
})
