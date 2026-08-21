# 项目架构约束

## 目标

本仓库先建立可运行、可演进的模块边界。当前骨架不采集用户数据、不执行浏览器、不调用大模型或云效。

## 数据流

```text
Chrome Extension
  -> API / Session & Ingestion
  -> Object Storage + PostgreSQL
  -> Queue
  -> Playwright Worker
  -> Evidence & Report
  -> Web Console

Agent Core
  -> Playwright Generator
  -> LLM Gateway
  -> Repository tools
  -> Yunxiao Adapter
```

## 分层规则

- `backend` 是服务端层，包含 API、异步 Worker 和服务端共享能力。
- `frontend` 是 Web 管理端，只通过 HTTP API 与服务端通信。
- `extension` 是浏览器插件层，负责采集和上传，不承载服务端业务规则。
- `Agent` 是模型层，封装 Agent 编排、模型调用和脚本生成，不依赖具体 Web 框架。
- 层间依赖方向为 `frontend / extension -> backend -> Agent`；模型层不反向依赖界面或服务端实现。
- API 负责鉴权、业务流程和任务投递，不直接运行不可信 Playwright 代码。
- Worker 必须在隔离环境执行脚本，后续不能挂载宿主机源码或 Docker socket。
- LLM 与云效只能通过各自适配器调用，业务模块不得直接依赖厂商 SDK。
- 视频、截图、HAR 和 Trace 存入对象存储，数据库只保存元数据与索引。
- 所有采集协议以 `event-schema` 为唯一来源，插件和后端不得各自定义一套事件格式。

## 服务端

服务端位于 `backend/api`，采用 Node.js、Fastify 和 TypeScript；执行进程位于 `backend/worker`。API 目录按 `routes`、`services`、`domain`、`integrations` 分层：路由只负责 HTTP 协议，业务流程进入 services，领域模型进入 domain，外部依赖进入 integrations。

## Web 平台

Web 管理平台位于 `frontend`，采用 React + TypeScript + Vite + Less。页面、导航定义和领域类型分别维护，后续新增数据访问时应集中放入 `src/api`，不要在展示组件中直接调用 `fetch`。Less 按 `styles`、`layout`、`components` 和 `pages` 分层，禁止重新建立全量单文件样式。

## 插件与模型

浏览器插件位于 `extension`，其领域协议应复用 `backend/packages/event-schema`。模型能力位于 `Agent`，服务端只能通过 Agent 层公开接口调用模型或生成 Playwright 脚本，不能在路由或界面中直接接入模型厂商 SDK。

## 下一阶段建议顺序

1. 定义 Session、Event、Artifact 的正式 Schema 与数据库迁移。
2. 实现插件操作采集和分片上传。
3. 实现规则型 Playwright 生成器和 Worker 沙箱。
4. 实现证据时间线与报告。
5. 接入模型增强和云效适配器。
