#!/usr/bin/env node
/**
 * 合并三平台 updater 清单片段为 Tauri updater 的 latest.json。
 * 用法: node scripts/merge-updater-manifest.mjs <片段目录>  （stdout 输出）
 */
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const dir = process.argv[2];
if (!dir) {
  console.error('用法: merge-updater-manifest.mjs <片段目录>');
  process.exit(1);
}
const root = dirname(dirname(fileURLToPath(import.meta.url)));

const merged = {
  version: JSON.parse(readFileSync(join(root, 'package.json'), 'utf-8')).version,
  notes: '',
  pub_date: new Date().toISOString(),
  platforms: {},
};

for (const f of readdirSync(dir)
  .filter((f) => f.endsWith('.json'))
  .sort()) {
  const frag = JSON.parse(readFileSync(join(dir, f), 'utf-8'));
  merged.notes = frag.notes || merged.notes;
  if (frag.pub_date > merged.pub_date) merged.pub_date = frag.pub_date;
  Object.assign(merged.platforms, frag.platforms || {});
}

process.stdout.write(JSON.stringify(merged, null, 2));
