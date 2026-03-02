# Issue：分镜图传给视频模型前应做降采样

## 问题简述

分镜图（panel image）由 Seedream 以 **4K 分辨率**（如 3072×5456）生成，而视频生成（Seedance）最高仅支持 **1080p**。当前逻辑是直接把 4K 图片的 base64 传给 Seedance 作为首帧，导致：

- **带宽浪费**：传输远超视频所需分辨率的像素，请求体显著偏大。
- **请求体超限风险**：容易触及 ARK 的请求体大小限制，增加失败率或超时。

## 建议方向

在调用 Seedance 前，对首帧图片做**降采样**，将分辨率缩至视频输出档位（如 1080p 或更低），再转 base64 传给 ARK。这样既减小请求体、降低超限风险，又减少传输与处理开销。

## 涉及能力

- **分镜图生成**：Seedream，输出 4K（如 3072×5456）。
- **视频任务创建**：Seedance，输出最高 1080p。
- **首帧图片**：当前将 panel image URL 转 base64 后直接传给 Seedance。

## 实现参考

- 视频生成入口、首帧图片获取与 base64 转换：`src/lib/generators/ark.ts`（`ArkVideoGenerator.doGenerate`）、`src/lib/ark-api.ts`。
- 图片尺寸与视频 resolution 映射：Seedance 的 `resolution` 选项（480p / 720p / 1080p），可据此决定降采样目标尺寸。
