import { resolveUnifiedErrorCode } from './codes'
import { getUserMessageByCode } from './user-messages'
import { normalizeAnyError } from './normalize'

export function resolveErrorDisplay(input?: {
  code?: string | null
  message?: string | null
} | null) {
  if (!input) return null
  // code 和 message 都为空时，表示没有错误，直接返回 null
  // 如果不做这个判断，normalizeAnyError 会对空输入兜底返回 INTERNAL_ERROR，导致所有面板误报
  if (!input.code && !input.message) return null

  const code = resolveUnifiedErrorCode(input.code)
  if (code && code !== 'INTERNAL_ERROR') {
    // 优先展示上游返回的原始信息（如 ARK/LLM 的具体错误），便于排查「请求参数不正确」等泛化提示的真实原因
    const rawMessage = typeof input.message === 'string' ? input.message.trim() : ''
    const fallbackMessage = getUserMessageByCode(code)
    return {
      code,
      message: rawMessage.length > 0 ? rawMessage : fallbackMessage,
    }
  }

  // 当 code 是兜底的 INTERNAL_ERROR 或 code 缺失时，尝试从 message 推断更具体的错误码
  // 这样像"敏感内容"、"余额不足"、"网络错误"等具体错误能正确显示
  const normalized = normalizeAnyError(
    { code: input.code || undefined, message: input.message || undefined },
    { context: 'api' },
  )
  if (normalized?.code) {
    const rawMessage = typeof input.message === 'string' ? input.message.trim() : ''
    const fallbackMessage = getUserMessageByCode(normalized.code)
    return {
      code: normalized.code,
      message: rawMessage.length > 0 ? rawMessage : fallbackMessage,
    }
  }

  return null
}
