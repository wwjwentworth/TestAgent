import type { PageDefinition, RouteKey } from './types';

export const pages: Record<RouteKey, PageDefinition> = {
  overview: { title: '概览', description: '查看测试 Agent 的运行状态与最近活动。' },
  sessions: { title: 'Bug 会话', description: '管理浏览器插件采集的 Bug 现场。' },
  executions: { title: '复现任务', description: '查看 Playwright 脚本执行任务及状态。' },
  reports: { title: '测试报告', description: '集中查看视频、截图、日志和请求证据。' },
  agents: { title: 'Agent 中心', description: '管理复现、诊断和修复 Agent。' },
  integrations: { title: '集成管理', description: '配置大模型、阿里云效和对象存储。' },
  settings: { title: '项目设置', description: '管理项目成员、环境和数据安全策略。' }
};

export const navigation: Array<{ label: string; items: Array<[RouteKey, string]> }> = [
  { label: '工作台', items: [['overview', '概览'], ['sessions', 'Bug 会话'], ['executions', '复现任务'], ['reports', '测试报告']] },
  { label: '能力', items: [['agents', 'Agent 中心'], ['integrations', '集成管理'], ['settings', '项目设置']] }
];

export function routeFromHash(hash: string): RouteKey {
  const route = hash.replace('#/', '') as RouteKey;
  return route in pages ? route : 'overview';
}
