#!/usr/bin/env node
/**
 * 释放中间层端口（默认 3000），便于终端断联等场景后再次启动不报 EADDRINUSE。
 * 由 predev 自动调用，也可单独执行：PORT=3000 tsx scripts/release-port.ts
 */
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..', '..');
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(root, '.env') });

const port = Number(process.env.PORT) || 3000;

try {
  const out = execSync(`lsof -ti :${port}`, {
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  const pids = out.trim().split(/\s+/).filter(Boolean);
  for (const pid of pids) {
    try {
      process.kill(Number(pid), 'SIGTERM');
      console.log(`Released port ${port}: killed PID ${pid}`);
    } catch {
      try {
        process.kill(Number(pid), 'SIGKILL');
      } catch {
        // ignore
      }
    }
  }
  if (pids.length === 0 && out.trim()) {
    console.log(`Released port ${port}`);
  }
} catch {
  // lsof 无输出或命令不存在：无进程占用
}
