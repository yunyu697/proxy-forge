/**
 * 节点测速：桌面版走 Tauri 的 TCP 握手（真实、可靠）；
 * Web 版退化为 HTTP 探测计时（受浏览器限制，仅作参考）。
 */
import type { ProxyNode } from './types';
import { isTauri, tcpPing } from '../desktop';

export type PingStatus = 'pending' | 'ok' | 'fail';
export interface PingResult {
  status: PingStatus;
  ms?: number;
}

export function pingNode(node: ProxyNode, timeoutMs = 4000): Promise<PingResult> {
  if (isTauri()) {
    return tcpPing(node.server, node.port, timeoutMs)
      .then((ms) => ({ status: 'ok' as const, ms }))
      .catch(() => ({ status: 'fail' as const }));
  }
  // Web 降级：no-cors 请求到 server:port，用耗时做启发式判断
  const start = performance.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  return fetch(`http://${node.server}:${node.port}/`, { mode: 'no-cors', signal: ctrl.signal })
    .catch(() => undefined)
    .then(() => {
      clearTimeout(timer);
      const ms = Math.round(performance.now() - start);
      return ms < timeoutMs ? { status: 'ok' as const, ms } : ({ status: 'fail' as const } as PingResult);
    });
}

/** 并发批量测速，逐个回调结果；返回取消函数 */
export function runSpeedTest(
  nodes: ProxyNode[],
  opts: {
    concurrency?: number;
    timeoutMs?: number;
    onResult: (id: string, r: PingResult) => void;
  },
): () => void {
  const concurrency = opts.concurrency ?? 6;
  const queue = [...nodes];
  let cancelled = false;

  const worker = async () => {
    while (queue.length && !cancelled) {
      const node = queue.shift()!;
      const r = await pingNode(node, opts.timeoutMs);
      if (!cancelled) opts.onResult(node.id, r);
    }
  };
  const workers = Array.from({ length: Math.min(concurrency, queue.length) }, worker);
  void Promise.all(workers);

  return () => {
    cancelled = true;
  };
}

/** 延迟分级颜色语义 */
export function latencyTone(ms?: number): 'green' | 'amber' | 'red' | 'ink' {
  if (ms == null) return 'ink';
  if (ms < 200) return 'green';
  if (ms < 600) return 'amber';
  return 'red';
}
