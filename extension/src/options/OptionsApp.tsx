import { useEffect, useState } from "react";
import { loadSettings, saveSettings } from "../infrastructure/settings-store";

export function OptionsApp() {
  const [apiBaseUrl, setApiBaseUrl] = useState("http://localhost:3001");
  const [status, setStatus] = useState<string>();
  useEffect(() => { void loadSettings().then((settings) => setApiBaseUrl(settings.apiBaseUrl)); }, []);
  async function save() {
    try {
      const url = new URL(apiBaseUrl);
      if (!/^https?:$/.test(url.protocol)) throw new Error("仅支持 HTTP 或 HTTPS 地址");
      const granted = await chrome.permissions.request({ origins: [`${url.origin}/*`] });
      if (!granted) throw new Error("未获得该服务端地址的访问权限");
      await saveSettings({ apiBaseUrl: url.origin });
      setStatus("设置已保存");
    } catch (error) { setStatus(error instanceof Error ? error.message : String(error)); }
  }
  return <main className="options"><span className="logo">BA</span><h1>插件设置</h1><p>配置插件与 Bug Agent Web 平台的连接。</p><section className="settings-card"><h2>平台连接</h2><div className="field"><label htmlFor="server">服务端地址</label><input id="server" value={apiBaseUrl} onChange={(event) => setApiBaseUrl(event.target.value)} /><small>录制停止后，WebM 视频会上传至该服务端。</small></div><button className="save" onClick={() => void save()}>保存设置</button>{status && <p className="setting-status">{status}</p>}</section><section className="settings-card"><h2>隐私与脱敏</h2><p>密码、令牌、Cookie 和敏感输入默认不采集。</p></section></main>;
}
