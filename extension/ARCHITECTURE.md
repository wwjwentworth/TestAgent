# Chrome 插件架构

技术栈为 Manifest V3、React、TypeScript、Vite 和 Less。`npm run build --workspace @bug-agent/extension` 产出的 `dist` 目录可以直接作为 Chrome 解压扩展加载。共享变量和基础样式位于 `src/styles`，Popup 与 Options 的页面样式分别就近维护，不能跨页面直接引用。

## 模块边界

- `src/popup`：React 录制入口、当前状态和快捷操作。
- `src/options`：React 服务端、项目及隐私策略配置。
- `src/background`：Manifest V3 Service Worker，后续负责录制会话生命周期、分片上传和浏览器 API 调度。
- `src/content`：后续负责页面操作、DOM 定位信息和页面异常采集。
- `src/domain`：录制状态、会话和跨上下文消息契约。
- `src/capabilities`：视频、页面证据与上传能力接口。
- `src/infrastructure`：`chrome.storage` 等平台适配器。

## 后续浏览器能力

- `chrome.tabCapture` + `MediaRecorder`：标签页视频。
- `chrome.debugger` + CDP：Console、Network 和页面异常。
- Content Script：操作事件、定位器候选和关键 DOM。
- IndexedDB：断网缓存与分片续传。
- Offscreen Document：长时间媒体编码与上传。

## 当前录制闭环

用户从 Popup 主动开始录制后：

1. Service Worker 附加当前标签页的 CDP，启用 Network 与 Runtime。
2. Content Script 记录点击、输入、选择事件的元素描述，但不保存输入值。
3. Offscreen Document 使用 `tabCapture` 与 `MediaRecorder` 编码 WebM 视频。
4. 开始、结束时分别截取当前标签页画面。
5. 停止录制后下载 `video.webm` 与 `evidence.json`。

插件目前申请 `tabCapture`、`debugger`、`offscreen` 和 `downloads` 权限。请求头中的 Authorization、Cookie 等字段和常见敏感 URL 参数会在证据包中脱敏。
