/**
 * E2E test: ARK API request validation and error handling
 *
 * Tests the ARK API's request validation and error handling behavior
 * against the real API. No model activation required — these test
 * client-side validation and API error responses.
 */
import { describe, expect, it } from 'vitest'
import { arkImageGeneration, arkCreateVideoTask } from '@/lib/ark-api'

const ARK_API_KEY = process.env.ARK_API_KEY ?? ''

describe.skipIf(!ARK_API_KEY)('e2e: ARK request validation', () => {
  it('rejects image generation with empty prompt', async () => {
    await expect(
      arkImageGeneration(
        { model: 'doubao-seedream-4-5-251128', prompt: '' },
        { apiKey: ARK_API_KEY, maxRetries: 1, timeoutMs: 30_000 },
      ),
    ).rejects.toThrow()
  })

  it('client-side validates video task with missing model', async () => {
    await expect(
      arkCreateVideoTask(
        { model: '', content: [{ type: 'text', text: 'test' }] },
        { apiKey: ARK_API_KEY },
      ),
    ).rejects.toThrow('ARK_VIDEO_REQUEST_INVALID: model is required')
  })

  it('client-side validates video task with empty content array', async () => {
    await expect(
      arkCreateVideoTask(
        { model: 'doubao-seedance-1-5-pro-251215', content: [] },
        { apiKey: ARK_API_KEY },
      ),
    ).rejects.toThrow('ARK_VIDEO_REQUEST_INVALID: content must be a non-empty array')
  })

  it('client-side validates video task with invalid ratio', async () => {
    await expect(
      arkCreateVideoTask(
        {
          model: 'doubao-seedance-1-5-pro-251215',
          content: [{ type: 'text', text: 'test' }],
          ratio: '5:3',
        },
        { apiKey: ARK_API_KEY },
      ),
    ).rejects.toThrow('ARK_VIDEO_REQUEST_INVALID: ratio=5:3')
  })

  it('client-side validates video task with invalid duration', async () => {
    await expect(
      arkCreateVideoTask(
        {
          model: 'doubao-seedance-1-5-pro-251215',
          content: [{ type: 'text', text: 'test' }],
          duration: 99,
        },
        { apiKey: ARK_API_KEY },
      ),
    ).rejects.toThrow('ARK_VIDEO_REQUEST_INVALID: duration=99')
  })

  it('client-side validates video task with unsupported field', async () => {
    await expect(
      arkCreateVideoTask(
        {
          model: 'doubao-seedance-1-5-pro-251215',
          content: [{ type: 'text', text: 'test' }],
          unknownField: true,
        } as Parameters<typeof arkCreateVideoTask>[0],
        { apiKey: ARK_API_KEY },
      ),
    ).rejects.toThrow('ARK_VIDEO_REQUEST_FIELD_UNSUPPORTED: unknownField')
  })

  it('rejects video task creation with invalid API key', async () => {
    await expect(
      arkCreateVideoTask(
        {
          model: 'doubao-seedance-1-5-pro-251215',
          content: [{ type: 'text', text: 'A calm ocean scene' }],
          duration: 5,
        },
        { apiKey: 'invalid-key', maxRetries: 1, timeoutMs: 30_000 },
      ),
    ).rejects.toThrow()
  })
})
