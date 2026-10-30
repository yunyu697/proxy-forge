import { useMemo, useState } from 'react';
import clsx from 'clsx';
import { useStore } from '../store/useStore';
import { Button, Card, Chip, EmptyState, Icon, Input, SectionTitle, Select, StepFooter } from './ui';
import { PROXY_TYPE_LABELS, ProxyNode } from '../core/types';
import { NodeEditor } from './NodeEditor';
import { buildUri } from '../core/parsers';

export function NodesStep({ onNext, onPrev }: { onNext: () => void; onPrev?: () => void }) {
  const nodes = useStore((s) => s.nodes);
  const updateNode = useStore((s) => s.updateNode);
  const removeNodes = useStore((s) => s.removeNodes);
  const setAllEnabled = useStore((s) => s.setAllEnabled);
  const [editing, setEditing] = useState<ProxyNode | null>(null);
  const [creating, setCreating] = useState(false);
  const [filter, setFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [selected, setSelected] = useState<string[]>([]);
  const [copied, setCopied] = useState('');

  const filtered = useMemo(
    () =>
      nodes.filter(
        (n) =>
          (typeFilter === 'all' || n.type === typeFilter) &&
          (!filter || n.name.toLowerCase().includes(filter.toLowerCase()) || n.server.toLowerCase().includes(filter.toLowerCase())),
      ),
    [nodes, filter, typeFilter],
  );

  const typeOptions = useMemo(() => {
    const types = [...new Set(nodes.map((n) => n.type))];
    return types;
  }, [nodes]);

  const copyLink = async (n: ProxyNode) => {
    try {
      await navigator.clipboard.writeText(buildUri(n));
      setCopied(n.id);
      setTimeout(() => setCopied(''), 1500);
    } catch {
      /* clipboard 不可用 */
    }
  };

  if (!nodes.length) {
    return (
      <EmptyState
        icon="layers"
        title="还没有节点"
        desc="回到上一步导入订阅或分享链接，或者手动添加节点后再来管理。"
        action={
          <Button variant="outline" icon="chevronRight" onClick={onPrev}>
            返回导入
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-5">
      <Card className="p-5">
        <SectionTitle
          icon="layers"
          title={`节点管理（${nodes.length}）`}
          desc="检查名称与参数，禁用不想用的节点。生成配置时只会包含启用状态的节点。"
          right={
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setAllEnabled(true)}>
                全部启用
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setAllEnabled(false)}>
                全部禁用
              </Button>
            </div>
          }
        />

        <div className="mb-4 flex flex-wrap gap-2">
          <Input
            className="max-w-56 flex-1"
            placeholder="搜索名称或服务器…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          <Select className="max-w-40" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="all">全部协议</option>
            {typeOptions.map((t) => (
              <option key={t} value={t}>
                {PROXY_TYPE_LABELS[t]}
              </option>
            ))}
          </Select>
          <Button variant="outline" icon="user" onClick={() => setCreating(true)}>
            手动添加
          </Button>
        </div>

        {selected.length > 0 && (
          <div className="mb-3 flex items-center gap-3 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2">
            <span className="text-[13px] text-brand-800">已选 {selected.length} 个</span>
            <Button
              variant="danger"
              size="sm"
              icon="trash"
              onClick={() => {
                removeNodes(selected);
                setSelected([]);
              }}
            >
              删除所选
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setSelected([])}>
              取消选择
            </Button>
          </div>
        )}

        <div className="max-h-[480px] space-y-1.5 overflow-y-auto pr-1">
          {filtered.map((n) => (
            <div
              key={n.id}
              className={clsx(
                'flex items-center gap-3 rounded-lg border px-3 py-2.5 transition',
                n.enabled ? 'border-ink-200 bg-white hover:border-ink-300' : 'border-ink-200 bg-ink-50 opacity-60',
              )}
            >
              <input
                type="checkbox"
                className="accent-brand-600"
                checked={selected.includes(n.id)}
                onChange={(e) => setSelected(e.target.checked ? [...selected, n.id] : selected.filter((x) => x !== n.id))}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-[13px] font-medium text-ink-800">{n.name}</span>
                  <Chip tone="ink">{PROXY_TYPE_LABELS[n.type]}</Chip>
                </div>
                <div className="mt-0.5 truncate font-mono text-[11px] text-ink-400">
                  {n.server}:{n.port}
                </div>
              </div>
              <button
                className="btn-ghost p-1.5 text-ink-400 hover:text-brand-600"
                title="复制分享链接"
                onClick={() => copyLink(n)}
              >
                <Icon name={copied === n.id ? 'check' : 'copy'} size={14} />
              </button>
              <button className="btn-ghost p-1.5 text-ink-400 hover:text-brand-600" title="编辑" onClick={() => setEditing(n)}>
                <Icon name="edit" size={14} />
              </button>
              <Toggle checked={n.enabled} onChange={(v) => updateNode(n.id, { enabled: v })} />
            </div>
          ))}
        </div>

        {filtered.length !== nodes.length && (
          <p className="mt-3 text-[12px] text-ink-400">
            筛选后显示 {filtered.length} / {nodes.length} 个节点。
          </p>
        )}
      </Card>

      <StepFooter
        hint={`接下来选择「客户端 / 旁路由 / 主路由」，工具会按设备优化端口、DNS 与 TUN。`}
        nextLabel="下一步：设备形态"
        onNext={onNext}
        onPrev={onPrev}
      />

      {(editing || creating) && (
        <NodeEditor
          initial={editing || undefined}
          onClose={() => {
            setEditing(null);
            setCreating(false);
          }}
        />
      )}
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={clsx('relative h-5 w-9 shrink-0 rounded-full transition', checked ? 'bg-brand-600' : 'bg-ink-300')}
      title={checked ? '已启用' : '已禁用'}
    >
      <span className={clsx('absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all', checked ? 'left-[18px]' : 'left-0.5')} />
    </button>
  );
}
