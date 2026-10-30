import { useState } from 'react';
import { useStore } from '../store/useStore';
import { Button, Card, Chip, Icon, Input, Notice, SectionTitle, StepFooter, TextArea } from './ui';
import { PROXY_TYPE_LABELS } from '../core/types';
import { NodeEditor } from './NodeEditor';

export function ImportStep({ onNext }: { onNext: () => void }) {
  const nodes = useStore((s) => s.nodes);
  const importText = useStore((s) => s.importText);
  const lastImport = useStore((s) => s.lastImport);
  const [text, setText] = useState('');
  const [subUrl, setSubUrl] = useState('');
  const [subLoading, setSubLoading] = useState(false);
  const [subError, setSubError] = useState('');
  const [editing, setEditing] = useState(false);
  const [importMode, setImportMode] = useState<'append' | 'replace'>('append');

  const doImport = () => {
    if (!text.trim()) return;
    importText(text, importMode === 'replace');
    setText('');
  };

  const fetchSubscription = async () => {
    if (!subUrl.trim()) return;
    setSubLoading(true);
    setSubError('');
    try {
      const res = await fetch(subUrl.trim(), { redirect: 'follow' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const raw = await res.text();
      const report = importText(raw, false);
      if (report.added === 0) setSubError('订阅内容里没有识别出可用节点，请确认链接或改用粘贴方式导入。');
    } catch (e) {
      setSubError(
        `订阅拉取失败：${(e as Error).message}。浏览器环境的跨域限制可能导致失败，可改用桌面版（Tauri）或把订阅内容粘贴到下方文本框。`,
      );
    } finally {
      setSubLoading(false);
    }
  };

  const stats = Object.entries(
    nodes.reduce<Record<string, number>>((acc, n) => {
      acc[n.type] = (acc[n.type] || 0) + 1;
      return acc;
    }, {}),
  );

  return (
    <div className="space-y-5">
      <Card className="p-5">
        <SectionTitle
          icon="link"
          title="订阅链接"
          desc="直接粘贴机场订阅地址。桌面版可直接拉取；浏览器版遇到跨域限制时，请把订阅内容粘贴到下方文本框。"
        />
        <div className="flex flex-wrap gap-2">
          <Input
            className="min-w-0 flex-1"
            placeholder="https://example.com/api/v1/client/subscribe?token=..."
            value={subUrl}
            onChange={(e) => setSubUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchSubscription()}
          />
          <Button onClick={fetchSubscription} disabled={subLoading || !subUrl.trim()} className="shrink-0">
            <Icon name={subLoading ? 'refresh' : 'download'} size={15} className={subLoading ? 'animate-spin' : ''} />
            {subLoading ? '拉取中' : '拉取订阅'}
          </Button>
        </div>
        {subError && (
          <div className="mt-3">
            <Notice tone="warn">{subError}</Notice>
          </div>
        )}
      </Card>

      <Card className="p-5">
        <SectionTitle
          icon="copy"
          title="粘贴分享链接"
          desc="支持 ss / ssr / vmess / vless / trojan / hysteria / hysteria2 / tuic / anytls / wireguard / http / socks，一行一条，也支持整段 base64 订阅内容。"
        />
        <TextArea
          rows={7}
          placeholder={'ss://YWVzLTI1Ni1nY206cGFzc3dvcmQ@example.com:443#香港 01\nvmess://eyJ2IjoiMiIsInBzIjoi...'}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-[12px] text-ink-500">
            导入方式：
            <label className="flex cursor-pointer items-center gap-1.5">
              <input
                type="radio"
                checked={importMode === 'append'}
                onChange={() => setImportMode('append')}
                className="accent-brand-600"
              />
              追加到现有节点
            </label>
            <label className="flex cursor-pointer items-center gap-1.5">
              <input
                type="radio"
                checked={importMode === 'replace'}
                onChange={() => setImportMode('replace')}
                className="accent-brand-600"
              />
              替换全部
            </label>
          </div>
          <Button onClick={doImport} disabled={!text.trim()} icon="plus">
            解析并导入
          </Button>
        </div>
      </Card>

      {lastImport && (
        <Notice tone={lastImport.errors.length ? 'warn' : 'info'}>
          本次解析到 <b>{lastImport.added}</b> 个节点。
          {lastImport.errors.length > 0 && (
            <>有 {lastImport.errors.length} 行无法识别：{lastImport.errors.slice(0, 3).map((e) => e.reason).join('；')}…</>
          )}
        </Notice>
      )}

      <Card className="p-5">
        <SectionTitle
          icon="user"
          title="手动添加节点"
          desc="一步步填写，不用记字段名。选好协议后会只显示需要填的内容。"
          right={
            <Button variant="outline" size="sm" icon="plus" onClick={() => setEditing(true)}>
              打开向导
            </Button>
          }
        />
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(PROXY_TYPE_LABELS).map(([k, v]) => (
            <Chip key={k} tone="ink">
              {v}
            </Chip>
          ))}
        </div>
      </Card>

      <Card className="p-5">
        <SectionTitle
          title={`已导入 ${nodes.length} 个节点`}
          icon="layers"
          desc={stats.length ? undefined : '还没有节点。粘贴链接或手动添加即可开始。'}
        />
        {stats.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {stats.map(([t, c]) => (
              <Chip key={t} tone="brand">
                {PROXY_TYPE_LABELS[t as keyof typeof PROXY_TYPE_LABELS]} × {c}
              </Chip>
            ))}
          </div>
        )}
      </Card>

      <StepFooter
        hint={
          nodes.length
            ? `已就绪 ${nodes.length} 个节点，进入下一步检查与编辑。`
            : '至少导入 1 个节点后才能继续后续步骤。'
        }
        nextLabel="下一步：管理节点"
        onNext={nodes.length > 0 ? onNext : undefined}
        onPrev={undefined}
      />

      {editing && <NodeEditor onClose={() => setEditing(false)} />}
    </div>
  );
}
