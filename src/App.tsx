import { useState } from 'react';
import clsx from 'clsx';
import { useStore } from './store/useStore';
import { Icon } from './components/ui';
import { ImportStep } from './components/ImportStep';
import { NodesStep } from './components/NodesStep';
import { DeviceStep } from './components/DeviceStep';
import { RulesStep } from './components/RulesStep';
import { SettingsStep } from './components/SettingsStep';
import { PreviewStep } from './components/PreviewStep';
import { DeployStep } from './components/DeployStep';
import { UpdateBanner } from './components/UpdateBanner';
import { useUpdateCheck } from './hooks/useUpdateCheck';
import { APP_VERSION, VERSION_LABEL } from './version';
import { currentTheme, toggleTheme, type Theme } from './theme';
import { setLang, t, useLang } from './i18n';

const STEPS = [
  {
    id: 'import',
    title: '导入节点',
    titleKey: 'step.import.t',
    icon: 'link',
    desc: '订阅 / 分享链接 / 手动添加',
    descKey: 'step.import.d',
  },
  {
    id: 'nodes',
    title: '节点管理',
    titleKey: 'step.nodes.t',
    icon: 'layers',
    desc: '检查、编辑、去重',
    descKey: 'step.nodes.d',
  },
  {
    id: 'device',
    title: '设备形态',
    titleKey: 'step.device.t',
    icon: 'router',
    desc: '客户端 / 旁路由 / 主路由',
    descKey: 'step.device.d',
  },
  {
    id: 'rules',
    title: '场景与规则集',
    titleKey: 'step.rules.t',
    icon: 'sparkles',
    desc: '按使用场景引导配置',
    descKey: 'step.rules.d',
  },
  {
    id: 'settings',
    title: '高级设置',
    titleKey: 'step.settings.t',
    icon: 'settings',
    desc: '端口 / DNS / TUN',
    descKey: 'step.settings.d',
  },
  {
    id: 'preview',
    title: '预览与导出',
    titleKey: 'step.preview.t',
    icon: 'file',
    desc: '生成 mihomo / sing-box 配置',
    descKey: 'step.preview.d',
  },
  {
    id: 'deploy',
    title: '部署与 DNS',
    titleKey: 'step.deploy.t',
    icon: 'server',
    desc: 'DNS 劫持指南 / RouterOS 配置',
    descKey: 'step.deploy.d',
  },
] as const;

export default function App() {
  const [step, setStep] = useState(0);
  const [theme, setTheme] = useState<Theme>(() => currentTheme());
  const lang = useLang();
  const nodes = useStore((s) => s.nodes);
  const core = useStore((s) => s.options.core);
  const setOptions = useStore((s) => s.setOptions);
  const { update, openDownload, skipVersion, dismiss } = useUpdateCheck(APP_VERSION);

  const stepTitle = (s: (typeof STEPS)[number]) => (lang === 'en' ? t(s.titleKey) : s.title);
  const stepDesc = (s: (typeof STEPS)[number]) => (lang === 'en' ? t(s.descKey) : s.desc);
  const label = (zh: string, key: string) => (lang === 'en' ? t(key) : zh);

  const canGo = (i: number) => {
    if (i <= 1) return true;
    return nodes.length > 0;
  };
  const goPrev = () => setStep(Math.max(0, step - 1));
  const goNext = () => setStep(Math.min(STEPS.length - 1, step + 1));

  return (
    <div className="flex min-h-screen">
      {/* 侧边导航 */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-ink-200 bg-white lg:flex">
        <div className="flex items-center gap-2.5 border-b border-ink-100 px-5 py-5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white shadow">
            <Icon name="zap" size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="text-[15px] font-bold leading-tight text-ink-900">{label('代理工坊', 'app.title')}</h1>
            <p className="text-[11px] text-ink-400">{label('ProxyForge · 配置生成器', 'app.subtitle')}</p>
            <p className="font-mono text-[10px] text-ink-300">{VERSION_LABEL}</p>
          </div>
          <div className="flex flex-col gap-1">
            <button
              className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-400 transition hover:bg-ink-100 hover:text-ink-700"
              title={theme === 'dark' ? '切换浅色' : '切换深色'}
              onClick={() => setTheme(toggleTheme())}
            >
              <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={15} />
            </button>
            <button
              className="flex h-7 w-7 items-center justify-center rounded-lg text-[10px] font-semibold text-ink-400 transition hover:bg-ink-100 hover:text-ink-700"
              title="切换语言 / Switch language"
              onClick={() => setLang(lang === 'zh' ? 'en' : 'zh')}
            >
              {lang === 'zh' ? 'EN' : '中'}
            </button>
          </div>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {STEPS.map((s, i) => {
            const active = i === step;
            const done = i < step;
            const enabled = canGo(i);
            return (
              <button
                key={s.id}
                disabled={!enabled}
                onClick={() => setStep(i)}
                className={clsx(
                  'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition',
                  active
                    ? 'bg-brand-50 text-brand-700'
                    : enabled
                      ? 'text-ink-600 hover:bg-ink-50'
                      : 'text-ink-300 cursor-not-allowed',
                )}
              >
                <span
                  className={clsx(
                    'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[12px] font-semibold',
                    active
                      ? 'bg-brand-600 text-white'
                      : done
                        ? 'bg-emerald-100 text-emerald-600'
                        : 'bg-ink-100 text-ink-500',
                  )}
                >
                  {done ? <Icon name="check" size={13} /> : i + 1}
                </span>
                <span className="min-w-0">
                  <span className="block text-[13px] font-medium">{stepTitle(s)}</span>
                  <span className="block truncate text-[11px] text-ink-400">{stepDesc(s)}</span>
                </span>
              </button>
            );
          })}
        </nav>

        {/* 内核切换 */}
        <div className="border-t border-ink-100 p-3">
          <p className="label px-1">{label('目标内核', 'app.core')}</p>
          <div className="grid grid-cols-2 gap-1 rounded-lg bg-ink-100 p-1">
            {(['mihomo', 'singbox'] as const).map((c) => (
              <button
                key={c}
                onClick={() => setOptions({ core: c })}
                className={clsx(
                  'rounded-md px-2 py-1.5 text-[12px] font-medium transition',
                  core === c ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-500 hover:text-ink-700',
                )}
              >
                {c === 'mihomo' ? 'mihomo' : 'sing-box'}
              </button>
            ))}
          </div>
        </div>
      </aside>

      {/* 主内容 */}
      <main className="min-w-0 flex-1">
        {update && (
          <UpdateBanner
            update={update}
            onDownload={openDownload}
            onSkip={skipVersion}
            onDismiss={dismiss}
          />
        )}

        {/* 移动端头部 */}
        <header className="sticky top-0 z-40 flex items-center justify-between border-b border-ink-200 bg-white/90 px-4 py-3 backdrop-blur lg:hidden">
          <div className="flex items-center gap-2">
            <button
              className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-400 transition hover:bg-ink-100"
              onClick={() => setTheme(toggleTheme())}
            >
              <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={16} />
            </button>
            <div>
              <h1 className="text-[14px] font-bold leading-tight text-ink-900">{label('代理工坊', 'app.title')}</h1>
              <p className="text-[10px] text-ink-400">
                {step + 1}/{STEPS.length} · {stepTitle(STEPS[step])}
              </p>
              <p className="font-mono text-[9px] text-ink-300">{VERSION_LABEL}</p>
            </div>
          </div>
          <div className="flex gap-1.5">
            <button className="btn-outline px-2 py-1.5 text-[12px]" disabled={step === 0} onClick={goPrev}>
              {label('上一步', 'common.prev')}
            </button>
            <button
              className="btn-primary px-2 py-1.5 text-[12px]"
              disabled={step === STEPS.length - 1 || !canGo(step + 1)}
              onClick={goNext}
            >
              {label('下一步', 'common.next')}
            </button>
          </div>
        </header>

        {/* 桌面端顶部进度条 */}
        <div className="hidden border-b border-ink-200 bg-white px-8 py-4 lg:block">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-[16px] font-semibold text-ink-900">{stepTitle(STEPS[step])}</h2>
              <p className="text-[12px] text-ink-400">{stepDesc(STEPS[step])}</p>
            </div>
            <div className="flex items-center gap-1.5">
              {STEPS.map((_, i) => (
                <span
                  key={i}
                  className={clsx(
                    'h-1.5 rounded-full transition-all',
                    i === step ? 'w-8 bg-brand-600' : i < step ? 'w-4 bg-brand-300' : 'w-4 bg-ink-200',
                  )}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-4xl px-4 py-6 lg:px-8">
          {step === 0 && <ImportStep onNext={() => setStep(1)} />}
          {step === 1 && <NodesStep onNext={() => setStep(2)} onPrev={goPrev} />}
          {step === 2 && <DeviceStep onNext={() => setStep(3)} onPrev={goPrev} />}
          {step === 3 && <RulesStep onNext={() => setStep(4)} onPrev={goPrev} />}
          {step === 4 && <SettingsStep onNext={() => setStep(5)} onPrev={goPrev} />}
          {step === 5 && <PreviewStep onNext={() => setStep(6)} onPrev={goPrev} />}
          {step === 6 && <DeployStep onPrev={goPrev} />}
        </div>
      </main>
    </div>
  );
}
