/**
 * Base64 / URL 工具
 *
 * 各客户端导出的分享链接在 base64 细节上非常不一致：
 * 标准 base64、base64url、缺 padding、甚至中文被 escape 过。
 * 这里做一套宽容的解码。
 */

export function decodeBase64(input: string): string {
  if (!input) return '';
  let s = input.trim().replace(/\s+/g, '');

  // base64url -> base64
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  // 补齐 padding
  const pad = s.length % 4;
  if (pad === 2) s += '==';
  else if (pad === 3) s += '=';
  else if (pad === 1) s += '===';

  try {
    // 先按 UTF-8 解
    const bin = atob(s);
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    return new TextDecoder('utf-8').decode(bytes);
  } catch {
    try {
      // 退化为 latin1（部分老客户端对中文做了 unicode escape 前的处理）
      return atob(s);
    } catch {
      throw new Error('Base64 解码失败');
    }
  }
}

export function encodeBase64(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin);
}

export function safeDecodeURIComponent(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

/** 解析形如 a=b&c=d 的查询串，重复键取最后一次 */
export function parseQuery(q: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!q) return out;
  const cleaned = q.startsWith('?') ? q.slice(1) : q;
  for (const part of cleaned.split('&')) {
    if (!part) continue;
    const idx = part.indexOf('=');
    if (idx === -1) {
      out[safeDecodeURIComponent(part)] = '';
    } else {
      out[safeDecodeURIComponent(part.slice(0, idx))] = safeDecodeURIComponent(part.slice(idx + 1));
    }
  }
  return out;
}

/** 拆分 scheme://body#remark */
export function splitUri(uri: string): { scheme: string; body: string; hash: string } {
  const trimmed = uri.trim();
  const hashIdx = trimmed.indexOf('#');
  const hash = hashIdx === -1 ? '' : safeDecodeURIComponent(trimmed.slice(hashIdx + 1));
  const noHash = hashIdx === -1 ? trimmed : trimmed.slice(0, hashIdx);
  const schemeIdx = noHash.indexOf('://');
  if (schemeIdx === -1) return { scheme: '', body: noHash, hash };
  return {
    scheme: noHash.slice(0, schemeIdx).toLowerCase(),
    body: noHash.slice(schemeIdx + 3),
    hash,
  };
}

/** 从 host:port 拆出端口，兼容 IPv6 */
export function splitHostPort(addr: string): { host: string; port: number } {
  const s = addr.trim();
  // [::1]:443
  const m = s.match(/^\[(.+)\]:(\d+)$/);
  if (m) return { host: m[1], port: Number(m[2]) };
  const idx = s.lastIndexOf(':');
  if (idx === -1) return { host: s, port: 443 };
  const host = s.slice(0, idx);
  const port = Number(s.slice(idx + 1));
  if (!Number.isFinite(port)) return { host: s, port: 443 };
  return { host, port };
}

/** 解析 alpn 字符串：h3,h2 或 http/1.1 */
export function parseList(v?: string): string[] | undefined {
  if (!v) return undefined;
  const arr = v
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
  return arr.length ? arr : undefined;
}

export function parseBool(v?: string, fallback = false): boolean {
  if (v === undefined || v === '') return fallback;
  const s = v.toLowerCase();
  return s === 'true' || s === '1' || s === 'yes' || s === 'on';
}

export function parseNumber(v?: string | number, fallback?: number): number | undefined {
  if (v === undefined || v === '') return fallback;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/** 从 URL 里提取域名（用于生成 SNI 默认值） */
export function hostOf(server: string): string {
  return server.replace(/^\[|\]$/g, '');
}

export function isIpAddress(s: string): boolean {
  const v = hostOf(s);
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(v) || v.includes(':');
}
