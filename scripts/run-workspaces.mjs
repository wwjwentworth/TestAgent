import { spawn } from 'node:child_process';

const script = process.argv[2];
if (!script) {
  console.error('Usage: node scripts/run-workspaces.mjs <script>');
  process.exit(1);
}

const workspaces = [
  '@bug-agent/event-schema',
  '@bug-agent/evidence-sdk',
  '@bug-agent/yunxiao-adapter',
  '@bug-agent/playwright-generator',
  '@bug-agent/llm-gateway',
  '@bug-agent/agent-core',
  '@bug-agent/api',
  '@bug-agent/console',
  '@bug-agent/extension',
  '@bug-agent/worker'
];

for (const workspace of workspaces) {
  const exitCode = await new Promise((resolve) => {
    const child = spawn('npm', ['run', script, '--workspace', workspace], {
      stdio: 'inherit',
      shell: false
    });
    child.on('exit', (code) => resolve(code ?? 1));
  });

  if (exitCode !== 0) process.exit(exitCode);
}
