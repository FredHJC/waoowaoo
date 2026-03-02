/**
 * E2E test: Google AI (Gemini) LLM Text Generation
 *
 * Calls the real Google AI API to generate text with Gemini.
 * Requires GOOGLE_AI_API_KEY in .env.test.local.
 * Skipped automatically when the key is absent.
 */
import { describe, expect, it } from 'vitest'
import { GoogleGenAI } from '@google/genai'

const GOOGLE_AI_API_KEY = process.env.GOOGLE_AI_API_KEY ?? ''
const GEMINI_MODEL = 'gemini-2.5-flash'

describe.skipIf(!GOOGLE_AI_API_KEY)('e2e: Google AI (Gemini) LLM', () => {
  it(
    'generates a text response from a simple prompt',
    async () => {
      const ai = new GoogleGenAI({ apiKey: GOOGLE_AI_API_KEY })

      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: [
          {
            role: 'user',
            parts: [{ text: 'Reply with exactly one word: "hello"' }],
          },
        ],
        config: {
          temperature: 0,
        },
      })

      expect(response).toBeDefined()

      const text = response.text ?? ''
      expect(text.length).toBeGreaterThan(0)
      expect(text.toLowerCase()).toContain('hello')
      console.log('[E2E] Gemini response:', text.trim())
    },
    { timeout: 60_000 },
  )

  it(
    'generates a structured response with system instruction',
    async () => {
      const ai = new GoogleGenAI({ apiKey: GOOGLE_AI_API_KEY })

      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: 'Write a one-sentence story about a robot learning to paint.',
              },
            ],
          },
        ],
        config: {
          temperature: 0.7,
          systemInstruction: {
            parts: [
              {
                text: 'You are a creative writing assistant. Always respond with exactly one sentence.',
              },
            ],
          },
        },
      })

      expect(response).toBeDefined()

      const text = response.text ?? ''
      expect(text.length).toBeGreaterThan(10)
      console.log('[E2E] Gemini story:', text.trim())
    },
    { timeout: 60_000 },
  )
})
