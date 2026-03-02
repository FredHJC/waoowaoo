/**
 * E2E test: Google AI API connection and model listing
 *
 * Validates the Google AI API key by listing available models.
 * Requires GOOGLE_AI_API_KEY in .env.test.local.
 * Skipped automatically when the key is absent.
 */
import { describe, expect, it } from 'vitest'
import { testLlmConnection } from '@/lib/user-api/llm-test-connection'

const GOOGLE_AI_API_KEY = process.env.GOOGLE_AI_API_KEY ?? ''

describe.skipIf(!GOOGLE_AI_API_KEY)('e2e: Google AI connection test', () => {
  it(
    'validates Google AI API key by listing models',
    async () => {
      const result = await testLlmConnection({
        provider: 'google',
        apiKey: GOOGLE_AI_API_KEY,
      })

      expect(result).toBeDefined()
      expect(result.provider).toBe('google')
      expect(result.message).toContain('连接成功')
      console.log('[E2E] Google AI connection:', result.message)
    },
    { timeout: 30_000 },
  )
})
