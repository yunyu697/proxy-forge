/**
 * 版本信息（vite.config.ts 构建时注入）
 * 版本号唯一来源是 package.json；`npm version` 会经 sync 脚本同步到 Tauri 与 Cargo。
 */
declare const __APP_VERSION__: string;
declare const __BUILD_NUMBER__: string;

export const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0';
export const APP_BUILD = typeof __BUILD_NUMBER__ !== 'undefined' ? __BUILD_NUMBER__ : 'dev';
export const VERSION_LABEL = `v${APP_VERSION} · build ${APP_BUILD}`;
