import { readFile } from "node:fs/promises";
import { chromium } from "playwright-core";

const scriptPath = process.argv[2];
if (!scriptPath) throw new Error("SCRIPT_PATH_REQUIRED");
const source = await readFile(scriptPath, "utf8");
validate(source);
const startedAt = Date.now();
globalThis.__bugAgentPlaywright = { chromium };
const executableSource = source.replace('import { chromium } from "playwright-core";', 'const { chromium } = globalThis.__bugAgentPlaywright;');
await import(`data:text/javascript;base64,${Buffer.from(executableSource).toString("base64")}`);
process.stdout.write(JSON.stringify({ ok: true, durationMs: Date.now() - startedAt }));

function validate(source) {
  if (Buffer.byteLength(source) > 100_000) throw new Error("SCRIPT_TOO_LARGE");
  const string = '"(?:\\\\.|[^"\\\\])*"';
  const locator = `page\\.(?:getByTestId\\(${string}\\)|getByLabel\\(${string}\\)|getByText\\(${string}, \\{ exact: true \\}\\)|getByRole\\(${string}, \\{ name: ${string} \\}\\)|locator\\(${string}\\)(?:\\.first\\(\\))?)`;
  const allowed = [
    /^import \{ chromium \} from "playwright-core";$/,
    /^const browser = await chromium\.launch\(\{ headless: true, executablePath: process\.env\.CHROME_PATH \}\);$/,
    /^const context = await browser\.newContext\(\);$/,
    /^const page = await context\.newPage\(\);$/,
    new RegExp(`^await page\\.goto\\(${string}, \\{ waitUntil: "domcontentloaded" \\}\\);$`),
    new RegExp(`^await ${locator}\\.(?:click\\(\\)|fill\\(${string}\\)|selectOption\\(${string}\\));$`),
    /^await page\.screenshot\(\{ path: "execution-final\.png", fullPage: true \}\);$/,
    /^await browser\.close\(\);$/,
    /^\/\/ [^\r\n]*$/,
  ];
  for (const [index, line] of source.split(/\r?\n/).entries()) {
    if (!line.trim()) continue;
    if (!allowed.some((rule) => rule.test(line))) throw new Error(`UNSAFE_SCRIPT_LINE:${index + 1}`);
  }
}
