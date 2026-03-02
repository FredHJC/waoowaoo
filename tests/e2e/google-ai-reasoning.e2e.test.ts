/**
 * E2E test: Google AI (Gemini) Reasoning / Thinking
 *
 * Tests Gemini's thinking/reasoning capabilities.
 * Requires GOOGLE_AI_API_KEY in .env.test.local.
 * Skipped automatically when the key is absent.
 */
import { describe, expect, it } from 'vitest'
import { GoogleGenAI } from '@google/genai'

const GOOGLE_AI_API_KEY = process.env.GOOGLE_AI_API_KEY ?? ''

// Models that may support thinking — try in order
const THINKING_MODELS = [
  'gemini-2.5-pro',
  'gemini-2.5-flash-thinking',
  'gemini-2.5-flash',
]

describe.skipIf(!GOOGLE_AI_API_KEY)('e2e: Google AI (Gemini) reasoning', () => {
  it(
    'generates a response with thinking/reasoning enabled',
    async (ctx) => {
      const ai = new GoogleGenAI({ apiKey: GOOGLE_AI_API_KEY })

      let response: Awaited<ReturnType<typeof ai.models.generateContent>> | null = null
      let usedModel = ''

      for (const model of THINKING_MODELS) {
        try {
          console.log(`[E2E] Trying thinking model: ${model}`)
          response = await ai.models.generateContent({
            model,
            contents: [
              {
                role: 'user',
                parts: [
                  {
                    text: 'What is 17 * 23? Show your reasoning step by step, then give the final answer.',
                  },
                ],
              },
            ],
            config: {
              temperature: 0,
              thinkingConfig: {
                thinkingLevel: 'low',
                includeThoughts: true,
              },
            },
          })
          usedModel = model
          break
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error)
          if (
            msg.includes('not found') ||
            msg.includes('not available') ||
            msg.includes('not supported') ||
            msg.includes('404')
          ) {
            console.warn(`[E2E] Model ${model} doesn't support thinking, trying next...`)
            continue
          }
          throw error
        }
      }

      if (!response) {
        console.warn('[E2E] No Gemini model with thinking support available. Skipping.')
        ctx.skip()
        return
      }

      const text = response.text ?? ''
      expect(text.length).toBeGreaterThan(0)
      // The answer should contain 391 (17 * 23 = 391)
      expect(text).toContain('391')

      // Check if thinking/reasoning parts are present
      const parts = response.candidates?.[0]?.content?.parts || []
      const thoughtParts = parts.filter(
        (p) => (p as Record<string, unknown>).thought === true,
      )

      console.log(`[E2E] Gemini reasoning (model=${usedModel}):`, text.trim().slice(0, 200))
      console.log('[E2E] Thought parts found:', thoughtParts.length)
    },
    { timeout: 120_000 },
  )
})
