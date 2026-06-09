import { spawn } from 'node:child_process';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const cwd = dirname(fileURLToPath(import.meta.url));
const portEnv = process.env.FRONTEND_PORT || process.env.PORT || '3000';
const hostEnv = process.env.FRONTEND_HOST || process.env.HOST || '0.0.0.0';
const port = Number(portEnv);
const displayHost = hostEnv === '0.0.0.0' ? 'localhost' : hostEnv;

if (Number.isNaN(port)) {
  console.error(`[start-server] 无效的端口：${portEnv}`);
  process.exit(1);
}

const env = {
  ...process.env,
  PORT: String(port),
  FRONTEND_PORT: String(port),
  FRONTEND_HOST: hostEnv,
  VITE_FRONTEND_URL:
    process.env.VITE_FRONTEND_URL || `http://${displayHost}:${port}`,
};

console.log(
  `[start-server] 启动 Vite 开发服务器: http://${displayHost}:${port}`
);

// Windows 下需要使用 shell: true 来正确执行 npm
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const spawnArgs = [
  'run',
  'dev',
  '--',
  '--host',
  hostEnv,
  '--port',
  String(port),
];

const child = spawn(npmCommand, spawnArgs, {
  cwd,
  env,
  stdio: 'inherit',
  shell: true,
});

const shutdown = signal => {
  if (!child.killed) {
    console.log(`[start-server] 接收到 ${signal || '退出'}，正在停止 Vite...`);
    child.kill(signal);
  }
};

child.on('error', err => {
  console.error('[start-server] 无法启动 Vite：', err.message);
  process.exit(1);
});

child.on('exit', (code, signal) => {
  if (signal) {
    console.log(`[start-server] Vite 因信号 ${signal} 退出`);
    process.exit(0);
  }
  if (code !== 0) {
    console.error(`[start-server] Vite 退出，代码 ${code}`);
    process.exit(code);
  }
  console.log('[start-server] Vite 已正常退出');
  process.exit(0);
});

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('exit', () => shutdown());
