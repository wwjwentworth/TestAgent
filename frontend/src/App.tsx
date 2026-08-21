import { useEffect, useState } from "react";
import { navigation, pages, routeFromHash } from "./navigation";
import type { RouteKey } from "./types";
import { RecordingsPage } from "./pages/RecordingsPage";

export function App() {
  const [route, setRoute] = useState<RouteKey>(() =>
    routeFromHash(location.hash),
  );
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onHashChange = () => {
      setRoute(routeFromHash(location.hash));
      setMenuOpen(false);
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const page = pages[route];
  return (
    <div className="shell">
      <aside className={`sidebar ${menuOpen ? "open" : ""}`}>
        <a className="brand" href="#/overview">
          <span className="brand-mark">BA</span>
          <span>
            <strong>Bug Agent</strong>
            <small>测试自动化平台</small>
          </span>
        </a>
        <nav aria-label="主导航">
          {navigation.map((group) => (
            <div key={group.label}>
              <p className="nav-label">{group.label}</p>
              {group.items.map(([key, label]) => (
                <a
                  key={key}
                  href={`#/${key}`}
                  className={route === key ? "active" : ""}
                >
                  {label}
                </a>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-foot">
          <span className="status-dot" />
          API 骨架可用
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <button
            className="menu-button"
            onClick={() => setMenuOpen((value) => !value)}
            aria-label="切换菜单"
          >
            ☰
          </button>
          <div>
            <span className="crumb">测试空间 / </span>
            <strong>{page.title}</strong>
          </div>
          <div className="top-actions">
            <span className="environment">开发环境</span>
            <button className="primary" disabled>
              新建录制
            </button>
          </div>
        </header>
        <main>
          <Page route={route} />
        </main>
      </div>
    </div>
  );
}

function Page({ route }: { route: RouteKey }) {
  const page = pages[route];
  return (
    <>
      <PageHeading title={page.title} description={page.description} />
      {pageContent(route)}
    </>
  );
}

function PageHeading({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <header className="page-heading">
      <h1>{title}</h1>
      <p>{description}</p>
    </header>
  );
}

function pageContent(route: RouteKey) {
  if (route === "overview") return <Overview />;
  if (route === "agents") return <AgentCenter />;
  if (route === "integrations") return <Integrations />;
  if (route === "reports") return <RecordingsPage />;
  if (route === "settings") return <Empty message="设置模块尚未接入" />;
  const messages: Partial<Record<RouteKey, string>> = {
    sessions: "尚无 Bug 会话",
    executions: "尚无复现任务",
  };
  return <PlaceholderTable message={messages[route] ?? "暂无数据"} />;
}

function Overview() {
  return (
    <>
      <section className="metrics">
        <Metric label="Bug 会话" value="0" note="等待插件采集" />
        <Metric label="复现成功率" value="—" note="暂无执行数据" />
        <Metric label="待处理缺陷" value="0" note="云效尚未连接" />
        <Metric label="Agent 任务" value="0" note="模型尚未配置" />
      </section>
      <section className="grid">
        <article className="card">
          <h2>最近会话</h2>
          <Empty message="安装插件并开始第一次 Bug 录制" />
        </article>
        <article className="card">
          <h2>系统能力</h2>
          <ModuleList />
        </article>
      </section>
    </>
  );
}

function Metric({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <article className="card">
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
      <div className="metric-note">{note}</div>
    </article>
  );
}

function ModuleRow({
  name,
  detail,
  state,
}: {
  name: string;
  detail: string;
  state: string;
}) {
  return (
    <div className="module">
      <div>
        <strong>{name}</strong>
        <small>{detail}</small>
      </div>
      <span className="badge">{state}</span>
    </div>
  );
}

function ModuleList() {
  return (
    <div className="module-list">
      <ModuleRow name="浏览器采集" detail="录制与上传" state="已接入" />
      <ModuleRow name="脚本生成" detail="Playwright" state="待实现" />
      <ModuleRow name="智能分析" detail="LLM Gateway" state="待实现" />
      <ModuleRow name="研发协同" detail="Yunxiao" state="待实现" />
    </div>
  );
}

function AgentCenter() {
  return (
    <section className="card">
      <div className="module-list">
        {["复现 Agent", "诊断 Agent", "修复 Agent"].map((name) => (
          <ModuleRow key={name} name={name} detail="接口占位" state="未启用" />
        ))}
      </div>
    </section>
  );
}

function Integrations() {
  return (
    <section className="grid">
      <article className="card">
        <h2>大模型</h2>
        <ModuleRow name="Mock Provider" detail="本地占位适配器" state="默认" />
      </article>
      <article className="card">
        <h2>研发平台</h2>
        <ModuleRow name="阿里云效" detail="OpenAPI Adapter" state="未连接" />
      </article>
    </section>
  );
}

function PlaceholderTable({ message }: { message: string }) {
  return (
    <section className="card table-shell">
      <div className="toolbar">
        <input className="search" placeholder="搜索（功能待实现）" disabled />
      </div>
      <table>
        <thead>
          <tr>
            <th>名称</th>
            <th>状态</th>
            <th>更新时间</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td colSpan={3}>
              <Empty message={message} />
            </td>
          </tr>
        </tbody>
      </table>
    </section>
  );
}

function Empty({ message }: { message: string }) {
  return (
    <div className="empty">
      <div>
        <strong>{message}</strong>当前仅提供前端架构和展示占位
      </div>
    </div>
  );
}
