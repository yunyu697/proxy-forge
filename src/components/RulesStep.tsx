import { useMemo, useState } from 'react';
import clsx from 'clsx';
import { useStore } from '../store/useStore';
import { Button, Card, Chip, Field, Icon, Input, Notice, SectionTitle, Select, StepFooter, Toggle } from './ui';
import { RULESETS, RULESET_GROUPS, MIRRORS, SIZE_LABELS, resolveRuleSetUrl } from '../core/rulesets/catalog';
import { SCENARIOS, SCENARIO_MAP } from '../core/rulesets/scenarios';
import { CUSTOM_RULE_TYPE_META, CustomRuleType, GenerateOptions } from '../core/types';

const STRATEGIES: { id: GenerateOptions['strategy']; title: string; desc: string; tag: string }[] = [
  {
    id: 'whitelist',
    title: '白名单模式',
    tag: '推荐',
    desc: '国内直连、国外全部走代理。需要「中国大陆域名/IP」规则集，分流最彻底，是绝大多数人的选择。',
  },
  {
    id: 'blacklist',
    title: '黑名单模式',
    tag: '省资源',
    desc: '只有被墙的站点走代理，其余全部直连。只需 GFWList 一套规则，内存占用最小，适合低配路由器。',
  },
  {
    id: 'global',
    title: '全局代理',
    tag: '不常用',
    desc: '所有流量都走代理（保留广告拦截与局域网直连）。适合排查问题或临时切换。',
  },
];

export function RulesStep({ onNext, onPrev }: { onNext: () => void; onPrev?: () => void }) {
  const options = useStore((s) => s.options);
  const setOptions = useStore((s) => s.setOptions);
  const toggleScenario = useStore((s) => s.toggleScenario);
  const setScenarioAnswer = useStore((s) => s.setScenarioAnswer);
  const toggleRuleSet = useStore((s) => s.toggleRuleSet);
  const addCustomRuleSet = useStore((s) => s.addCustomRuleSet);
  const updateCustomRuleSet = useStore((s) => s.updateCustomRuleSet);
  const removeCustomRuleSet = useStore((s) => s.removeCustomRuleSet);
  const addCustomRule = useStore((s) => s.addCustomRule);
  const updateCustomRule = useStore((s) => s.updateCustomRule);
  const removeCustomRule = useStore((s) => s.removeCustomRule);

  const [openGroup, setOpenGroup] = useState<string>('geo');

  /** 由场景与答案推导出的规则集（用于标记哪些是“自动加入”） */
  const autoIds = useMemo(() => {
    const ids = new Set<string>();
    for (const sid of options.scenarios) {
      const s = SCENARIO_MAP[sid];
      if (!s) continue;
      s.baseRuleSets.forEach((r) => ids.add(r));
      const answers = options.scenarioAnswers[sid] || {};
      for (const q of s.questions) {
        for (const o of q.options) {
          if ((answers[q.id] || []).includes(o.value)) (o.ruleSets || []).forEach((r) => ids.add(r));
        }
      }
    }
    return ids;
  }, [options.scenarios, options.scenarioAnswers]);

  const enabledCount =
    autoIds.size + options.ruleSets.length + options.customRuleSets.filter((c) => c.enabled && c.url).length;
  const activeRuleCount = options.customRules.filter((c) => c.enabled && c.value.trim()).length;

  return (
    <div className="space-y-5">
      {/* 分流策略 */}
      <Card className="p-5">
        <SectionTitle
          icon="zap"
          title="分流策略"
          desc="决定「什么样的流量走代理」的总体思路，也是对设备性能影响最大的开关。"
        />
        <div className="grid gap-3 sm:grid-cols-3">
          {STRATEGIES.map((s) => {
            const active = options.strategy === s.id;
            return (
              <button
                key={s.id}
                onClick={() => setOptions({ strategy: s.id })}
                className={clsx(
                  'relative rounded-xl border p-4 text-left transition',
                  active ? 'border-brand-500 bg-brand-50/70 ring-2 ring-brand-100' : 'border-ink-200 bg-white hover:border-brand-300',
                )}
              >
                {active && (
                  <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-brand-600 text-white">
                    <Icon name="check" size={12} />
                  </span>
                )}
                <div className="flex items-center gap-2">
                  <h3 className="text-[14px] font-semibold text-ink-800">{s.title}</h3>
                  <Chip tone={s.id === 'whitelist' ? 'brand' : s.id === 'blacklist' ? 'green' : 'ink'}>{s.tag}</Chip>
                </div>
                <p className="mt-2 text-[12px] leading-relaxed text-ink-500">{s.desc}</p>
              </button>
            );
          })}
        </div>
      </Card>

      {/* 使用场景 */}
      <Card className="p-5">
        <SectionTitle
          icon="sparkles"
          title="使用场景"
          desc="勾选你需要的场景，并回答几个小问题。每个场景会生成独立的策略组，方便单独指定节点。"
        />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {SCENARIOS.map((s) => {
            const active = options.scenarios.includes(s.id);
            return (
              <div
                key={s.id}
                className={clsx(
                  'rounded-xl border p-4 transition',
                  active ? 'border-brand-400 bg-brand-50/50' : 'border-ink-200 bg-white',
                )}
              >
                <label className="flex cursor-pointer items-start gap-2.5">
                  <span
                    className={clsx(
                      'mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded border transition',
                      active ? 'border-brand-600 bg-brand-600 text-white' : 'border-ink-300 bg-white',
                    )}
                    onClick={(e) => {
                      e.preventDefault();
                      toggleScenario(s.id);
                    }}
                  >
                    {active && <Icon name="check" size={11} />}
                  </span>
                  <span onClick={() => toggleScenario(s.id)}>
                    <span className="text-[13px] font-semibold text-ink-800">
                      {s.emoji} {s.name}
                    </span>
                    <span className="mt-1 block text-[11px] leading-relaxed text-ink-500">{s.summary}</span>
                  </span>
                </label>
                {active && s.questions.length > 0 && (
                  <div className="mt-3 space-y-3 border-t border-brand-200/70 pt-3">
                    {s.questions.map((q) => (
                      <div key={q.id}>
                        <p className="mb-1.5 text-[12px] font-medium text-ink-700">{q.title}</p>
                        {q.type === 'multi' ? (
                          <div className="flex flex-wrap gap-1.5">
                            {q.options.map((o) => {
                              const picked = (options.scenarioAnswers[s.id]?.[q.id] || []).includes(o.value);
                              return (
                                <button
                                  key={o.value}
                                  title={o.desc}
                                  onClick={() => {
                                    const cur = options.scenarioAnswers[s.id]?.[q.id] || [];
                                    const next = picked ? cur.filter((x) => x !== o.value) : [...cur, o.value];
                                    setScenarioAnswer(s.id, q.id, next);
                                  }}
                                  className={clsx(
                                    'rounded-full border px-2.5 py-1 text-[11px] font-medium transition',
                                    picked
                                      ? 'border-brand-500 bg-brand-600 text-white'
                                      : 'border-ink-300 bg-white text-ink-600 hover:border-brand-400',
                                  )}
                                >
                                  {o.label}
                                </button>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="flex flex-col gap-1">
                            {q.options.map((o) => {
                              const picked = (options.scenarioAnswers[s.id]?.[q.id] || []).includes(o.value);
                              return (
                                <label key={o.value} className="flex cursor-pointer items-center gap-1.5 text-[12px] text-ink-600">
                                  <input
                                    type="radio"
                                    className="accent-brand-600"
                                    checked={picked}
                                    onChange={() => setScenarioAnswer(s.id, q.id, [o.value])}
                                  />
                                  {o.label}
                                  {o.desc && <span className="text-[11px] text-ink-400">（{o.desc}）</span>}
                                </label>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {active && s.deviceTips[options.device] && (
                  <p className="mt-3 rounded-lg bg-amber-50 px-2.5 py-2 text-[11px] leading-relaxed text-amber-800">
                    💡 {s.deviceTips[options.device]}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* 规则集清单 */}
      <Card className="p-5">
        <SectionTitle
          icon="layers"
          title={`规则集清单（已启用 ${enabledCount} 套）`}
          desc="场景勾选会自动带入规则集；你也可以在这里手动增减。点击分组展开明细。"
          right={
            <Select className="w-44" value={options.mirror} onChange={(e) => setOptions({ mirror: e.target.value })}>
              {MIRRORS.map((m) => (
                <option key={m.id} value={m.id}>
                  镜像：{m.label}
                </option>
              ))}
            </Select>
          }
        />

        <div className="space-y-2">
          {RULESET_GROUPS.map((g) => {
            const list = RULESETS.filter((r) => r.group === g.id);
            const open = openGroup === g.id;
            const activeInGroup = list.filter((r) => autoIds.has(r.id) || options.ruleSets.includes(r.id)).length;
            return (
              <div key={g.id} className="overflow-hidden rounded-lg border border-ink-200">
                <button
                  className="flex w-full items-center justify-between bg-ink-50/60 px-3.5 py-2.5 text-left hover:bg-ink-50"
                  onClick={() => setOpenGroup(open ? '' : g.id)}
                >
                  <div className="flex items-center gap-2">
                    <Icon name={open ? 'chevronDown' : 'chevronRight'} size={14} className="text-ink-400" />
                    <span className="text-[13px] font-semibold text-ink-800">{g.name}</span>
                    <span className="text-[11px] text-ink-400">{g.desc}</span>
                  </div>
                  {activeInGroup > 0 && <Chip tone="brand">已启用 {activeInGroup}</Chip>}
                </button>
                {open && (
                  <div className="grid gap-2 p-3 sm:grid-cols-2">
                    {list.map((r) => {
                      const auto = autoIds.has(r.id);
                      const manual = options.ruleSets.includes(r.id);
                      const checked = auto || manual;
                      return (
                        <div
                          key={r.id}
                          className={clsx(
                            'rounded-lg border px-3 py-2.5 transition',
                            checked ? 'border-brand-300 bg-brand-50/60' : 'border-ink-200 bg-white hover:bg-ink-50',
                            auto && 'cursor-default',
                          )}
                        >
                          <div className="flex items-start gap-2.5">
                            <button
                              type="button"
                              aria-pressed={checked}
                              className={clsx(
                                'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition',
                                checked ? 'border-brand-600 bg-brand-600 text-white' : 'border-ink-300 bg-white',
                              )}
                              disabled={auto}
                              onClick={() => {
                                if (auto) return;
                                toggleRuleSet(r.id);
                              }}
                            >
                              {checked && <Icon name="check" size={11} />}
                            </button>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="text-[13px] font-medium text-ink-800">{r.name}</span>
                                {auto && <Chip tone="brand" className="!px-1.5 !py-0 !text-[10px]">场景带入</Chip>}
                              </div>
                              {r.desc && (
                                <p className="mt-0.5 text-[11px] leading-relaxed text-ink-500">{r.desc}</p>
                              )}
                              <div className="mt-1.5 flex items-center gap-1.5">
                                <Chip tone={r.action === 'direct' ? 'green' : r.action === 'reject' ? 'red' : 'blue'}>
                                  {r.action === 'direct' ? '直连' : r.action === 'reject' ? '拦截' : '代理'}
                                </Chip>
                                <Chip tone="ink">{SIZE_LABELS[r.size]}</Chip>
                              </div>
                            </div>
                            <button
                              type="button"
                              className="mt-0.5 shrink-0 text-ink-300 transition hover:text-brand-600"
                              title="复制规则集地址"
                              onClick={() => navigator.clipboard?.writeText(resolveRuleSetUrl(r, options.core, options.mirror))}
                            >
                              <Icon name="copy" size={13} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-4">
          <Notice tone="info">
            规则集来自 MetaCubeX/meta-rules-dat（domain-list-community 编译），当前镜像为
            「{MIRRORS.find((m) => m.id === options.mirror)?.label}」。如果下载失败，换一个镜像即可。
          </Notice>
        </div>
      </Card>

      {/* 自定义规则集 */}
      <Card className="p-5">
        <SectionTitle
          icon="file"
          title="自定义规则集"
          desc="支持任何与 mihomo / sing-box 兼容的远程规则集地址（mihomo 用 mrs/yaml，sing-box 用 srs）。"
          right={
            <Button variant="outline" size="sm" icon="plus" onClick={addCustomRuleSet}>
              添加
            </Button>
          }
        />
        {options.customRuleSets.length === 0 ? (
          <p className="text-[13px] text-ink-400">暂无自定义规则集。</p>
        ) : (
          <div className="space-y-3">
            {options.customRuleSets.map((c) => (
              <div key={c.id} className="rounded-lg border border-ink-200 p-3">
                <div className="grid gap-2 sm:grid-cols-2">
                  <Field label="名称">
                    <Input value={c.name} onChange={(e) => updateCustomRuleSet(c.id, { name: e.target.value })} />
                  </Field>
                  <Field label="规则集地址（URL）">
                    <Input
                      placeholder="https://.../rules.yaml 或 .srs"
                      value={c.url}
                      onChange={(e) => updateCustomRuleSet(c.id, { url: e.target.value })}
                    />
                  </Field>
                  <Field label="规则类型">
                    <Select value={c.kind} onChange={(e) => updateCustomRuleSet(c.id, { kind: e.target.value as 'domain' | 'ipcidr' })}>
                      <option value="domain">域名规则（domain）</option>
                      <option value="ipcidr">IP 段规则（ipcidr）</option>
                    </Select>
                  </Field>
                  <Field label="命中动作">
                    <Select
                      value={c.action}
                      onChange={(e) => updateCustomRuleSet(c.id, { action: e.target.value as 'proxy' | 'direct' | 'reject' })}
                    >
                      <option value="proxy">走代理</option>
                      <option value="direct">直连</option>
                      <option value="reject">拦截</option>
                    </Select>
                  </Field>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <div className="w-48">
                    <Toggle
                      checked={c.enabled}
                      onChange={(v) => updateCustomRuleSet(c.id, { enabled: v })}
                      label={c.enabled ? '已启用' : '已禁用'}
                    />
                  </div>
                  <Button variant="danger" size="sm" icon="trash" onClick={() => removeCustomRuleSet(c.id)}>
                    删除
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* 自定义规则 */}
      <Card className="p-5">
        <SectionTitle
          icon="zap"
          title="自定义规则"
          desc="添加单条规则（不需要准备规则集文件），优先级最高，排在所有规则集之前。适合放行或屏蔽个别站点、指定某台设备的出口。"
          right={
            <Button variant="outline" size="sm" icon="plus" onClick={addCustomRule}>
              添加规则
            </Button>
          }
        />
        {options.customRules.length === 0 ? (
          <div className="rounded-lg border border-dashed border-ink-300 bg-ink-50/50 px-4 py-4">
            <p className="text-[12px] leading-relaxed text-ink-500">
              还没有自定义规则。常见用法举例：
            </p>
            <ul className="mt-2 space-y-1 text-[12px] leading-relaxed text-ink-500">
              <li>· 域名后缀 <code className="rounded bg-white px-1 py-0.5 font-mono text-[11px]">baidu.com</code> → 直连（绕过所有分流，国内服务保直连）</li>
              <li>· 域名后缀 <code className="rounded bg-white px-1 py-0.5 font-mono text-[11px]">corp.example.com</code> → 走代理（公司内网穿透）</li>
              <li>· 来源 IP 段 <code className="rounded bg-white px-1 py-0.5 font-mono text-[11px]">192.168.1.100/32</code> → 走代理（让某台设备全部流量走代理）</li>
              <li>· 域名关键词 <code className="rounded bg-white px-1 py-0.5 font-mono text-[11px]">tracker</code> → 拦截（屏蔽 BT 追踪）</li>
            </ul>
          </div>
        ) : (
          <div className="space-y-3">
            {options.customRules.map((c, idx) => {
              const meta = CUSTOM_RULE_TYPE_META[c.type];
              return (
                <div key={c.id} className="rounded-lg border border-ink-200 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-[12px] font-semibold text-ink-500">规则 #{idx + 1}</span>
                    <div className="flex items-center gap-3">
                      <div className="w-36">
                        <Toggle
                          checked={c.enabled}
                          onChange={(v) => updateCustomRule(c.id, { enabled: v })}
                          label={c.enabled ? '已启用' : '已禁用'}
                        />
                      </div>
                      <Button variant="danger" size="sm" icon="trash" onClick={() => removeCustomRule(c.id)}>
                        删除
                      </Button>
                    </div>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <Field label="规则类型">
                      <Select
                        value={c.type}
                        onChange={(e) => updateCustomRule(c.id, { type: e.target.value as CustomRuleType })}
                      >
                        {(Object.keys(CUSTOM_RULE_TYPE_META) as CustomRuleType[]).map((t) => (
                          <option key={t} value={t}>
                            {CUSTOM_RULE_TYPE_META[t].label}（{t}）
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="匹配值" hint={meta.hint}>
                      <Input
                        className="font-mono text-[12px]"
                        placeholder={meta.placeholder}
                        value={c.value}
                        onChange={(e) => updateCustomRule(c.id, { value: e.target.value })}
                      />
                    </Field>
                    <Field label="命中动作" hint={c.target === 'proxy' ? '走代理：送往「🚀 节点选择」' : undefined}>
                      <Select
                        value={c.target}
                        onChange={(e) => updateCustomRule(c.id, { target: e.target.value as 'proxy' | 'direct' | 'reject' })}
                      >
                        <option value="proxy">走代理</option>
                        <option value="direct">直连</option>
                        <option value="reject">拦截</option>
                      </Select>
                    </Field>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {activeRuleCount > 0 && (
          <div className="mt-3">
            <Notice tone="info">
              当前有 {activeRuleCount} 条自定义规则生效，会按列表顺序排在所有规则集之前；IP 类规则（IP-CIDR / 来源 IP）已自动附加
              no-resolve，不会触发额外的 DNS 解析。
            </Notice>
          </div>
        )}
      </Card>

      {options.scenarios.includes('daily') && autoIds.size === 0 && (
        <Notice tone="warn">「日常上网」场景还没有生效任何规则，建议保持它勾选并启用国内直连规则。</Notice>
      )}

      <StepFooter
        hint={
          <>
            已启用 <b>{enabledCount}</b> 套规则集
            {activeRuleCount > 0 && (
              <>
                、<b>{activeRuleCount}</b> 条自定义规则
              </>
            )}
            ；下一步可以调整端口、DNS 与 TUN 等高级参数。
          </>
        }
        nextLabel="下一步：高级设置"
        onNext={onNext}
        onPrev={onPrev}
      />
    </div>
  );
}
