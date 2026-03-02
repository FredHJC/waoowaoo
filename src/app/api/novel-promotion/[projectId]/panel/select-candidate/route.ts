import { logInfo as _ulogInfo } from '@/lib/logging/core'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSignedUrl, generateUniqueKey, downloadAndUploadToCOS, toFetchableUrl } from '@/lib/cos'
import { resolveStorageKeyFromMediaValue } from '@/lib/media/service'
import { requireProjectAuthLight, isErrorResponse } from '@/lib/api-auth'
import { apiHandler, ApiError } from '@/lib/api-errors'

interface PanelHistoryEntry {
  url: string
  timestamp: string
}

function parseUnknownArray(jsonValue: string | null): unknown[] {
  if (!jsonValue) return []
  try {
    const parsed = JSON.parse(jsonValue)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function parsePanelHistory(jsonValue: string | null): PanelHistoryEntry[] {
  return parseUnknownArray(jsonValue).filter((entry): entry is PanelHistoryEntry => {
    if (!entry || typeof entry !== 'object') return false
    const candidate = entry as { url?: unknown; timestamp?: unknown }
    return typeof candidate.url === 'string' && typeof candidate.timestamp === 'string'
  })
}

/**
 * POST /api/novel-promotion/[projectId]/panel/select-candidate
 * 统一的候选图片操作 API
 * 
 * action: 'select' - 选择候选图片作为最终图片
 * action: 'cancel' - 取消选择，清空候选列表
 */
export const POST = apiHandler(async (
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) => {
  const { projectId } = await context.params

  // 🔐 统一权限验证
  const authResult = await requireProjectAuthLight(projectId)
  if (isErrorResponse(authResult)) return authResult

  const body = await request.json()
  const { panelId, selectedImageUrl, candidateIndex, action = 'select' } = body

  if (!panelId) {
    throw new ApiError('INVALID_PARAMS')
  }

  // === 取消操作 ===
  if (action === 'cancel') {
    await prisma.novelPromotionPanel.update({
      where: { id: panelId },
      data: { candidateImages: null }
    })

    return NextResponse.json({
      success: true,
      message: '已取消选择'
    })
  }

  // === 选择操作 ===
  if (!selectedImageUrl) {
    throw new ApiError('INVALID_PARAMS')
  }

  // 获取 Panel
  const panel = await prisma.novelPromotionPanel.findUnique({
    where: { id: panelId }
  })

  if (!panel) {
    throw new ApiError('NOT_FOUND')
  }

  // 验证选择的图片是否在候选列表中
  const candidateImages = parseUnknownArray(panel.candidateImages)
  // Filter out PENDING entries to match frontend behavior
  const validCandidates = candidateImages
    .filter((c): c is string => typeof c === 'string' && !c.startsWith('PENDING:'))

  let finalImageKey: string | null = null

  // Plan A: Use candidateIndex for direct lookup (preferred, avoids URL round-trip issues)
  if (typeof candidateIndex === 'number' && candidateIndex >= 0 && candidateIndex < validCandidates.length) {
    const rawKey = validCandidates[candidateIndex]
    // The raw value from DB is a COS key — resolve it to ensure it's a valid storage key
    const resolvedKey = await resolveStorageKeyFromMediaValue(rawKey)
    if (resolvedKey) {
      finalImageKey = resolvedKey
      _ulogInfo(
        `[select-candidate] ✅ Index-based selection: candidateIndex=${candidateIndex}, key=${finalImageKey}`,
      )
    }
  }

  // Plan B: Fall back to URL-based matching for backward compatibility
  if (!finalImageKey) {
    const selectedCosKey = await resolveStorageKeyFromMediaValue(selectedImageUrl)
    const candidateKeys = (await Promise.all(validCandidates.map((candidate) => resolveStorageKeyFromMediaValue(candidate))))
      .filter((k): k is string => !!k)
    if (selectedCosKey && candidateKeys.includes(selectedCosKey)) {
      finalImageKey = selectedCosKey
      _ulogInfo(
        `[select-candidate] ✅ URL-based fallback selection: key=${finalImageKey}`,
      )
    }
  }

  if (!finalImageKey) {
    _ulogInfo(
      `[select-candidate] 选择失败: candidateIndex=${candidateIndex}, validCandidates=${JSON.stringify(validCandidates)}, candidateImages=${JSON.stringify(candidateImages)}`,
    )
    throw new ApiError('INVALID_PARAMS')
  }

  // 保存当前图片到历史记录
  const currentHistory = parsePanelHistory(panel.imageHistory)
  if (panel.imageUrl) {
    currentHistory.push({
      url: panel.imageUrl,
      timestamp: new Date().toISOString()
    })
  }

  // 选择候选图时优先复用已存在的 COS key，避免重复下载上传（也避免 /m/* 相对URL被 Node fetch 解析失败）
  const isReusableKey = !finalImageKey.startsWith('http://') && !finalImageKey.startsWith('https://') && !finalImageKey.startsWith('/')

  if (!isReusableKey) {
    const sourceUrl = toFetchableUrl(selectedImageUrl)
    const cosKey = generateUniqueKey(`panel-${panelId}-selected`, 'png')
    finalImageKey = await downloadAndUploadToCOS(sourceUrl, cosKey)
  }

  const signedUrl = getSignedUrl(finalImageKey, 7 * 24 * 3600)

  // 更新 Panel：设置新图片，清空候选列表
  await prisma.novelPromotionPanel.update({
    where: { id: panelId },
    data: {
      imageUrl: finalImageKey,
      imageHistory: JSON.stringify(currentHistory),
      candidateImages: null
    }
  })

  return NextResponse.json({
    success: true,
    imageUrl: signedUrl,
    cosKey: finalImageKey,
    message: '已选择图片'
  })
})
