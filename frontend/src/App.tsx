import { useState } from "react";
import { RecordingsPage } from "./pages/RecordingsPage";

export function App() {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div className="shell">
      <aside className={`sidebar ${menuOpen ? "open" : ""}`}>
        <a className="brand" href="#/executions">
          <span className="brand-mark">BA</span>
          <span>
            <strong>Bug Agent</strong>
            <small>测试自动化平台</small>
          </span>
        </a>
        <nav aria-label="主导航">
          <div>
            <p className="nav-label">工作台</p>
            <a className="active" href="#/executions">
              复现任务
            </a>
          </div>
        </nav>
        <div className="sidebar-foot">
          <span className="status-dot" />
          API 与执行服务可用
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
            <strong>复现任务</strong>
          </div>
          <div className="top-actions">
            <span className="environment">开发环境</span>
            <button className="primary" disabled>
              新建录制
            </button>
          </div>
        </header>
        <main>
          <header className="page-heading">
            <h1>复现任务</h1>
            <p>查看录制证据、Playwright 复现脚本及执行结果。</p>
          </header>
          <RecordingsPage />
        </main>
      </div>
    </div>
  );
}
