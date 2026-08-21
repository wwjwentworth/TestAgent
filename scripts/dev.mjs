import { spawn } from 'node:child_process';

const commands = [
  ['API', ['run', 'dev', '--workspace', '@bug-agent/api']],
  ['CONSOLE', ['run', 'dev', '--workspace', '@bug-agent/console']],
  ['WORKER', ['run', 'dev', '--workspace', '@bug-agent/worker']]
];

const children = commands.map(([name, args]) => {
  const child = spawn('npm', args, { stdio: 'inherit', shell: false });
  child.on('exit', (code) => {
    if (code && code !== 0) console.error(`${name} exited with code ${code}`);
  });
  return child;
});

function shutdown() {
  for (const child of children) child.kill('SIGTERM');
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
