import { describe, expect, it, vi } from 'vitest'
import { executeRunRequest } from '@/lib/query/hooks/run-stream/run-request-executor'
import type { RunStreamEvent } from '@/lib/novel-promotion/run-stream/types'

function sseResponse(events: Array<{ event: string; data: Record<string, unknown> }>) {
  const body = events
    .map((e) => `event: ${e.event}\ndata: ${JSON.stringify(e.data)}\n\n`)
    .join('')

  return new Response(body, {
    status: 200,
    headers: {
      'content-type': 'text/event-stream',
    },
  })
}

describe('run-request-executor SSE path', () => {
  it('returns terminal result from SSE stream instead of false failure', async () => {
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
    fetchMock.mockResolvedValueOnce(
      sseResponse([
        {
          event: 'run.start',
          data: { runId: 'run_sse_1', status: 'running', message: 'started' },
        },
        {
          event: 'step.chunk',
          data: {
            runId: 'run_sse_1',
            stepId: 'step_1',
            lane: 'text',
            textDelta: 'hello',
            seq: 1,
          },
        },
        {
          event: 'run.complete',
          data: {
            runId: 'run_sse_1',
            status: 'completed',
            payload: { summary: { ok: true } },
          },
        },
      ]),
    )

    const originalFetch = globalThis.fetch
    // @ts-expect-error test override
    globalThis.fetch = fetchMock

    try {
      const captured: RunStreamEvent[] = []
      const finalResultRef = { current: null }
      const result = await executeRunRequest({
        endpointUrl: '/api/test-stream',
        requestBody: {},
        controller: new AbortController(),
        taskStreamTimeoutMs: 30_000,
        applyAndCapture: (event) => {
          captured.push(event)
        },
        finalResultRef,
      })

      expect(result.status).toBe('completed')
      expect(result.runId).toBe('run_sse_1')
      expect(result.errorMessage).toBe('')
      expect(finalResultRef.current).toBe(result)
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it('returns failed result from SSE stream when run.error is sent', async () => {
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
    fetchMock.mockResolvedValueOnce(
      sseResponse([
        {
          event: 'run.start',
          data: { runId: 'run_err_1', status: 'running' },
        },
        {
          event: 'run.error',
          data: {
            runId: 'run_err_1',
            status: 'failed',
            message: 'something went wrong',
          },
        },
      ]),
    )

    const originalFetch = globalThis.fetch
    // @ts-expect-error test override
    globalThis.fetch = fetchMock

    try {
      const result = await executeRunRequest({
        endpointUrl: '/api/test-stream',
        requestBody: {},
        controller: new AbortController(),
        taskStreamTimeoutMs: 30_000,
        applyAndCapture: () => {},
        finalResultRef: { current: null },
      })

      expect(result.status).toBe('failed')
      expect(result.runId).toBe('run_err_1')
      expect(result.errorMessage).toBe('something went wrong')
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})
