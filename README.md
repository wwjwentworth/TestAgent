# Bug Reproduction Agent

自动化测试 Agent 的最小项目骨架。当前阶段只提供模块边界、健康检查、占位页面和扩展入口，不包含录制、脚本生成、模型调用或云效集成功能。

## 目录

```text
backend/                   服务端层
  api/                     Node.js + Fastify + TypeScript API
  worker/                  Playwright 执行 Worker 骨架
  packages/
    event-schema/          采集事件领域模型
    evidence-sdk/          证据存储接口
    yunxiao-adapter/       云效适配接口
frontend/                  React + TypeScript Web 控制台
extension/                 React + TypeScript Chrome Manifest V3 插件
Agent/                     模型与智能编排层
  agent-core/              Agent 编排接口
  llm-gateway/             大模型适配接口
  playwright-generator/    脚本生成接口
infra/
  docker-compose.yml      PostgreSQL、Redis、MinIO
docs/
  architecture.md         架构与开发约束
```

## 本地运行

要求 Node.js 20 以上。首次运行安装依赖：

```bash
cp .env.example .env
npm install
npm run check
npm run dev
```

打开：

- Console: http://localhost:3000
- API health: http://localhost:3001/health
- API info: http://localhost:3001/api

`Ctrl+C` 会同时关闭三个进程。

Web 平台使用 React 19、TypeScript 和 Vite 6，目前包含概览、Bug 会话、复现任务、测试报告、Agent 中心、集成管理和项目设置等页面骨架；所有业务按钮均保持禁用，防止将占位界面误认为已实现功能。

## 加载插件

1. 打开 Chrome 的 `chrome://extensions`。
2. 开启开发者模式。
3. 选择“加载已解压的扩展程序”。
4. 先执行 `npm run build --workspace @bug-agent/extension`。
5. 选择 `extension/dist` 目录。

插件采用 React、TypeScript、Vite 和 Manifest V3，已经支持从 Popup 开始/停止单标签页录制。停止后会下载 WebM 视频和 JSON 证据包，证据包含起止截图、操作、Console、异常与 Network 元数据。该能力需要 `tabCapture`、`debugger`、`offscreen` 和 `downloads` 权限。

录制停止后，插件还会把 WebM 上传至 `http://localhost:3001`。服务端默认保存到 `backend/api/data/recordings`，Web 平台的“测试报告”页面会读取录制列表并支持在线播放。修改插件服务端地址后，Chrome 会请求对应站点访问权限。

## 基础设施

安装 Docker 后可执行：

```bash
docker compose -f infra/docker-compose.yml up -d
```

当前服务还不会连接这些基础设施；配置只是为下一阶段预留。

## 证据采集 API

插件与服务端共享版本化的 `event-schema`。一次录制依次调用：

```text
POST /api/v1/sessions
POST /api/v1/sessions/:sessionId/events
POST /api/v1/sessions/:sessionId/artifacts?kind=start-screenshot|end-screenshot|evidence
POST /api/v1/recordings/:sessionId/video
POST /api/v1/sessions/:sessionId/complete
GET  /api/v1/sessions/:sessionId
```

当前 MVP 将 Session、事件和制品保存在 `backend/api/data/recordings/<sessionId>`；后续可由同一存储接口迁移到 PostgreSQL 与对象存储。

录制完成时会同步生成 `reproduction.mjs`。测试报告和复现任务页面支持编辑脚本、编辑原始事件并重新生成，以及在受限 Playwright Worker 中运行脚本。Worker 默认调用 macOS 的 Google Chrome；其他环境通过 `CHROME_PATH` 指定 Chromium 可执行文件。

可编辑与运行接口：

```text
PUT  /api/v1/sessions/:sessionId/events
PUT  /api/v1/sessions/:sessionId/script
DELETE /api/v1/sessions/:sessionId/script
POST /api/v1/sessions/:sessionId/script/regenerate
DELETE /api/v1/sessions/:sessionId
POST /api/v1/sessions/:sessionId/script/run
GET  /api/v1/sessions/:sessionId/execution-screenshot
```
