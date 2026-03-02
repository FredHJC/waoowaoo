import { describe, expect, it } from 'vitest'

/**
 * Tests the parseSpeakerVoices logic pattern used in voice-generate/route.ts.
 * The function is private to the route module, so we replicate the exact logic here.
 */
function parseSpeakerVoices(raw: string | null | undefined) {
  if (!raw) return {} as Record<string, { audioUrl?: string | null }>
  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return {}
    return parsed as Record<string, { audioUrl?: string | null }>
  } catch {
    return {}
  }
}

describe('parseSpeakerVoices', () => {
  it('returns empty object for null/undefined input', () => {
    expect(parseSpeakerVoices(null)).toEqual({})
    expect(parseSpeakerVoices(undefined)).toEqual({})
    expect(parseSpeakerVoices('')).toEqual({})
  })

  it('parses valid JSON object', () => {
    const raw = JSON.stringify({ narrator: { audioUrl: 'https://example.com/voice.mp3' } })
    const result = parseSpeakerVoices(raw)
    expect(result).toEqual({ narrator: { audioUrl: 'https://example.com/voice.mp3' } })
  })

  it('returns empty object for malformed JSON instead of throwing', () => {
    expect(parseSpeakerVoices('{')).toEqual({})
    expect(parseSpeakerVoices('not json at all')).toEqual({})
    expect(parseSpeakerVoices('{"truncated')).toEqual({})
  })

  it('returns empty object for non-object JSON values', () => {
    expect(parseSpeakerVoices('"string"')).toEqual({})
    expect(parseSpeakerVoices('42')).toEqual({})
    expect(parseSpeakerVoices('null')).toEqual({})
  })
})
