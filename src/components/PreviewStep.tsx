import { useMemo, useState } from 'react';
import { useStore } from '../store/useStore';
import { Button, Card, Chip, EmptyState, Icon, Input, Notice, SectionTitle, StepFooter } from './ui';
import { generateConfig } from '../core/generator';
import { DEVICE_PROFILES } from '../core/types';
import { isTauri, saveTextFile } from '../desktop';

function download(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function PreviewStep({ onNext, onPrev }: { onNext?: () => void; onPrev?: () => void }) {
  const nodes = useStore((s) => s.nodes);
  const options = useStore((s) => s.options);
  const library = useStore((s) => s.library);
  const saveConfig = useStore((s) => s.saveConfig);
  const loadConfig = useStore((s) => s.loadConfig);
  const deleteConfig = useStore((s) => s.deleteConfig);

  const [copied, setCopied] = useState(false);
  const [name, setName] = useState('');
  const [savedTip, setSavedTip] = useState('');
  const [fileTip, setFileTip] = useState('');

  const result = useMemo(() => generateConfig(nodes, options), [nodes, options]);
  const activeNodes = nodes.filter((n) => n.enabled);
  const filename = options.core === 'mihomo' ? 'config.yaml' : 'config.json';

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(result.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  const saveToDisk = async () => {
    try {
      const written = await saveTextFile(filename, result.content);
      setFileTip(written ? `已写入 ${written}` : '');
    } catch (e) {
      setFileTip(`保存失败：${(e as Error).message}`);
    }
    setTimeout(() => setFileTip(''), 4000);
  };

  const doSave = () => {
    const finalName =
      name.trim() || `${options.core === 'mihomo' ? 'mihomo' : 'sing-box'}-${new Date().toLocaleDateString('zh-CN')}`;
    saveConfig(finalName, result.content, activeNodes.length, result.plan.ruleSets.length);
    setName('');
    setSavedTip('已保存到本地配置库');
    setTimeout(() => setSavedTip(''), 2000);
  };

  if (!nodes.length) {
    return <EmptyState icon="file" title="还没有节点" desc="先去导入或添加节点，再回来生成配置。" />;
  }

  return (
    <div className="space-y-5">
      {/* 摘要 */}
      <Card className="p-5">
        <SectionTitle icon="check" title="生成摘要" />
        <div className="grid gap-3 sm:grid-cols-4">
          <Stat label="目标内核" value={options.core === 'mihomo' ? 'mihomo' : 'sing-box'} />
          <Stat label="设备形态" value={DEVICE_PROFILES.find((d) => d.id === options.device)?.title || ''} />
          <Stat label="节点" value={`${activeNodes.length} 个`} />
          <Stat label="规则集" value={`${result.plan.ruleSets.length} 套`} />
        </div>
        {result.plan.groups.length > 0 && (
          <div className="mt-4">
            <p className="label">策略组</p>
            <div className="flex flex-wrap gap-1.5">
              {result.plan.groups.map((g) => (
                <Chip key={g.scenarioId} tone="brand">
                  {g.label}（{g.type === 'urltest' ? '自动测速' : '手动选择'}）
                </Chip>
              ))}
            </div>
          </div>
        )}
        {result.warnings.length > 0 && (
          <div className="mt-4 space-y-2">
            {result.warnings.map((w, i) => (
              <Notice key={i} tone="warn">
                {w}
              </Notice>
            ))}
          </div>
        )}
        {result.plan.tips.length > 0 && (
          <div className="mt-4 space-y-2">
            {result.plan.tips.map((t, i) => (
              <Notice key={i} tone="info">
                💡 {t}
              </Notice>
            ))}
          </div>
        )}
        {result.skipped.length > 0 && (
          <div className="mt-3">
            <Notice tone="error">
              {result.skipped.map((s, i) => (
                <div key={i}>
                  已跳过「{s.node.name}」：{s.reason}
                </div>
              ))}
            </Notice>
          </div>
        )}
      </Card>

      {/* 预览 */}
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-ink-200 px-5 py-3.5">
          <div className="flex items-center gap-2">
            <Icon name="file" size={15} className="text-ink-400" />
            <span className="text-[13px] font-semibold text-ink-800">{filename}</span>
            <Chip tone="ink">{(result.content.length / 1024).toFixed(1)} KB</Chip>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" icon={copied ? 'check' : 'copy'} onClick={copy}>
              {copied ? '已复制' : '复制'}
            </Button>
            {isTauri() && (
              <Button variant="outline" size="sm" icon="save" onClick={saveToDisk}>
                保存到本机…
              </Button>
            )}
            <Button variant="outline" size="sm" icon="download" onClick={() => download(filename, result.content)}>
              下载
            </Button>
          </div>
        </div>
        {fileTip && (
          <div className="border-b border-ink-200 bg-brand-50 px-5 py-2 text-[12px] text-brand-800">{fileTip}</div>
        )}
        <pre className="max-h-[520px] overflow-auto bg-ink-900 p-4 text-[12px] leading-relaxed text-ink-100">
          <code className="font-mono">{result.content}</code>
        </pre>
      </Card>

      {/* 保存到配置库 */}
      <Card className="p-5">
        <SectionTitle
          icon="save"
          title="本地配置库"
          desc="保存在浏览器本地（Tauri 桌面版同样持久化）。可随时回载继续编辑。"
        />
        <div className="flex gap-2">
          <Input
            placeholder="给这份配置起个名字，如：家里主路由"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && doSave()}
          />
          <Button icon="save" onClick={doSave}>
            保存当前配置
          </Button>
        </div>
        {savedTip && <p className="mt-2 text-[12px] text-emerald-600">{savedTip}</p>}

        {library.length > 0 && (
          <div className="mt-4 space-y-2">
            {library.map((c) => (
              <div key={c.id} className="flex items-center gap-3 rounded-lg border border-ink-200 px-3.5 py-2.5">
                <Icon name="file" size={15} className="shrink-0 text-ink-400" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-medium text-ink-800">{c.name}</div>
                  <div className="text-[11px] text-ink-400">
                    {c.core === 'mihomo' ? 'mihomo' : 'sing-box'} · {c.device} · {c.nodeCount} 节点 · {c.ruleSetCount}{' '}
                    规则集 · {new Date(c.createdAt).toLocaleString('zh-CN')}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  icon="download"
                  onClick={() => download(`${c.name}.${c.core === 'mihomo' ? 'yaml' : 'json'}`, c.content)}
                >
                  导出
                </Button>
                {c.snapshot && (
                  <Button
                    variant="ghost"
                    size="sm"
                    icon="edit"
                    onClick={() => {
                      if (loadConfig(c.id)) window.scrollTo({ top: 0 });
                    }}
                  >
                    载入编辑
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  icon="trash"
                  className="text-red-500"
                  onClick={() => deleteConfig(c.id)}
                />
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* 部署提示 */}
      <Card className="p-5">
        <SectionTitle icon="zap" title="接下来怎么用" />
        <ol className="space-y-2 text-[13px] leading-relaxed text-ink-600">
          {options.device === 'client' ? (
            <>
              <li>
                1. 下载 <code className="rounded bg-ink-100 px-1 py-0.5 font-mono text-[12px]">{filename}</code>
                ，放到内核的配置目录
                {options.core === 'mihomo' ? '（如 ~/.config/mihomo/config.yaml）' : '（如 /etc/sing-box/config.json）'}
                。
              </li>
              <li>
                2. 启动内核{options.core === 'mihomo' ? '：mihomo -d 配置目录' : '：sing-box run -c config.json'}。
              </li>
              <li>
                3. 打开面板{' '}
                <code className="rounded bg-ink-100 px-1 py-0.5 font-mono text-[12px]">
                  http://127.0.0.1:{options.controllerPort}/ui
                </code>{' '}
                切换节点与策略组。
              </li>
            </>
          ) : (
            <>
              <li>
                1. 把 <code className="rounded bg-ink-100 px-1 py-0.5 font-mono text-[12px]">{filename}</code>{' '}
                上传到旁路由 / 路由器（如 /etc/mihomo/config.yaml 或 /etc/sing-box/config.json）并启动服务。
              </li>
              <li>2. 局域网设备的网关和 DNS 改成这台设备的 IP；内核会自动劫持 53 端口。</li>
              <li>
                3. 从任意电脑访问{' '}
                <code className="rounded bg-ink-100 px-1 py-0.5 font-mono text-[12px]">
                  http://{options.device === 'router' ? '路由器IP' : '旁路由IP'}:{options.controllerPort}/ui
                </code>{' '}
                管理节点。
              </li>
            </>
          )}
        </ol>
      </Card>

      <StepFooter
        hint="确认配置内容无误后，进入「部署与 DNS」获取路由器侧的接入指南。"
        nextLabel="下一步：部署与 DNS"
        onNext={onNext}
        onPrev={onPrev}
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-ink-50 px-3.5 py-3">
      <p className="text-[11px] font-medium text-ink-400">{label}</p>
      <p className="mt-0.5 text-[15px] font-semibold text-ink-800">{value}</p>
    </div>
  );
}
