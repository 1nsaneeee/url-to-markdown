/**
 * URL 转换历史记录管理
 * 使用 VS Code globalState 持久化存储
 */
import type * as vscode from "vscode";

export interface HistoryEntry {
  url: string;
  title: string;
  timestamp: number;
}

const HISTORY_KEY = "url-to-markdown.history";
const MAX_HISTORY = 20;

export class HistoryManager {
  constructor(private readonly globalState: vscode.Memento) {}

  getAll(): HistoryEntry[] {
    return this.globalState.get<HistoryEntry[]>(HISTORY_KEY, []);
  }

  async add(url: string, title: string): Promise<void> {
    const entries = this.getAll();

    // 去重：如果已存在相同 URL，先移除旧的
    const filtered = entries.filter((e) => e.url !== url);

    // 插入到头部
    filtered.unshift({
      url,
      title,
      timestamp: Date.now(),
    });

    // 保留最近 N 条
    await this.globalState.update(HISTORY_KEY, filtered.slice(0, MAX_HISTORY));
  }

  async clear(): Promise<void> {
    await this.globalState.update(HISTORY_KEY, []);
  }
}
