/** Tauri 桌面端能力封装：Web 环境下降级或显式不可用 */

export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (!isTauri()) return Promise.reject(new Error('not in tauri'));
  const w = window as unknown as {
    __TAURI_INTERNALS__: { invoke: (c: string, a?: Record<string, unknown>) => Promise<T> };
  };
  return w.__TAURI_INTERNALS__.invoke(cmd, args);
}

/** TCP 握手测速（仅桌面版） */
export function tcpPing(host: string, port: number, timeoutMs = 4000): Promise<number> {
  return invoke<number>('tcp_ping', { host, port, timeoutMs });
}

/** 弹出系统保存对话框写文件（仅桌面版），返回写入路径或 null（取消） */
export function saveTextFile(fileName: string, content: string): Promise<string | null> {
  return invoke<string | null>('save_text_file', { fileName, content });
}
