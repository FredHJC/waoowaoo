import { beforeEach, describe, expect, it, vi } from 'vitest'

const getProviderConfigMock = vi.hoisted(() => vi.fn(async () => ({
  id: 'fal',
  apiKey: 'fal-key',
  baseUrl: '',
})))

vi.mock('@/lib/api-config', () => ({
  getProviderConfig: getProviderConfigMock,
}))

import { pollAsyncTask } from '@/lib/async-poll'

describe('async poll FAL FAILED status mapping', () => {
  let fetchSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    getProviderConfigMock.mockResolvedValue({
      id: 'fal',
      apiKey: 'fal-key',
      baseUrl: '',
    })
    fetchSpy = vi.fn()
    globalThis.fetch = fetchSpy as unknown as typeof fetch
  })

  it('maps FAL FAILED status to failed (not pending)', async () => {
    // queryFalStatus: status query returns FAILED
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: 'FAILED', error: 'content policy violation' }),
    })

    const result = await pollAsyncTask('FAL:VIDEO:fal-ai/wan/v2.6/image-to-video:req_fail', 'user-1')

    expect(result.status).toBe('failed')
    expect(result.error).toBe('content policy violation')
  })

  it('maps FAL COMPLETED status to completed', async () => {
    // queryFalStatus: status query returns COMPLETED, then result fetch succeeds
    fetchSpy
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'COMPLETED' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ video: { url: 'https://cdn.fal.run/video.mp4' } }),
      })

    const result = await pollAsyncTask('FAL:VIDEO:fal-ai/wan/v2.6/image-to-video:req_ok', 'user-1')

    expect(result.status).toBe('completed')
    expect(result.resultUrl).toBe('https://cdn.fal.run/video.mp4')
  })

  it('maps FAL IN_QUEUE status to pending', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: 'IN_QUEUE' }),
    })

    const result = await pollAsyncTask('FAL:VIDEO:fal-ai/wan/v2.6/image-to-video:req_queue', 'user-1')

    expect(result.status).toBe('pending')
  })
})
