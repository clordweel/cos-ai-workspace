/**
 * 会话文件存储：单文件 JSON，SESSION_STORE=file 时使用
 * 启动时加载，运行时 set/delete 后防抖写回，重启后会话保留。见 docs/SESSION_PERSISTENCE.md
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { existsSync } from 'node:fs';
import type { SessionData } from './sessionStore.js';

const WRITE_DEBOUNCE_MS = 500;
const LOG_TAG = '[sessionStoreFile]';

export interface FileStoreOptions {
  filePath: string;
}

/** 单文件 JSON 存储：key 为 sessionId，value 为 SessionData */
export class FileStore {
  private filePath: string;
  private map = new Map<string, SessionData>();
  private loaded = false;
  private writeTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(options: FileStoreOptions) {
    this.filePath = options.filePath;
  }

  private async load(): Promise<void> {
    if (this.loaded) return;
    this.loaded = true;
    if (!existsSync(this.filePath)) return;
    try {
      const raw = await readFile(this.filePath, 'utf-8');
      const data = JSON.parse(raw) as Record<string, SessionData>;
      const now = Date.now();
      for (const [id, s] of Object.entries(data)) {
        if (s && typeof s.expiresAt === 'number' && s.expiresAt >= now) {
          this.map.set(id, s);
        }
      }
    } catch (e) {
      console.warn(`${LOG_TAG} 加载会话文件失败 (${this.filePath}):`, e);
    }
  }

  private scheduleWrite(): void {
    if (this.writeTimer) return;
    this.writeTimer = setTimeout(() => {
      this.writeTimer = null;
      this.flush().catch((e) => console.warn(`${LOG_TAG} 写回会话文件失败:`, e));
    }, WRITE_DEBOUNCE_MS);
  }

  private async flush(): Promise<void> {
    const now = Date.now();
    const obj: Record<string, SessionData> = {};
    for (const [id, s] of this.map.entries()) {
      if (s.expiresAt >= now) obj[id] = s;
    }
    const dir = dirname(this.filePath);
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }
    await writeFile(this.filePath, JSON.stringify(obj, null, 0), { mode: 0o600 });
  }

  async get(id: string): Promise<SessionData | null> {
    await this.load();
    const data = this.map.get(id) ?? null;
    if (data && data.expiresAt < Date.now()) {
      this.map.delete(id);
      this.scheduleWrite();
      return null;
    }
    return data;
  }

  async set(id: string, data: SessionData, _ttlMs: number): Promise<void> {
    await this.load();
    this.map.set(id, data);
    this.scheduleWrite();
  }

  async delete(id: string): Promise<void> {
    await this.load();
    this.map.delete(id);
    this.scheduleWrite();
  }
}
