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

/**
 * 用系统默认浏览器打开链接。
 * 桌面/移动端走 Rust 侧 open_url（内部用 tauri-plugin-opener），
 * 浏览器环境退化为 window.open。只接受 http/https，防止 file:// 之类被利用。
 */
export function openUrl(url: string): void {
  if (!/^https?:\/\//i.test(url)) return;
  if (isTauri()) {
    invoke<void>('open_url', { url }).catch(() => {
      window.open(url, '_blank', 'noopener,noreferrer');
    });
    return;
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}

