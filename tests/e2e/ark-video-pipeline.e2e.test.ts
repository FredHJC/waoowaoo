/**
 * E2E test: Volcengine ARK Video Pipeline
 *
 * Full pipeline: generate an image → create a video task from the image → poll until done.
 * Requires ARK_API_KEY in .env.test.local AND the video model activated in Ark Console.
 * Skipped automatically when the key is absent or the model is not activated.
 */
import { describe, expect, it } from 'vitest'
import {
  arkImageGeneration,
  arkCreateVideoTask,
  arkQueryVideoTask,
} from '@/lib/ark-api'

const ARK_API_KEY = process.env.ARK_API_KEY ?? ''
const ARK_IMAGE_MODEL = 'doubao-seedream-4-5-251128'
const ARK_VIDEO_MODEL = 'doubao-seedance-1-5-pro-251215'

/** Poll a video task until it reaches a terminal state */
async function pollVideoTask(
  taskId: string,
  apiKey: string,
  { intervalMs = 10_000, maxAttempts = 36 } = {},
) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const status = await arkQueryVideoTask(taskId, {
      apiKey,
      logPrefix: `[E2E Poll #${attempt}]`,
    })

    console.log(
      `[E2E] Poll #${attempt}: status=${status.status}`,
      status.content ? `(video ready)` : '',
    )

    if (status.status === 'succeeded' || status.status === 'failed') {
      return status
    }

    await new Promise((r) => setTimeout(r, intervalMs))
  }

  throw new Error(`Video task ${taskId} did not complete within ${maxAttempts} polls`)
}

describe.skipIf(!ARK_API_KEY)('e2e: ARK video pipeline (image → video)', () => {
  it(
    'generates an image, creates a video task from it, and polls to completion',
    async (ctx) => {
      // ---- Step 1: Generate a source image ----
      console.log('[E2E] Step 1: Generating source image...')
      const imageResponse = await arkImageGeneration(
        {
          model: ARK_IMAGE_MODEL,
          prompt: 'A serene mountain lake at sunrise, cinematic style',
          response_format: 'url',
          watermark: false,
        },
        {
          apiKey: ARK_API_KEY,
          timeoutMs: 120_000,
          maxRetries: 2,
          logPrefix: '[E2E Image]',
        },
      )

      expect(imageResponse.data.length).toBeGreaterThanOrEqual(1)
      const imageUrl = imageResponse.data[0].url
      expect(imageUrl).toBeTruthy()
      console.log('[E2E] Image generated:', imageUrl!.slice(0, 100), '...')

      // ---- Step 2: Create a video generation task from the image ----
      console.log('[E2E] Step 2: Creating video task...')
      let videoTask: { id: string }
      try {
        videoTask = await arkCreateVideoTask(
          {
            model: ARK_VIDEO_MODEL,
            content: [
              {
                type: 'image_url',
                image_url: { url: imageUrl! },
                role: 'first_frame',
              },
              {
                type: 'text',
                text: 'Camera slowly zooms in, gentle breeze ripples the water surface',
              },
            ],
            duration: 5,
            resolution: '720p',
            watermark: false,
          },
          {
            apiKey: ARK_API_KEY,
            timeoutMs: 120_000,
            maxRetries: 1,
            logPrefix: '[E2E Video Create]',
          },
        )
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error)
        if (msg.includes('ModelNotOpen')) {
          console.warn(
            `[E2E] Video model ${ARK_VIDEO_MODEL} is not activated on this account. ` +
            'Activate it in the Ark Console to run this test. Skipping.',
          )
          ctx.skip()
          return
        }
        throw error
      }

      expect(videoTask.id).toBeTruthy()
      console.log('[E2E] Video task created, id:', videoTask.id)

      // ---- Step 3: Poll until completed ----
      console.log('[E2E] Step 3: Polling video task...')
      const finalStatus = await pollVideoTask(videoTask.id, ARK_API_KEY, {
        intervalMs: 10_000,
        maxAttempts: 36, // up to ~6 minutes
      })

      expect(finalStatus.status).toBe('succeeded')

      // Log full response to understand structure
      console.log('[E2E] Final response:', JSON.stringify(finalStatus, null, 2).slice(0, 2000))

      // Extract video URL: ARK may return content as an array or single object,
      // and the video_url field may be { url: string } or just a string
      const content = finalStatus.content
      expect(content).toBeTruthy()

      const contentItems = Array.isArray(content) ? content : [content]
      expect(contentItems.length).toBeGreaterThanOrEqual(1)

      const firstItem = contentItems[0] as Record<string, unknown>
      const videoUrlField = firstItem.video_url as string | { url: string } | undefined
      const videoUrl = typeof videoUrlField === 'string'
        ? videoUrlField
        : videoUrlField?.url

      expect(videoUrl).toBeTruthy()
      expect(typeof videoUrl).toBe('string')
      expect(videoUrl).toMatch(/^https?:\/\//)
      console.log('[E2E] Video generated:', videoUrl!.slice(0, 120), '...')
    },
    { timeout: 600_000 }, // 10 minutes total for the full pipeline
  )
})
