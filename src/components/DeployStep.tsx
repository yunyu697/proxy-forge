import { useMemo, useState } from 'react';
import clsx from 'clsx';
import { useStore } from '../store/useStore';
import { Button, Card, Chip, Field, Icon, Input, Notice, SectionTitle, Select, StepFooter, Toggle } from './ui';
import {
  buildDnsGuide,
  buildRouterOsScript,
  preFlightChecklist,
  validateProfile,
  ChecklistItem,
  ProfileIssue,
  RouterGuide,
} from '../core/deploy';

function download(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function CodeBlockView({ title, lang, content }: { title: string; lang: string; content: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };
  return (
    <div className="mt-3 overflow-hidden rounded-lg border border-ink-200">
      <div className="flex items-center justify-between bg-ink-50 px-3 py-2">
        <span className="flex items-center gap-1.5 text-[12px] font-medium text-ink-600">
          <Icon name="file" size={13} className="text-ink-400" />
          {title}
        </span>
        <Button variant="ghost" size="sm" icon={copied ? 'check' : 'copy'} onClick={copy}>
          {copied ? '已复制' : '复制'}
        </Button>
      </div>
      <pre className="max-h-80 overflow-auto bg-ink-900 p-3 text-[11.5px] leading-relaxed text-ink-100">
        <code className="font-mono" data-lang={lang}>
          {content}
        </code>
      </pre>
    </div>
  );
}

function GuideAccordion({ guide, defaultOpen }: { guide: RouterGuide; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="overflow-hidden rounded-lg border border-ink-200">
      <button
        className="flex w-full items-center justify-between bg-ink-50/60 px-3.5 py-2.5 text-left hover:bg-ink-50"
        onClick={() => setOpen(!open)}
      >
        <span className="flex items-center gap-2">
          <Icon name={open ? 'chevronDown' : 'chevronRight'} size={14} className="text-ink-400" />
          <span className="text-[13px] font-semibold text-ink-800">{guide.name}</span>
        </span>
        {open ? null : <span className="truncate pl-3 text-[11px] text-ink-400">{guide.summary}</span>}
      </button>
      {open && (
        <div className="p-3.5">
          <p className="text-[12px] leading-relaxed text-ink-500">{guide.summary}</p>
          <ol className="mt-2.5 space-y-1.5">
            {guide.steps.map((s, i) => (
              <li key={i} className="flex gap-2 text-[12.5px] leading-relaxed text-ink-700">
                <span className="mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-brand-100 text-[10px] font-semibold text-brand-700">
                  {i + 1}
                </span>
                <span>{s}</span>
              </li>
            ))}
          </ol>
          {guide.commands?.map((c, i) => (
            <CodeBlockView key={i} title={c.title} lang={c.lang} content={c.content} />
          ))}
          {guide.notes && guide.notes.length > 0 && (
            <div className="mt-3 space-y-1">
              {guide.notes.map((n, i) => (
                <p key={i} className="text-[11.5px] leading-relaxed text-ink-400">
                  · {n}
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function InfoRow({ label, value, span }: { label: string; value: string; span?: boolean }) {
  return (
    <div className={clsx('rounded-lg bg-ink-50 px-3.5 py-3', span && 'sm:col-span-2')}>
      <p className="text-[11px] font-medium text-ink-400">{label}</p>
      <p className="mt-0.5 text-[12.5px] leading-relaxed text-ink-800">{value}</p>
    </div>
  );
}

/* ---------------------- 上线前检查清单 ---------------------- */

const CHECK_TONE: Record<ChecklistItem['level'], { tone: 'red' | 'amber' | 'blue'; label: string }> = {
  must: { tone: 'red', label: '必须' },
  should: { tone: 'amber', label: '建议' },
  info: { tone: 'blue', label: '了解' },
};

function ChecklistCard({ items }: { items: ChecklistItem[] }) {
  const [open, setOpen] = useState(true);
  const mustCount = items.filter((i) => i.level === 'must').length;
  return (
    <Card className="p-5">
      <SectionTitle
        icon="check"
        title="上线前检查清单"
        desc="网关部署改的是「所有人的出口」，改错一处可能全网断网。按这份清单操作，出问题也能秒回滚。"
        right={
          <div className="flex items-center gap-2">
            <Chip tone={mustCount > 0 ? 'red' : 'green'}>{mustCount} 项必做</Chip>
            <button
              className="btn-ghost p-1.5 text-ink-400 hover:text-ink-600"
              title={open ? '收起清单' : '展开清单'}
              onClick={() => setOpen(!open)}
            >
              <Icon name={open ? 'chevronDown' : 'chevronRight'} size={14} />
            </button>
          </div>
        }
      />
      {open && (
        <ol className="space-y-2.5">
          {items.map((it, i) => {
            const t = CHECK_TONE[it.level];
            return (
              <li key={i} className="flex gap-2.5 rounded-lg border border-ink-100 bg-white px-3 py-2.5">
                <span className="mt-0.5 shrink-0">
                  <Chip tone={t.tone}>{t.label}</Chip>
                </span>
                <div className="min-w-0">
                  <p className="text-[12.5px] font-medium text-ink-800">
                    {i + 1}. {it.title}
                  </p>
                  <p className="mt-0.5 text-[11.5px] leading-relaxed text-ink-500">{it.detail}</p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </Card>
  );
}

/* ---------------------- RouterOS 引导表单 ---------------------- */

function issueFor(issues: ProfileIssue[], field: string): ProfileIssue[] {
  return issues.filter((i) => i.field === field);
}

function FieldWithIssues({
  issues,
  children,
  label,
  hint,
  required,
}: {
  issues: ProfileIssue[];
  children: React.ReactNode;
  label: string;
  hint?: string;
  required?: boolean;
}) {
  return (
    <Field label={label} hint={hint} required={required}>
      {children}
      {issues.map((i, k) => (
        <p
          key={k}
          className={clsx(
            'mt-1 flex items-start gap-1 text-[11px] leading-relaxed',
            i.level === 'error' ? 'text-red-600' : 'text-amber-600',
          )}
        >
          <Icon name={i.level === 'error' ? 'alert' : 'info'} size={12} className="mt-0.5 shrink-0" />
          {i.message}
        </p>
      ))}
    </Field>
  );
}

function RouterOsBuilder() {
  const options = useStore((s) => s.options);
  const setOptions = useStore((s) => s.setOptions);
  const routerOs = useStore((s) => s.routerOs);
  const setRouterOs = useStore((s) => s.setRouterOs);
  const [rosMode, setRosMode] = useState<'incremental' | 'full'>('incremental');

  const issues = useMemo(() => validateProfile(options, routerOs, rosMode), [options, routerOs, rosMode]);
  const errors = issues.filter((i) => i.level === 'error');
  const warns = issues.filter((i) => i.level === 'warn');
  const ros = useMemo(() => buildRouterOsScript(options, rosMode, routerOs), [options, rosMode, routerOs]);

  const isFull = rosMode === 'full';
  const isMihomo = options.core === 'mihomo';
  const singbox = options.core === 'singbox';
  const onRouter = routerOs.topology === 'onRouter';
  const gatewayMode = singbox || routerOs.fullTakeover;

  return (
    <Card className="p-5">
      <SectionTitle
        icon="file"
        title="RouterOS（MikroTik）配置生成"
        desc="按步骤填写你的实际网络参数，脚本会据此生成——增量配置只追加代理相关规则，全量配置是一份可导入的完整模板。"
      />

      {/* 模式选择 */}
      <div className="mb-4 grid grid-cols-2 gap-1 rounded-lg bg-ink-100 p-1 sm:max-w-md">
        {(
          [
            { id: 'incremental', label: '增量配置（推荐）', desc: '保留现有网络，只追加代理相关规则' },
            { id: 'full', label: '全量配置模板', desc: '含 WAN/LAN/DHCP 完整模板，适合新设备' },
          ] as const
        ).map((m) => (
          <button
            key={m.id}
            onClick={() => setRosMode(m.id)}
            className={clsx(
              'rounded-md px-3 py-2 text-left transition',
              rosMode === m.id ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-500 hover:text-ink-700',
            )}
          >
            <span className="block text-[12.5px] font-medium">{m.label}</span>
            <span className="block text-[10.5px] text-ink-400">{m.desc}</span>
          </button>
        ))}
      </div>

      {/* 第 0 步：内核运行位置（拓扑） */}
      <p className="mb-2.5 text-[12px] font-semibold text-ink-600">
        <span className="mr-1.5 inline-flex h-[18px] w-[18px] items-center justify-center rounded-full bg-brand-600 text-[10px] font-semibold text-white">
          1
        </span>
        内核运行位置（决定 DNS 劫持与回环防护方式）
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {(
          [
            {
              id: 'sidecar',
              label: '独立旁路由设备（推荐）',
              desc: 'mihomo / sing-box 跑在另一台设备或软路由上；RouterOS 负责把 DNS / 网关指过去',
            },
            {
              id: 'onRouter',
              label: 'RouterOS 本机（v7 容器）',
              desc: '内核以容器跑在主路由上；53 劫持到本机 1053，回环防护靠接口限定',
            },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            onClick={() => setRouterOs({ topology: t.id })}
            className={clsx(
              'rounded-lg border px-3 py-2.5 text-left text-[12px] transition',
              routerOs.topology === t.id
                ? 'border-brand-400 bg-brand-50/60'
                : 'border-ink-200 bg-white hover:bg-ink-50',
            )}
          >
            <span className="block font-medium text-ink-800">{t.label}</span>
            <span className="mt-0.5 block leading-relaxed text-ink-400">{t.desc}</span>
          </button>
        ))}
      </div>
      {onRouter && (
        <div className="mt-2">
          <Notice tone="info">
            本机容器部署需要 RouterOS v7 + container 软件包（<code>/system/device-mode update container=yes</code>{' '}
            开启，需重启确认）。 53 劫持将指向主路由自身 1053 端口，并用 LAN 接口名做回环防护——
            <b>接口名必须与实际 LAN 桥一致</b>，否则劫持静默失效。
            {singbox && ' 另外：sing-box 在容器内无法可靠接管 DNS，强烈建议改用 mihomo 或放独立旁路由。'}
          </Notice>
        </div>
      )}

      {/* 第 2 步：基础拓扑 */}
      <p className="mb-2.5 mt-4 text-[12px] font-semibold text-ink-600">
        <span className="mr-1.5 inline-flex h-[18px] w-[18px] items-center justify-center rounded-full bg-brand-600 text-[10px] font-semibold text-white">
          2
        </span>
        基础拓扑
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {!onRouter && (
          <FieldWithIssues
            label="代理设备 IP"
            required
            issues={issueFor(issues, 'proxyIp')}
            hint="运行 mihomo / sing-box 的那台设备的局域网 IP（旁路由或容器）"
          >
            <Input
              className="font-mono"
              placeholder="192.168.88.2"
              value={options.gatewayIp}
              onChange={(e) => setOptions({ gatewayIp: e.target.value })}
            />
          </FieldWithIssues>
        )}
        <FieldWithIssues
          label="主路由 IP（RouterOS）"
          required
          issues={issueFor(issues, 'routerIp')}
          hint={onRouter ? '本机部署时 DNS 劫持目标就是它' : 'RouterOS 自己的 LAN 地址，也是客户端当前的网关'}
        >
          <Input
            className="font-mono"
            placeholder="192.168.88.1"
            value={routerOs.routerIp}
            onChange={(e) => setRouterOs({ routerIp: e.target.value })}
          />
        </FieldWithIssues>
        <FieldWithIssues
          label="LAN 网段"
          required
          issues={issueFor(issues, 'lanSubnet')}
          hint="DHCP 修改将精确匹配该网段，不会误伤其它网段"
        >
          <Input
            className="font-mono"
            placeholder="192.168.88.0/24"
            value={routerOs.lanSubnet}
            onChange={(e) => setRouterOs({ lanSubnet: e.target.value })}
          />
        </FieldWithIssues>
        {onRouter && (
          <FieldWithIssues
            label="LAN 桥/接口名"
            required
            issues={issueFor(issues, 'lanInterface')}
            hint="53 劫持规则限定此入接口防容器回环；常见为 bridge 或 bridge-lan，填错会导致劫持静默失效"
          >
            <Input
              className="font-mono"
              placeholder="bridge"
              value={routerOs.lanInterface}
              onChange={(e) => setRouterOs({ lanInterface: e.target.value })}
            />
          </FieldWithIssues>
        )}
      </div>

      {/* 第 3 步：DNS 接管方式 */}
      <p className="mb-2.5 mt-4 text-[12px] font-semibold text-ink-600">
        <span className="mr-1.5 inline-flex h-[18px] w-[18px] items-center justify-center rounded-full bg-brand-600 text-[10px] font-semibold text-white">
          3
        </span>
        DNS / 流量接管方式
      </p>
      {onRouter ? (
        <Notice tone="info">
          本机容器部署固定使用「53 劫持到本机 1053」：客户端网关本来就是主路由，无需改动 DHCP，53
          查询被防火墙重定向进容器内核。
        </Notice>
      ) : isMihomo ? (
        <>
          <div className="grid gap-2 sm:grid-cols-2">
            {(
              [
                {
                  id: 'hijack53',
                  label: '劫持全网 53 端口（推荐）',
                  desc: '防火墙把所有 53 查询重定向到内核，客户端零改动、写死 DNS 的设备也被覆盖',
                },
                {
                  id: 'dhcpOnly',
                  label: '仅 DHCP 下发 DNS',
                  desc: '只改 DHCP 的 DNS 下发，侵入最小；但手动设置过 DNS 的设备会绕过',
                },
              ] as const
            ).map((s) => {
              const selected = !routerOs.fullTakeover && routerOs.dnsStrategy === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  disabled={routerOs.fullTakeover}
                  onClick={() => setRouterOs({ dnsStrategy: s.id })}
                  className={clsx(
                    'rounded-lg border px-3 py-2.5 text-left text-[12px] transition disabled:cursor-not-allowed',
                    selected ? 'border-brand-400 bg-brand-50/60' : 'border-ink-200 bg-white hover:bg-ink-50',
                    routerOs.fullTakeover && 'opacity-40',
                  )}
                >
                  <span className="block font-medium text-ink-800">{s.label}</span>
                  <span className="mt-0.5 block leading-relaxed text-ink-400">{s.desc}</span>
                </button>
              );
            })}
          </div>
          {routerOs.fullTakeover && (
            <p className="mt-1.5 text-[11px] leading-relaxed text-ink-400">
              已选择「网关也指向代理设备」：所有流量（含 DNS）都经过内核，上方两种 DNS 策略自动被涵盖，无需选择。
            </p>
          )}
        </>
      ) : (
        <Notice tone="info">
          sing-box 没有独立 DNS 监听端口，只能用<b>网关模式</b>：客户端的网关和 DNS 都指向代理设备，53 查询进入 TUN 后由
          hijack-dns 规则接管（脚本会自动这样配置）。
        </Notice>
      )}
      <div className="mt-2.5 space-y-2">
        {!onRouter && (
          <Toggle
            checked={gatewayMode}
            disabled={singbox}
            onChange={(v) => setRouterOs({ fullTakeover: v })}
            label="网关也指向代理设备（流量级接管）"
            desc={
              singbox
                ? 'sing-box 必选，不可关闭。'
                : '所有流量都经过内核分流（比仅劫持 DNS 更彻底）；代价是代理设备离线 = 全网断外网，请确认设备高可用。'
            }
          />
        )}
        <Toggle
          checked={routerOs.disableRouterDns}
          onChange={(v) => setRouterOs({ disableRouterDns: v })}
          label="关闭 RouterOS 自身 DNS 服务"
          desc="allow-remote-requests=no，避免 Fake-IP 进入路由器缓存、与劫持规则冲突。"
        />
      </div>

      {/* 第 4 步：全量模板的 WAN/LAN 参数 */}
      {isFull && (
        <>
          <p className="mb-2.5 mt-4 text-[12px] font-semibold text-ink-600">
            <span className="mr-1.5 inline-flex h-[18px] w-[18px] items-center justify-center rounded-full bg-brand-600 text-[10px] font-semibold text-white">
              4
            </span>
            WAN / LAN 参数（仅全量模板需要）
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="WAN 接入方式" hint="上层光猫拨号选 DHCP；直接接运营商选 PPPoE；有固定 IP 选静态">
              <Select
                value={routerOs.wanType}
                onChange={(e) => setRouterOs({ wanType: e.target.value as 'pppoe' | 'dhcp' | 'static' })}
              >
                <option value="pppoe">PPPoE 拨号（宽带账号）</option>
                <option value="dhcp">DHCP 自动获取</option>
                <option value="static">静态 IP</option>
              </Select>
            </Field>
            <Field label="WAN 接口名" hint="物理口一般是 ether1；PPPoE 会在此名上建立">
              <Input
                className="font-mono"
                value={routerOs.wanInterface}
                onChange={(e) => setRouterOs({ wanInterface: e.target.value })}
              />
            </Field>
            {routerOs.wanType === 'pppoe' && (
              <>
                <FieldWithIssues
                  label="宽带账号"
                  issues={issueFor(issues, 'pppoeUser')}
                  hint="运营商提供的 PPPoE 用户名"
                >
                  <Input
                    value={routerOs.pppoeUser}
                    onChange={(e) => setRouterOs({ pppoeUser: e.target.value })}
                    placeholder="填了才不用导入后手改"
                  />
                </FieldWithIssues>
                <Field label="宽带密码">
                  <Input
                    type="password"
                    value={routerOs.pppoePass}
                    onChange={(e) => setRouterOs({ pppoePass: e.target.value })}
                  />
                </Field>
              </>
            )}
            {routerOs.wanType === 'static' && (
              <FieldWithIssues
                label="WAN 静态 IP/掩码"
                required
                issues={issueFor(issues, 'staticWan')}
                hint="如 10.0.0.2/24，网关在导入后替换脚本占位符"
              >
                <Input
                  className="font-mono"
                  placeholder="10.0.0.2/24"
                  value={routerOs.staticWan}
                  onChange={(e) => setRouterOs({ staticWan: e.target.value })}
                />
              </FieldWithIssues>
            )}
            <Field label="LAN 桥/接口名" hint="客户端接的桥，默认新建 bridge-lan；已有设备可改成 bridge">
              {onRouter ? (
                <Input className="font-mono bg-ink-50" value={routerOs.lanInterface} disabled />
              ) : (
                <Input
                  className="font-mono"
                  value={routerOs.lanInterface}
                  onChange={(e) => setRouterOs({ lanInterface: e.target.value })}
                />
              )}
            </Field>
            <FieldWithIssues
              label="DHCP 地址池"
              issues={issueFor(issues, 'dhcpPool')}
              hint="起始-结束；脚本会检查代理设备 IP 是否落在池内"
            >
              <Input
                className="font-mono"
                placeholder="192.168.88.100-192.168.88.200"
                value={routerOs.dhcpPool}
                onChange={(e) => setRouterOs({ dhcpPool: e.target.value })}
              />
            </FieldWithIssues>
          </div>
        </>
      )}

      {/* 校验汇总 */}
      {(errors.length > 0 || warns.length > 0 || ros.warnings.length > 0) && (
        <div className="mt-4 space-y-2">
          {errors.map((e, i) => (
            <Notice key={`e${i}`} tone="error">
              {e.message}
            </Notice>
          ))}
          {warns.map((w, i) => (
            <Notice key={`w${i}`} tone="warn">
              {w.message}
            </Notice>
          ))}
          {ros.warnings.map((w, i) => (
            <Notice key={`s${i}`} tone="warn">
              {w}
            </Notice>
          ))}
        </div>
      )}

      {/* 脚本输出 */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Chip tone={onRouter ? 'brand' : 'blue'}>{onRouter ? '本机容器（v7）' : '旁路由拓扑'}</Chip>
        <Chip tone={isMihomo ? 'blue' : 'amber'}>
          {isMihomo ? 'mihomo：DNS 劫持 / 网关模式均可' : 'sing-box：仅网关模式（无独立 DNS 监听）'}
        </Chip>
        <Chip tone="ink">{ros.filename}</Chip>
        {errors.length === 0 && <Chip tone="green">参数校验通过</Chip>}
      </div>

      <CodeBlockView title={ros.filename} lang="routeros" content={ros.content} />

      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          icon="download"
          disabled={errors.length > 0}
          onClick={() => download(ros.filename, ros.content)}
        >
          下载 .rsc{errors.length > 0 ? '（先修正错误）' : ''}
        </Button>
        <span className="flex items-center text-[11px] leading-relaxed text-ink-400">
          导入方法：上传到 Files → 终端按 Ctrl-X 进入 Safe Mode → 执行 /import file={ros.filename}
        </span>
      </div>

      <div className="mt-3">
        <Notice tone="info">
          相容性已内置：53 劫持排除代理设备/自身（防回环）与 Fake-IP 网段；旁路由拓扑用源地址豁免、本机容器拓扑用 LAN
          接口限定（容器查询不回环）；DHCP 按 LAN
          网段精确匹配（有注释标记，回滚一条命令）；网关模式附离线风险与恢复说明；脚本尾部附完整回滚命令。
        </Notice>
      </div>
    </Card>
  );
}

/* ---------------------- 主组件 ---------------------- */

export function DeployStep({ onPrev }: { onPrev?: () => void }) {
  const options = useStore((s) => s.options);
  const routerOs = useStore((s) => s.routerOs);
  const guide = useMemo(() => buildDnsGuide(options), [options]);
  const checklist = useMemo(() => preFlightChecklist(options, routerOs), [options, routerOs]);
  const isGateway = options.device !== 'client';

  return (
    <div className="space-y-5">
      {!isGateway && (
        <Card className="p-5">
          <SectionTitle
            icon="router"
            title="部署与 DNS"
            desc="客户端模式无需配置路由器，以下内容供以后切换到网关部署时参考。"
          />
          <Notice tone="info">
            当前为客户端模式：TUN + Fake-IP 在本机完成全部接管，DNS 查询由内核直接处理，局域网其他设备不受影响。
            如果以后要做「旁路由 / 主路由」部署，回到「设备形态」切换后，本页会给出完整的 DNS 劫持与路由器配置指南。
          </Notice>
        </Card>
      )}

      {isGateway && (
        <>
          {/* DNS 拓扑 */}
          <Card className="p-5">
            <SectionTitle
              icon="search"
              title="这份配置的 DNS 是怎么工作的"
              desc="网关模式下 DNS 是分流成败的关键：客户端的解析请求必须进入内核，才能按「国内直连 DNS / 国外代理 DNS」分流。"
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <InfoRow label="接管方式" value={guide.mode} />
              <InfoRow label="DNS 监听" value={guide.listen} />
              <InfoRow label="劫持机制" value={guide.hijack} span />
              <InfoRow label="国内解析（直连上游）" value={guide.upstream.direct} />
              <InfoRow label="国外解析（代理上游）" value={guide.upstream.remote} />
              <InfoRow label="Fake-IP" value={guide.fakeIp} span />
            </div>
            <div className="mt-4">
              <Notice tone="warn">
                <b>与代理配置相容的注意事项（路由器侧配置必须遵守）：</b>
                <ul className="mt-1.5 list-disc space-y-1 pl-4">
                  {guide.compatNotes.map((n, i) => (
                    <li key={i}>{n}</li>
                  ))}
                </ul>
              </Notice>
            </div>
          </Card>

          {/* 上线前检查清单 */}
          <ChecklistCard items={checklist} />

          {/* 各系统步骤 */}
          <Card className="p-5">
            <SectionTitle
              icon="layers"
              title="主流路由系统设置步骤"
              desc="按你的路由系统展开：核心都是把客户端 DNS（网关模式再连同网关）交给代理设备。"
            />
            <div className="space-y-2">
              {guide.guides.map((g, i) => (
                <GuideAccordion key={g.id} guide={g} defaultOpen={i === 0} />
              ))}
            </div>
          </Card>

          {/* RouterOS 引导生成 */}
          <RouterOsBuilder />
        </>
      )}

      <StepFooter
        hint={
          isGateway
            ? '这是最后一步：配置文件在「预览与导出」下载，路由器侧材料都在本页。'
            : '客户端模式到这里就完成了，直接使用导出的配置启动内核即可。'
        }
        onPrev={onPrev}
      />
    </div>
  );
}
