/**
 * 轻量 i18n：中文为源语言，en 字典覆盖主界面骨架。
 * 扩展方式：往 DICTS.en 补 key，组件里用 t('key') 替换硬编码文案即可。
 */
import { useSyncExternalStore } from 'react';

export type Lang = 'zh' | 'en';
const KEY = 'pf-lang';

let lang: Lang = (localStorage.getItem(KEY) as Lang) || 'zh';
const listeners = new Set<() => void>();

export function setLang(l: Lang) {
  lang = l;
  localStorage.setItem(KEY, l);
  listeners.forEach((fn) => fn());
}

export function useLang(): Lang {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => lang,
  );
}

type Dict = Record<string, string>;

const DICTS: Record<Lang, Dict> = {
  zh: {},
  en: {
    /* 步骤导航 */
    'step.import.t': 'Import Nodes',
    'step.import.d': 'Subscription / share links / manual',
    'step.nodes.t': 'Manage Nodes',
    'step.nodes.d': 'Review, edit, dedupe',
    'step.device.t': 'Device Type',
    'step.device.d': 'Client / sidecar / router',
    'step.rules.t': 'Scenarios & Rules',
    'step.rules.d': 'Scenario-driven rule sets',
    'step.settings.t': 'Advanced Settings',
    'step.settings.d': 'Ports / DNS / TUN',
    'step.preview.t': 'Preview & Export',
    'step.preview.d': 'Generate mihomo / sing-box config',
    'step.deploy.t': 'Deployment & DNS',
    'step.deploy.d': 'DNS hijack guides / RouterOS config',
    /* 通用 */
    'common.prev': 'Back',
    'common.next': 'Next',
    'app.title': 'ProxyForge',
    'app.subtitle': 'Config Generator',
    'app.core': 'Target Core',
  },
};

export function t(key: string): string {
  const d = DICTS[lang];
  return (d && d[key]) || key;
}
