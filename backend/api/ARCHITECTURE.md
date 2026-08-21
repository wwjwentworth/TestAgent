# API 服务架构

`backend/api` 是 Bug Reproduction Agent 的服务端入口，负责接收浏览器插件采集的数据、管理录制会话、调度 Playwright 任务、聚合证据，并向 Web 管理平台提供查询接口。

当前阶段已实现系统接口以及录制视频的 multipart 上传、列表查询和 HTTP Range 流式播放。视频使用本地文件存储，后续可将 `RecordingStore` 替换为 OSS 实现。

## 技术栈

- Node.js 20+
- TypeScript，严格类型检查
- Fastify 5，HTTP Server 与插件机制
- `@fastify/cors`，本地 Web 平台跨域访问
- `tsx`，开发环境运行与 TypeScript 测试加载
- Node.js Test Runner，接口测试

计划接入但当前尚未启用：

- PostgreSQL：会话、任务、报告和集成配置
- Redis：缓存、分布式锁和任务队列
- BullMQ：Playwright 与 Agent 任务调度
- MinIO/阿里云 OSS：视频、截图、HAR 和 Trace
- OpenTelemetry：日志、指标和链路追踪

## 当前目录

```text
backend/api/
├── src/
│   ├── app.ts                 Fastify 应用工厂
│   ├── server.ts              进程启动与优雅退出
│   ├── config.ts              环境变量配置入口
│   ├── modules/
│   │   └── catalog.ts         服务端模块目录
│   └── routes/
│       ├── index.ts           路由统一注册
│       ├── health.ts          GET /health
│       ├── api-info.ts        GET /api
│       ├── recordings-upload.ts  上传 WebM
│       ├── recordings-list.ts    查询录制列表
│       └── recordings-video.ts   分段播放视频
├── test/
│   └── system.test.ts         Fastify inject 接口测试
├── dist/                      TypeScript 构建产物
├── package.json
└── tsconfig.json
```

## 请求链路

```text
Chrome Extension / Web Console
              │
              ▼
        Fastify Server
              │
              ▼
       Middleware / Hooks
      CORS → Auth → Request ID
              │
              ▼
        Route + Schema
              │
              ▼
     Application Service
              │
      ┌───────┼────────┐
      ▼       ▼        ▼
 Repository  Queue  Integration
      │       │        │
 PostgreSQL Redis   LLM/Yunxiao
```

当前代码只有 Route 层；从录制会话接口开始，业务流程必须进入 Application Service，不能直接写在路由处理函数中。

## 分层约束

后续按以下结构扩展：

```text
src/
├── routes/          HTTP 路径、Schema、状态码和参数解析
├── services/        用例编排和事务边界
├── domain/          领域模型、状态机和业务规则
├── repositories/    数据持久化接口及实现
├── integrations/    OSS、LLM、云效和代码仓库适配器
├── jobs/            队列生产者、消费者和任务协议
├── plugins/         Fastify 数据库、鉴权、日志等插件
└── shared/          错误、通用类型和基础工具
```

依赖方向必须保持为：

```text
routes → services → domain
                 ↘ repository interfaces
                 ↘ integration interfaces
```

- Domain 不依赖 Fastify、数据库 SDK 或厂商 SDK。
- Route 不直接访问数据库、Redis、OSS 或大模型。
- Integration 不包含业务流程，只实现外部系统协议转换。
- Worker 不在 API 进程执行不可信 Playwright 脚本。

## 路由规范

每个接口单独一个文件，文件名使用小写短横线：

```text
routes/
├── sessions-create.ts
├── sessions-get.ts
├── sessions-complete.ts
├── session-events-batch.ts
├── uploads-init.ts
├── executions-create.ts
├── executions-get.ts
└── reports-get.ts
```

每个路由文件只包含：

1. 请求参数和响应类型。
2. Fastify JSON Schema。
3. 路由注册函数。
4. 对 Application Service 的一次调用。
5. HTTP 响应映射。

禁止在路由中实现：

- 数据库事务
- 大模型调用
- 文件内容处理
- Playwright 执行
- 云效 OpenAPI 编排
- 多步骤业务状态变更

所有路由都由 `routes/index.ts` 显式注册。新增路由文件后必须更新该入口，避免依赖隐式文件扫描。

## API 约定

业务接口建议统一使用 `/api/v1` 前缀；系统接口保留在根路径：

```text
GET  /health
GET  /api

POST /api/v1/sessions
GET  /api/v1/sessions/:sessionId
POST /api/v1/sessions/:sessionId/events:batch
POST /api/v1/sessions/:sessionId/complete
POST /api/v1/sessions/:sessionId/executions
GET  /api/v1/executions/:executionId
GET  /api/v1/reports/:reportId
```

当前录制视频接口：

```text
POST /api/v1/recordings/:recordingId/video
GET  /api/v1/recordings
GET  /api/v1/recordings/:recordingId/video
```

上传接口使用 `multipart/form-data`，文件字段名为 `video`，只接受 `video/webm`，单文件上限为 250 MB。播放接口支持 `Range` 请求，供 HTML5 Video 拖动进度条。

响应错误后续统一为：

```json
{
  "error": {
    "code": "SESSION_NOT_FOUND",
    "message": "Recording session does not exist",
    "requestId": "req_xxx",
    "details": {}
  }
}
```

HTTP 状态码约定：

- `200`：查询或同步操作成功
- `201`：资源创建成功
- `202`：异步任务已进入队列
- `400`：请求格式或业务参数错误
- `401`：未认证
- `403`：没有项目权限
- `404`：资源不存在
- `409`：状态冲突或重复操作
- `413`：上传内容超过限制
- `422`：Schema 校验失败
- `429`：请求频率或任务额度超限
- `500`：未处理的服务端错误

## 核心领域对象

### BugSession

一次从插件开始录制到完成上传的 Bug 现场。

```text
created → recording → uploading → ready
    │          │           │
    └──────────┴───────────→ failed
```

### EvidenceArtifact

视频、截图、操作、Console、Network、HAR、Trace 等证据的元数据。大文件进入对象存储，数据库只保存索引、校验值和访问策略。

### Execution

Playwright 复现任务。API 只创建任务和查询状态，实际执行交给隔离 Worker。

```text
queued → running → passed
                 ↘ failed
                 ↘ cancelled
                 ↘ timed_out
```

### AgentRun

脚本修正、问题诊断或修复建议任务。必须记录模型、Prompt 版本、工具调用、Token 使用和输出证据引用。

## 数据存储原则

- PostgreSQL 保存业务实体与证据元数据。
- Redis 保存短期状态、锁和任务队列，不作为最终数据源。
- 视频、截图、HAR、Trace 和报告附件存入对象存储。
- 上传使用预签名 URL，文件内容不经过 API 进程转发。
- 所有对象必须带 tenant、project 和 session 维度的隔离路径。
- 证据必须支持过期时间和主动删除。

## 安全边界

- 插件上传前和 API 接收后均执行敏感信息检查。
- Cookie、Authorization、密码、Token 等不得进入普通日志。
- LLM 调用前执行二次脱敏。
- 云效 Token、模型密钥和对象存储密钥不能存入代码或响应。
- API 进程不能执行用户生成的 Playwright 或 Shell 代码。
- Worker 使用独立容器、非 root 用户、资源限制和网络白名单。
- 对上传大小、批次数量、事件数量和请求频率设置硬限制。

## 配置

配置统一从环境变量读取，目前支持：

| 变量                      |        默认值 | 用途            |
| ------------------------- | ------------: | --------------- |
| `API_PORT`                |        `3001` | HTTP 端口       |
| `API_HOST`                |     `0.0.0.0` | 监听地址        |
| `APP_ENV`                 | `development` | 运行环境        |
| `DATABASE_URL`            |            空 | PostgreSQL 连接 |
| `REDIS_URL`               |            空 | Redis 连接      |
| `OBJECT_STORAGE_ENDPOINT` |            空 | MinIO/OSS 地址  |
| `RECORDINGS_DIR`          | `./data/recordings` | MVP 视频本地存储目录 |

生产环境启动时必须校验必填配置，不能带缺失配置进入监听状态。

## 开发与验证

从仓库根目录运行：

```bash
npm install
npm run dev:api
```

API 地址：

```text
http://localhost:3001/health
http://localhost:3001/api
```

单独验证 API：

```bash
npm run typecheck --workspace @bug-agent/api
npm run build --workspace @bug-agent/api
npm run test --workspace @bug-agent/api
```

接口测试优先使用 `Fastify.inject()`，不监听真实端口，因此速度更快，也适合受限的 CI 环境。

## 下一阶段实施顺序

1. 引入统一错误模型、Request ID 和结构化日志。
2. 定义 Session、Event、Artifact 的共享 Schema。
3. 接入 PostgreSQL Repository 和迁移工具。
4. 实现插件会话创建、事件批量写入和会话完成接口。
5. 接入对象存储预签名上传。
6. 接入 Redis/BullMQ，创建 Playwright 执行任务。
7. 实现执行结果、报告和证据查询接口。
8. 接入 LLM Gateway 和 Yunxiao Adapter。
