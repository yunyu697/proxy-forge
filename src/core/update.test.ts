import { describe, expect, it, vi } from 'vitest';
import {
  checkForUpdate,
  compareVersions,
  detectPlatform,
  downloadUrlFor,
  fetchLatestRelease,
  isNewer,
  normalizeRelease,
  parseVersion,
  pickAsset,
  type LatestRelease,
} from './update';

const RELEASE: LatestRelease = {
  tag: 'v1.2.8',
  version: '1.2.8',
  name: 'ProxyForge v1.2.8',
  notes: 'notes',
  publishedAt: '2026-11-01T00:00:00Z',
  htmlUrl: 'https://github.com/yunyu697/proxy-forge/releases/tag/v1.2.8',
  assets: [
    { name: 'ProxyForge_1.2.8_universal.dmg', url: 'https://x/dmg', size: 1 },
    { name: 'ProxyForge_1.2.8_x64-setup.exe', url: 'https://x/exe', size: 1 },
    { name: 'ProxyForge_1.2.8_x64_en-US.msi', url: 'https://x/msi', size: 1 },
    { name: 'ProxyForge_1.2.8_amd64.AppImage', url: 'https://x/appimage', size: 1 },
    { name: 'ProxyForge_1.2.8_amd64.deb', url: 'https://x/deb', size: 1 },
    { name: 'app-universal-release.apk', url: 'https://x/apk', size: 1 },
  ],
};

describe('parseVersion', () => {
  it('去掉 v 前缀并拆成数字段', () => {
    expect(parseVersion('v1.2.7')).toEqual([1, 2, 7]);
    expect(parseVersion('1.2.7')).toEqual([1, 2, 7]);
    expect(parseVersion('v2')).toEqual([2]);
  });

  it('预发布后缀只取主版本段', () => {
    expect(parseVersion('1.2.7-beta.1')).toEqual([1, 2, 7]);
    expect(parseVersion('v1.2.8-rc.3')).toEqual([1, 2, 8]);
  });

  it('非法输入返回空数组', () => {
    expect(parseVersion('')).toEqual([]);
    expect(parseVersion('nightly')).toEqual([]);
  });
});

describe('compareVersions / isNewer', () => {
  it('按数字段比较而不是字符串', () => {
    expect(compareVersions('1.10.0', '1.9.9')).toBe(1);
    expect(compareVersions('1.2.7', '1.2.6')).toBe(1);
    expect(compareVersions('1.2.6', '1.2.7')).toBe(-1);
  });

  it('段数不同时按 0 补齐', () => {
    expect(compareVersions('1.2', '1.2.0')).toBe(0);
    expect(compareVersions('1.2.1', '1.2')).toBe(1);
  });

  it('忽略 v 前缀', () => {
    expect(compareVersions('v1.2.7', '1.2.7')).toBe(0);
    expect(isNewer('v1.2.8', '1.2.7')).toBe(true);
    expect(isNewer('v1.2.7', '1.2.7')).toBe(false);
    expect(isNewer('v1.2.6', '1.2.7')).toBe(false);
  });
});

describe('detectPlatform', () => {
  it('识别常见 UA', () => {
    expect(detectPlatform('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605')).toBe('darwin');
    expect(detectPlatform('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120')).toBe('windows');
    expect(detectPlatform('Mozilla/5.0 (X11; Linux x86_64) Chrome/120')).toBe('linux');
    expect(detectPlatform('Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome/120')).toBe('android');
  });

  it('macOS 优先于 Windows（UA 里可能带 Darwin）', () => {
    expect(detectPlatform('ProxyForge/1.2.7 (Darwin; arm64)')).toBe('darwin');
  });

  it('无法识别时返回 unknown', () => {
    expect(detectPlatform('')).toBe('unknown');
  });
});

describe('pickAsset / downloadUrlFor', () => {
  it('按平台挑对应资产', () => {
    expect(pickAsset(RELEASE, 'darwin')?.name).toMatch(/universal\.dmg$/);
    expect(pickAsset(RELEASE, 'windows')?.name).toMatch(/-setup\.exe$/);
    expect(pickAsset(RELEASE, 'linux')?.name).toMatch(/\.AppImage$/);
    expect(pickAsset(RELEASE, 'android')?.name).toMatch(/\.apk$/);
  });

  it('找不到匹配资产时退回 Release 页面', () => {
    expect(pickAsset(RELEASE, 'unknown')).toBeNull();
    expect(downloadUrlFor(RELEASE, 'unknown')).toBe(RELEASE.htmlUrl);
  });

  it('有匹配资产时用直链', () => {
    expect(downloadUrlFor(RELEASE, 'windows')).toBe('https://x/exe');
  });
});

describe('normalizeRelease', () => {
  it('整理 GitHub API 响应', () => {
    const r = normalizeRelease({
      tag_name: 'v1.2.8',
      name: 'ProxyForge v1.2.8',
      body: 'notes',
      published_at: '2026-11-01T00:00:00Z',
      html_url: 'https://github.com/x',
      assets: [{ name: 'a.dmg', browser_download_url: 'https://x/a', size: 10 }],
    });
    expect(r?.version).toBe('1.2.8');
    expect(r?.assets).toHaveLength(1);
    expect(r?.assets[0].url).toBe('https://x/a');
  });

  it('tag 非法时返回 null', () => {
    expect(normalizeRelease({ tag_name: 'nightly' })).toBeNull();
    expect(normalizeRelease(null)).toBeNull();
    expect(normalizeRelease('oops')).toBeNull();
  });

  it('缺字段时用兜底值', () => {
    const r = normalizeRelease({ tag_name: 'v1.0.0' });
    expect(r?.assets).toEqual([]);
    expect(r?.htmlUrl).toContain('/releases');
  });
});

describe('fetchLatestRelease / checkForUpdate', () => {
  const okFetch = (body: unknown) =>
    vi.fn(async () => ({ ok: true, json: async () => body }) as unknown as Response);

  it('有新版本时返回下载信息', async () => {
    const fetchImpl = okFetch({
      tag_name: 'v1.2.8',
      html_url: 'https://github.com/x',
      assets: [{ name: 'x.apk', browser_download_url: 'https://x/apk', size: 1 }],
    });
    const info = await checkForUpdate('1.2.7', { fetchImpl, platform: 'android', noCache: true });
    expect(info?.release.version).toBe('1.2.8');
    expect(info?.url).toBe('https://x/apk');
  });

  it('版本相同或更旧时返回 null', async () => {
    const fetchImpl = okFetch({ tag_name: 'v1.2.7' });
    expect(await checkForUpdate('1.2.7', { fetchImpl, noCache: true })).toBeNull();
    expect(await checkForUpdate('1.2.9', { fetchImpl, noCache: true })).toBeNull();
  });

  it('网络异常 / 非 2xx 时静默返回 null', async () => {
    const boom = vi.fn(async () => {
      throw new Error('offline');
    });
    expect(await fetchLatestRelease({ fetchImpl: boom as unknown as typeof fetch, noCache: true })).toBeNull();

    const notFound = vi.fn(async () => ({ ok: false, json: async () => ({}) }) as unknown as Response);
    expect(await fetchLatestRelease({ fetchImpl: notFound, noCache: true })).toBeNull();
  });
});
