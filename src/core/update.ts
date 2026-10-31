/**
 * 版本更新检查 —— 不依赖 tauri-plugin-updater。
 *
 * 为什么不用官方更新器：Tauri v2 的 updater 插件强制校验更新包签名
 * （`Config.pubkey` 是必填字段，`Update::install()` 内部无条件调用 `verify()`，
 * 没有任何开关能跳过），因此必须维护一对 minisign 密钥。
 * 这里改为「只检查、不安装」：读 GitHub Release 的 latest 接口，比版本号，
 * 有新版本就提示用户，点击用系统浏览器打开下载页，由用户自行安装。
 *
 * 设计约束：
 * - 任何失败（断网、限流 403/429、JSON 异常）都返回 null，绝不抛错影响主流程。
 * - 结果在 localStorage 缓存 6 小时，避免每次启动都打 GitHub API（未认证 60 次/小时/IP）。
 */

export const REPO = 'yunyu697/proxy-forge';
export const RELEASES_PAGE = `https://github.com/${REPO}/releases`;
export const LATEST_RELEASE_API = `https://api.github.com/repos/${REPO}/releases/latest`;

const CACHE_KEY = 'pf-update-cache';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

export type Platform = 'darwin' | 'windows' | 'linux' | 'android' | 'unknown';

export interface ReleaseAsset {
  name: string;
  url: string;
  size: number;
}

export interface LatestRelease {
  /** 原始 tag，例如 v1.2.7 */
  tag: string;
  /** 去掉 v 前缀的版本号，例如 1.2.7 */
  version: string;
  name: string;
  notes: string;
  publishedAt: string;
  htmlUrl: string;
  assets: ReleaseAsset[];
}

export interface UpdateInfo {
  release: LatestRelease;
  /** 当前平台对应的下载直链；找不到匹配资产时退回 Release 页面 */
  url: string;
  platform: Platform;
}

/** 提取版本号里的数字段：`v1.2.7` / `1.2.7-beta.1` → [1,2,7] */
export function parseVersion(input: string): number[] {
  const m = String(input)
    .trim()
    .replace(/^v/i, '')
    .match(/^\d+(?:\.\d+)*/);
  return m ? m[0].split('.').map((n) => Number.parseInt(n, 10)) : [];
}

/** 比较两个版本号：a 比 b 新返回 1，相同返回 0，更旧返回 -1。缺失的段按 0 补齐。 */
export function compareVersions(a: string, b: string): number {
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const x = pa[i] ?? 0;
    const y = pb[i] ?? 0;
    if (x !== y) return x > y ? 1 : -1;
  }
  return 0;
}

/** candidate 是否比 current 新 */
export function isNewer(candidate: string, current: string): boolean {
  return compareVersions(candidate, current) > 0;
}

/**
 * 从 UA 判断平台。
 * 注意顺序：先判 macOS 再判 Windows —— 部分 UA 里带 "Darwin"，且不能让
 * "Windows" 之外的子串误命中。
 */
export function detectPlatform(ua?: string): Platform {
  const s = String(ua ?? (typeof navigator !== 'undefined' ? navigator.userAgent : '')).toLowerCase();
  if (!s) return 'unknown';
  if (s.includes('android')) return 'android';
  if (s.includes('mac os x') || s.includes('macintosh') || s.includes('darwin')) return 'darwin';
  if (s.includes('windows') || s.includes('win32') || s.includes('win64')) return 'windows';
  if (s.includes('linux') || s.includes('x11')) return 'linux';
  return 'unknown';
}

/** 各平台优先匹配的资产文件名（按数组顺序取第一个命中项） */
const ASSET_RULES: Record<Platform, RegExp[]> = {
  darwin: [/universal\.dmg$/i, /\.dmg$/i],
  windows: [/-setup\.exe$/i, /\.msi$/i, /portable.*\.zip$/i],
  linux: [/\.appimage$/i, /_amd64\.deb$/i, /\.deb$/i],
  android: [/\.apk$/i],
  unknown: [],
};

/** 挑选当前平台最合适的下载资产 */
export function pickAsset(release: LatestRelease, platform: Platform): ReleaseAsset | null {
  for (const re of ASSET_RULES[platform] ?? []) {
    const hit = release.assets.find((a) => re.test(a.name));
    if (hit) return hit;
  }
  return null;
}

/** 下载地址：优先直链，其次 Release 页面 */
export function downloadUrlFor(release: LatestRelease, platform: Platform): string {
  return pickAsset(release, platform)?.url || release.htmlUrl || RELEASES_PAGE;
}

interface RawRelease {
  tag_name?: unknown;
  name?: unknown;
  body?: unknown;
  published_at?: unknown;
  html_url?: unknown;
  assets?: unknown;
}

/** 把 GitHub API 的原始响应整理成 LatestRelease；结构不对返回 null */
export function normalizeRelease(raw: unknown): LatestRelease | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as RawRelease;
  const tag = typeof r.tag_name === 'string' ? r.tag_name : '';
  const version = tag.replace(/^v/i, '');
  if (!/^\d+(?:\.\d+)*/.test(version)) return null;

  const assets: ReleaseAsset[] = Array.isArray(r.assets)
    ? r.assets
        .filter((a): a is Record<string, unknown> => !!a && typeof a === 'object')
        .map((a) => ({
          name: typeof a.name === 'string' ? a.name : '',
          url: typeof a.browser_download_url === 'string' ? a.browser_download_url : '',
          size: typeof a.size === 'number' ? a.size : 0,
        }))
        .filter((a) => a.name && a.url)
    : [];

  return {
    tag,
    version,
    name: typeof r.name === 'string' && r.name ? r.name : tag,
    notes: typeof r.body === 'string' ? r.body : '',
    publishedAt: typeof r.published_at === 'string' ? r.published_at : '',
    htmlUrl: typeof r.html_url === 'string' && r.html_url ? r.html_url : RELEASES_PAGE,
    assets,
  };
}

function readCache(): LatestRelease | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { at?: number; release?: unknown };
    if (typeof parsed.at !== 'number' || Date.now() - parsed.at > CACHE_TTL_MS) return null;
    return normalizeRelease(parsed.release);
  } catch {
    return null;
  }
}

function writeCache(release: LatestRelease): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), release }));
  } catch {
    /* 隐私模式 / 配额满：忽略 */
  }
}

export interface FetchOptions {
  timeoutMs?: number;
  /** 注入用，默认全局 fetch */
  fetchImpl?: typeof fetch;
  /** 跳过 localStorage 缓存 */
  noCache?: boolean;
}

/**
 * 拉取最新 Release。失败一律返回 null（更新检查不能影响主流程）。
 * @param options 超时 / 注入的 fetch / 是否跳过缓存
 */
export async function fetchLatestRelease(options: FetchOptions = {}): Promise<LatestRelease | null> {
  const { timeoutMs = 8000, fetchImpl, noCache = false } = options;

  if (!noCache) {
    const cached = readCache();
    if (cached) return cached;
  }

  const doFetch = fetchImpl ?? (typeof fetch !== 'undefined' ? fetch : undefined);
  if (!doFetch) return null;

  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : null;
  try {
    const res = await doFetch(LATEST_RELEASE_API, {
      headers: { Accept: 'application/vnd.github+json' },
      signal: ctrl ? ctrl.signal : undefined,
    });
    if (!res.ok) return null;
    const release = normalizeRelease(await res.json());
    if (release) writeCache(release);
    return release;
  } catch {
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** 检查是否有更新；有则返回下载信息，无 / 失败返回 null */
export async function checkForUpdate(
  currentVersion: string,
  options: FetchOptions & { platform?: Platform } = {},
): Promise<UpdateInfo | null> {
  const release = await fetchLatestRelease(options);
  if (!release) return null;
  if (!isNewer(release.version, currentVersion)) return null;
  const platform = options.platform ?? detectPlatform();
  return { release, url: downloadUrlFor(release, platform), platform };
}
