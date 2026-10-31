#!/usr/bin/env node
/**
 * 生成单平台的 Tauri updater 清单片段。
 * CI 在每个平台的打包 job 末尾调用：node scripts/gen-updater-manifest.mjs updater-darwin.json
 * 产物找不到或缺少 .sig 时优雅降级（输出 platforms 为空对象）。
 */
import { readFileSync, readdirSync, existsSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const out = process.argv[2];
if (!out) {
  console.error('用法: gen-updater-manifest.mjs <输出文件>');
  process.exit(1);
}

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf-8'));
const platform = process.env.UPDATE_PLATFORM || 'unknown';

const bundleBase =
  platform === 'darwin'
    ? join(root, 'src-tauri/target/universal-apple-darwin/release/bundle')
    : join(root, 'src-tauri/target/release/bundle');

const GLOBS = {
  darwin: ['macos/*.app.tar.gz', 'dmg/*.dmg'],
  windows: ['nsis/*.exe'],
  linux: ['appimage/*.AppImage', 'deb/*.deb'],
};

const taUriKey = { darwin: 'darwin-aarch64', windows: 'windows-x86_64', linux: 'linux-x86_64' }[platform] || platform;

function findUpdaterArtifact() {
  // 更新器优先用 .tar.gz (darwin) / 安装包本身 (win/linux)，且必须有对应 .sig
  for (const g of GLOBS[platform] || []) {
    const dir = join(bundleBase, dirname(g));
    if (!existsSync(dir)) continue;
    const ext = g.split('.').pop();
    const files = readdirSync(dir).filter((f) => (ext === 'gz' ? f.endsWith('.app.tar.gz') : f.endsWith(`.${ext}`)));
    for (const f of files) {
      const sig = join(dir, `${f}.sig`);
      if (existsSync(sig)) {
        return {
          urlName: f,
          signature: readFileSync(sig, 'utf-8').trim(),
        };
      }
    }
  }
  return null;
}

const found = findUpdaterArtifact();
const tag = process.env.GITHUB_REF_NAME || `v${pkg.version}`;
const manifest = {
  version: pkg.version,
  notes: `ProxyForge ${pkg.version}`,
  pub_date: new Date().toISOString(),
  platforms: found
    ? {
        [taUriKey]: {
          signature: found.signature,
          url: `https://github.com/${process.env.GITHUB_REPOSITORY || 'OWNER/REPO'}/releases/download/${tag}/${encodeURIComponent(found.urlName)}`,
        },
      }
    : {},
};

writeFileSync(resolve(out), JSON.stringify(manifest, null, 2));
console.log(`[gen-updater-manifest] ${out} -> platform=${platform}, artifact=${found ? found.urlName : 'none'}`);
