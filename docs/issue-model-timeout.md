# Issue：模型调用超时（Timeout）

## 问题简述

调用外部模型或第三方 API（图片生成、视频任务创建、大模型等）时，请求可能因**超时**被中断而失败。表现因场景而异：部分请求成功、部分失败；重试多次仍报错；日志中出现 `fetch failed`、`AbortError`、`HeadersTimeoutError` 等。

根因往往是**多层超时**叠加：除了业务代码里显式设置的超时，Node.js 的 `fetch` 底层（undici）也有默认的 headers/body 超时；若服务端响应慢（跨境、排队、大 payload），任一层超时都会导致请求失败。

---

## 多层超时说明

| 层级 | 说明 | 典型触发方式 |
|------|------|----------------|
| **应用层** | 业务或封装层用 AbortController / setTimeout 限制单次请求等待时间 | 如 `timeoutMs` 参数，超时后 `controller.abort()` |
| **运行时层** | Node 内置 `fetch` 使用 undici，对「等待响应头」「接收 body」有默认超时 | 未传入自定义 Agent 时使用 undici 默认配置 |

仅调大应用层超时可能仍不够：若未覆盖底层，undici 的 headers 超时仍会触发，错误常以 `TypeError: fetch failed`、`cause: HeadersTimeoutError` 等形式出现。

---

## 可选策略

- **需要上限时**：在封装请求处传入足够大的 `timeoutMs`（或等价参数），并保证该值大于业务预期与网络波动。
- **不设应用层超时**：对可接受长时间等待的请求（如任务创建、排队型 API），可传 `timeoutMs: 0` 或「不设超时」；此时应同时**关闭或放宽底层超时**，否则 undici 仍会因默认 headers/body 超时中断请求。
- **关闭 undici 超时**：在 Node 环境下，对「不设超时」的请求使用 undici 的 `Agent`，将 `headersTimeout`、`bodyTimeout`、`connectTimeout` 设为 `0`，并以 `dispatcher` 形式传入 `fetch`，避免 `HeadersTimeoutError`。

---

## 典型错误与对应层

| 错误类型 / 现象 | 含义 | 对应层 |
|-----------------|------|--------|
| `AbortError`，`This operation was aborted` | 在设定时间内未完成，被主动中止 | 应用层（AbortController 等） |
| `HeadersTimeoutError`，`fetch failed`，`isNetworkError: true` | 在等待响应头或 body 时超时 | 运行时层（undici 默认 Agent） |
| 重试多次仍失败 | 单次请求在某一层反复超时 | 需根据具体错误信息判断是哪一层 |

排查时可在日志中搜索上述关键字，或搜索请求的 logPrefix（如各模型/接口的标识），结合堆栈定位到封装请求的代码与超时参数。

---

## ARK 模型示例

本项目中火山引擎 ARK（图片 Seedream、视频 Seedance）的调用统一走 `src/lib/ark-api.ts`，超时行为如下。

| 能力 | 应用层超时 | 底层（undici） | 说明 |
|------|------------|----------------|------|
| **ARK 图片生成** | 180s | 默认 | 高分辨率/长 prompt 易超过 60s，故显式传 `timeoutMs: 180 * 1000`（`ark.ts` → `arkImageGeneration`）。 |
| **ARK 视频任务创建** | 不设（0） | 无超时 Agent | 跨境/排队时可能很久，传 `timeoutMs: 0`，并用 undici `Agent` 将 headers/body/connect 超时设为 0，避免 `HeadersTimeoutError`（`ark.ts` → `arkCreateVideoTask`）。 |

**典型日志**：失败时会出现 `[ARK Image]` 或 `[ARK Video]` 的「第 x/3 次尝试失败」；若为 `HeadersTimeoutError` 或 `fetch failed`，多为底层 undici 超时，需确保该请求在 `timeoutMs <= 0` 时走无超时 Agent。实现见 `ark-api.ts` 的 `fetchWithTimeout`、`NO_TIMEOUT_AGENT` 及 `ark.ts` 中的调用参数。

---

## 后续建议

- **监控**：对关键模型/接口的失败率、耗时做统计，便于区分偶发与系统性超时，并决定是否调大或取消超时。
- **新接入模型**：若新接 HTTP 模型且存在长耗时请求，可复用「应用层不设超时 + undici 无超时 Agent」的模式，避免底层误杀。
- **Worker / Job 超时**：当单次请求不设超时时，需依赖 Worker 或队列的 job timeout、进程重启策略做兜底；建议与业务预期对齐，避免任务长期挂起。

---

## 本项目中实现参考

- 请求封装与超时、重试、undici Agent：`src/lib/ark-api.ts`（`fetchWithTimeout`、`NO_TIMEOUT_AGENT`）。
- 各模型调用处传入的 `timeoutMs` 或「不设超时」：见对应 generator 或 API 封装（如 `src/lib/generators/ark.ts`）。
- 错误展示与用户提示：`docs/issue-error-and-guide-messages.md`。
