/**
 * E2E test: Volcengine ARK LLM (Responses API)
 *
 * Calls the real ARK Responses API for text generation.
 * Requires ARK_API_KEY in .env.test.local AND the LLM model activated in Ark Console.
 * Skipped automatically when the key is absent.
 */
import { describe, expect, it } from 'vitest'
import { arkResponsesCompletion } from '@/lib/ark-llm'

const ARK_API_KEY = process.env.ARK_API_KEY ?? ''
// Use a common lite model that is likely activated
const ARK_LLM_MODEL = 'doubao-seed-1-6-lite-251015'

describe.skipIf(!ARK_API_KEY)('e2e: ARK LLM (Responses API)', () => {
  it(
    'generates a text response from a simple prompt',
    async (ctx) => {
      let result: Awaited<ReturnType<typeof arkResponsesCompletion>>
      try {
        result = await arkResponsesCompletion({
          apiKey: ARK_API_KEY,
          model: ARK_LLM_MODEL,
          input: [
            {
              role: 'user',
              content: [{ type: 'input_text', text: 'Reply with exactly one word: hello' }],
            },
          ],
        })
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error)
        if (msg.includes('ModelNotOpen') || msg.includes('not activated')) {
          console.warn(
            `[E2E] ARK LLM model ${ARK_LLM_MODEL} is not activated. ` +
            'Activate it in the Ark Console to run this test. Skipping.',
          )
          ctx.skip()
          return
        }
        throw error
      }

      expect(result).toBeDefined()
      expect(result.text).toBeTruthy()
      expect(result.text.toLowerCase()).toContain('hello')
      expect(result.usage.promptTokens).toBeGreaterThan(0)
      expect(result.usage.completionTokens).toBeGreaterThan(0)
      console.log('[E2E] ARK LLM response:', result.text.trim())
      console.log('[E2E] ARK LLM usage:', result.usage)
    },
    { timeout: 60_000 },
  )
})
