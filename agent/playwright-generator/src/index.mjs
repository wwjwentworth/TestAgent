export class PlaywrightGenerator {
  generate(session, events) {
    const lines = [
      'import { chromium } from "playwright-core";',
      'const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH });',
      'const context = await browser.newContext();',
      'const page = await context.newPage();',
    ];
    if (session.pageUrl) lines.push(`await page.goto(${literal(session.pageUrl)}, { waitUntil: "domcontentloaded" });`);
    for (const event of events) {
      if (event.source !== "action") continue;
      const locator = locatorFor(event.data?.target ?? {});
      if (!locator) { lines.push(`// 跳过无法定位的 ${event.type} 操作`); continue; }
      if (event.type === "click") lines.push(`await ${locator}.click();`);
      else if (event.type === "input") lines.push(`await ${locator}.fill(${literal(String(event.data?.value ?? ""))});`);
      else if (event.type === "change" && event.data?.target?.tag === "select") lines.push(`await ${locator}.selectOption(${literal(String(event.data?.value ?? ""))});`);
      else if (event.type === "change") lines.push(`await ${locator}.fill(${literal(String(event.data?.value ?? ""))});`);
      else if (event.type === "select") lines.push(`await ${locator}.selectOption(${literal(String(event.data?.value ?? ""))});`);
    }
    lines.push('await page.screenshot({ path: "execution-final.png", fullPage: true });');
    lines.push('await browser.close();');
    return `${lines.join("\n")}\n`;
  }
}

function locatorFor(target) {
  if (target.testId) return `page.getByTestId(${literal(String(target.testId))})`;
  if (target.role && (target.ariaLabel || target.text)) return `page.getByRole(${literal(String(target.role))}, { name: ${literal(String(target.ariaLabel ?? target.text))} })`;
  if (target.ariaLabel) return `page.getByLabel(${literal(String(target.ariaLabel))})`;
  if (target.id) return `page.locator(${literal(`#${cssEscape(String(target.id))}`)})`;
  if (target.name) return `page.locator(${literal(`[name="${cssEscape(String(target.name))}"]`)})`;
  if (target.text) return `page.getByText(${literal(String(target.text))}, { exact: true })`;
  if (target.tag) return `page.locator(${literal(String(target.tag))}).first()`;
  return undefined;
}
function literal(value) { return JSON.stringify(value).replace(/</g, "\\u003c"); }
function cssEscape(value) { return value.replace(/[^a-zA-Z0-9_-]/g, (character) => `\\${character}`); }
