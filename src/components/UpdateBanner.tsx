import { Icon } from './ui';
import { useLang } from '../i18n';
import type { UpdateInfo } from '../core/update';
import { APP_VERSION } from '../version';

/**
 * 顶部更新提示条。
 * 只提示、不自动安装 —— Tauri 官方更新器要求 minisign 密钥强制验签，
 * 这里改为引导用户去 Release 页下载。
 */
export function UpdateBanner({
  update,
  onDownload,
  onSkip,
  onDismiss,
}: {
  update: UpdateInfo;
  onDownload: () => void;
  onSkip: () => void;
  onDismiss: () => void;
}) {
  const lang = useLang();
  const zh = lang === 'zh';
  const { release } = update;

  return (
    <div className="border-b border-brand-200 bg-brand-50 px-4 py-2.5 lg:px-8">
      <div className="mx-auto flex max-w-4xl items-center gap-3">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-white">
          <Icon name="download" size={14} />
        </span>

        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium text-brand-900">
            {zh ? `发现新版本 ${release.tag}` : `New version ${release.tag} available`}
          </p>
          <p className="truncate text-[11px] text-brand-700">
            {zh
              ? `当前 v${APP_VERSION} · 点击下载后手动安装（自动更新未启用）`
              : `You have v${APP_VERSION} · downloads are installed manually`}
          </p>
        </div>

        <button
          className="shrink-0 rounded-lg bg-brand-600 px-2.5 py-1.5 text-[12px] font-medium text-white transition hover:bg-brand-700"
          onClick={onDownload}
        >
          {zh ? '去下载' : 'Download'}
        </button>
        <button
          className="hidden shrink-0 rounded-lg px-2 py-1.5 text-[12px] text-brand-700 transition hover:bg-brand-100 sm:block"
          onClick={onSkip}
          title={zh ? '不再提示这个版本' : 'Skip this version'}
        >
          {zh ? '忽略此版本' : 'Skip'}
        </button>
        <button
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-brand-600 transition hover:bg-brand-100"
          onClick={onDismiss}
          title={zh ? '本次关闭' : 'Dismiss'}
          aria-label={zh ? '关闭' : 'Close'}
        >
          <Icon name="close" size={13} />
        </button>
      </div>
    </div>
  );
}
