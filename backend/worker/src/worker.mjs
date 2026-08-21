const intervalMs = Number(process.env.WORKER_POLL_INTERVAL_MS ?? 5000);
console.log('Worker ready (queue adapter is not implemented yet)');

const timer = setInterval(() => {}, intervalMs);

function shutdown() {
  clearInterval(timer);
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
