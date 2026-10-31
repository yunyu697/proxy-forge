import { useCallback, useEffect, useState } from 'react';
import { RELEASES_PAGE, checkForUpdate, type UpdateInfo } from '../core/update';
import { openUrl } from '../desktop';

/** 用户点过「忽略此版本」后记下的版本号 */
const SKIP_KEY = 'pf-skip-version';
/** 启动后延迟检查，避开首屏渲染与订阅拉取的资源竞争 */
const CHECK_DELAY_MS = 1500;

export interface UseUpdateCheck {
  /** 有可用更新时非 null；已忽略 / 已关闭时为 null */
  update: UpdateInfo | null;
  /** 打开下载页 */
  openDownload: () => void;
  /** 忽略当前版本（下次启动也不再提示，直到出现更新的版本） */
  skipVersion: () => void;
  /** 本次会话内关闭提示 */
  dismiss: () => void;
}

/**
 * 启动后静默检查 GitHub Release 是否有新版本。
 * 检查失败（断网 / 限流 / 解析异常）静默忽略，不影响使用。
 */
export function useUpdateCheck(currentVersion: string): UseUpdateCheck {
  const [info, setInfo] = useState<UpdateInfo | null>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    let alive = true;
    const timer = setTimeout(() => {
      checkForUpdate(currentVersion).then((result) => {
        if (!alive || !result) return;
        try {
          if (localStorage.getItem(SKIP_KEY) === result.release.version) return;
        } catch {
          /* 忽略 */
        }
        setInfo(result);
      });
    }, CHECK_DELAY_MS);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [currentVersion]);

  const openDownload = useCallback(() => {
    openUrl(info?.url || RELEASES_PAGE);
  }, [info]);

  const skipVersion = useCallback(() => {
    if (info) {
      try {
        localStorage.setItem(SKIP_KEY, info.release.version);
      } catch {
        /* 忽略 */
      }
    }
    setHidden(true);
  }, [info]);

  const dismiss = useCallback(() => setHidden(true), []);

  return { update: hidden ? null : info, openDownload, skipVersion, dismiss };
}
