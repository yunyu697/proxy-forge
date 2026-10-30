import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const pkg = require('./package.json') as { version: string };

// Tauri 打包时 TAURI_ENV_DEBUG / TAURI_PLATFORM 会被注入
const host = process.env.TAURI_DEV_HOST;

/**
 * 构建号：优先 CI 注入的 BUILD_NUMBER（GitHub Actions run number），
 * 其次 git 提交计数，最后退化为日期（避免非 git 环境构建失败）。
 */
function resolveBuildNumber(): string {
  if (process.env.BUILD_NUMBER) return process.env.BUILD_NUMBER;
  try {
    return execSync('git rev-list --count HEAD', { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return new Date().toISOString().slice(0, 10).replace(/-/g, '');
  }
}

const buildNumber = resolveBuildNumber();

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_NUMBER__: JSON.stringify(buildNumber),
  },
  resolve: {
    alias: { '@': new URL('./src', import.meta.url).pathname },
  },
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,
    host: host || false,
    hmr: host ? { protocol: 'ws', host, port: 5174 } : undefined,
    watch: { ignored: ['**/src-tauri/**'] },
  },
  build: {
    target: process.env.TAURI_PLATFORM ? 'es2021' : 'es2020',
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
    outDir: 'dist',
  },
});
