# Issue：报错与引导信息不规范

## 问题简述

项目中与「分析模型未配置」等配置类错误相关的报错文案、引导语不统一：同一类问题存在多种英文/中文混用表述，且缺少统一错误码与 i18n，导致用户可能看到技术英文（如 `analysisModel is not configured`）或不同入口的引导语（「项目设置」/「设置页面」/「用户配置」），体验不一致且难以定位到正确配置入口。

## 现象与依据

### 1. 同一语义多种原文，未走 i18n

「分析模型未配置」在代码中至少存在以下多种写法，且多为硬编码字符串：

| 位置 | 当前文案 |
|------|----------|
| `voice-analyze.ts`, `story-to-script.ts`, `script-to-storyboard.ts`, `screenplay-convert.ts`, `clips-build.ts`, `asset-hub-ai-design.ts`, `analyze-novel.ts` | `analysisModel is not configured` |
| `text.worker.ts` | `Analysis model not configured` |
| `shot-ai-persist.ts`, `character-profile-helpers.ts`, `analyze-global.ts` | `请先在项目设置中配置分析模型` |
| `reference-to-character.ts`, `episode-split.ts` | `请先在设置页面配置分析模型` |
| `asset-hub-ai-modify.ts`, `asset-utils/ai-design.ts` | `请先在用户配置中设置分析模型` |
| `llm/chat-completion.ts`, `llm/chat-stream.ts`, `llm/vision.ts` | `ANALYSIS_MODEL_NOT_CONFIGURED: 请先在设置页面配置分析模型` |

其他模型类也有类似不统一，例如：

- `Edit model not configured` / `Storyboard model not configured` / `Location model not configured` / `User edit model not configured` 等为英文硬编码；
- 角色/参考音等：`请先在设置页面配置角色图片模型`、`请先为该发言人设置参考音频` 等为中文硬编码。

### 2. 中英混用直接暴露给用户

前端小说推广执行流中，错误展示方式为：

```ts
alert(`${t('execution.prepareFailed')}: ${friendlyMessage}`)
```

`friendlyMessage` 直接来自 worker/API 的 `Error.message`。若后端抛出 `analysisModel is not configured`，用户会看到：

- **准备失败: analysisModel is not configured**

即前缀为中文、详情为英文技术键名，且无「去哪里配置」的明确引导。

### 3. 引导语入口不一致

- 「**项目设置**」：小说推广项目内设置弹窗（分析模型等）；
- 「**设置页面**」：易被理解为个人/账号设置；
- 「**用户配置**」：资产中心等场景下的用户级默认模型。

同一类「分析模型未配置」在不同模块用了不同措辞，用户难以统一理解应去「项目设置」还是「个人设置」配置。

### 4. 未纳入统一错误码与用户文案体系

- `src/lib/errors/codes.ts` 与 `user-messages.ts` 中已有 `UnifiedErrorCode` 与中文用户文案（如 `MISSING_CONFIG`）；
- 配置缺失类错误（如分析模型、角色模型、分镜模型等）未使用统一错误码（如 `MISSING_CONFIG` 或扩展 `ANALYSIS_MODEL_NOT_CONFIGURED`），也未通过 `getUserMessageByCode()` 走 i18n，导致无法统一替换为友好且可翻译的文案。

## 建议方向

1. **统一错误码与 i18n**
   - 为「分析模型未配置」等配置缺失定义统一错误码（或复用/扩展 `MISSING_CONFIG`），在 worker/API 层抛出带 `code` 的结构化错误；
   - 所有面向用户的报错文案放入 i18n（如 `errors.*` 或 `execution.*`），按 locale 输出，避免在业务代码中硬编码中/英字符串。

2. **统一引导语与入口描述**
   - 约定「分析模型」类配置的引导语（例如：项目内能力 →「请在当前项目的设置中配置分析模型」；用户默认 →「请在个人设置 → API 配置 中设置默认分析模型」）；
   - 同一语义只保留一种表述，并在文案中明确「项目设置」与「个人设置」的区分，避免「设置页面」「用户配置」等歧义说法混用。

3. **前端展示**
   - 根据错误 `code` 选择 i18n 文案或结构化消息，避免直接展示后端原始 `message`（尤其是英文技术键名）；
   - 需要时在错误提示中附带短引导（如「请打开右上角设置 → 分析模型」），而不是仅显示「准备失败: xxx」。

4. **清理历史硬编码**
   - 将现有 `analysisModel is not configured`、`请先在项目设置中配置分析模型` 等分散写法收敛为「抛统一 code + 前端/i18n 展示统一文案」，便于后续维护与多语言扩展。

## 验收预期

- 同一类配置缺失（如分析模型未配置）在任何入口仅对应一种错误码与一套 i18n key；
- 用户看到的报错与引导语为中文（或当前 locale），且明确指向「项目设置」或「个人设置」中的具体入口；
- 不再出现「准备失败: analysisModel is not configured」这类中英混用、无引导的裸技术文案。

---

## 镜头生成 / 分镜·视频任务失败：「请求参数不正确，请检查后重试」

### 现象

用户在进行「镜头生成」（分镜图、分镜视频等）时，看到：

- **生成失败**
- **请求参数不正确，请检查后重试**

### 原因

- 后端将上游（如火山引擎 ARK、LLM）返回的 400/参数类错误统一归类为 `INVALID_PARAMS`，前端对应展示上述通用文案。
- 若此前展示逻辑用通用文案覆盖了原始错误信息，用户无法看到具体原因（例如模型未开通、必填参数缺失、格式不合法等）。

### 已做改进

- **优先展示原始错误信息**：`resolveErrorDisplay` 在存在 `message` 时优先展示上游返回的原始内容，仅在无具体信息时回退到「请求参数不正确，请检查后重试」。
- 排查时可在应用/ worker 日志中搜索 `[ARK Image]`、`[ARK Video]`、`worker.failed` 等，查看完整错误体（如 `InvalidParameter`、`ModelNotOpen`、必填字段名等）。

---

## 视频任务大量失败：`[ARK Video] 第 x/3 次尝试失败` + AbortError / isTimeoutError

### 现象

日志中反复出现：

- `[ARK Video] 第 2/3 次尝试失败`（或 1/3、3/3）
- `"errorName": "AbortError"`, `"isTimeoutError": true`

### 原因

- **创建视频任务**的 POST 请求在未收到响应前被**超时中断**（AbortController）。
- 默认 60s 过短；跨境、ARK 排队或大图上传时，单次请求常超过 60s，导致 3 次重试都超时。

### 已做配置

- 在 `src/lib/generators/ark.ts` 中，视频任务创建已使用 **300 秒**超时（原 180s 仍可能不足），以减少 AbortError 与重试失败。
- 若仍大量超时：确认当前运行镜像/进程已包含该修改（重新构建并部署）；若 300s 仍不够，可再适当提高或排查网络/ARK 侧延迟。
