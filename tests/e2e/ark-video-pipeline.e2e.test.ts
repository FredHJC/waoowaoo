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
const ARK_VIDEO_MODEL = 'doubao-seedance-1-0-pro-fast-251015'

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
      expect(finalStatus.content).toBeInstanceOf(Array)
      expect(finalStatus.content!.length).toBeGreaterThanOrEqual(1)

      const videoUrl = finalStatus.content![0].video_url.url
      expect(videoUrl).toMatch(/^https?:\/\//)
      console.log('[E2E] Video generated:', videoUrl.slice(0, 120), '...')
    },
    { timeout: 600_000 }, // 10 minutes total for the full pipeline
  )
})
