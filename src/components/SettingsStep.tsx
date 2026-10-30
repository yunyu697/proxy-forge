import { useStore } from '../store/useStore';
import { Card, Field, Input, Notice, SectionTitle, Select, StepFooter, Toggle } from './ui';
import { DEVICE_PROFILES } from '../core/types';

export function SettingsStep({ onNext, onPrev }: { onNext: () => void; onPrev?: () => void }) {
  const options = useStore((s) => s.options);
  const setOptions = useStore((s) => s.setOptions);
  const nodes = useStore((s) => s.nodes);
  const activeCount = nodes.filter((n) => n.enabled).length;

  const isBind = options.device !== 'client';

  return (
    <div className="space-y-5">
      <Card className="p-5">
        <SectionTitle
          icon="settings"
          title="基础参数"
          desc="已按设备形态（客户端 / 旁路由 / 主路由）给出推荐值，可按需调整。"
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="目标内核">
            <Select value={options.core} onChange={(e) => setOptions({ core: e.target.value as 'mihomo' | 'singbox' })}>
              <option value="mihomo">mihomo (Clash.Meta) — YAML</option>
              <option value="singbox">sing-box — JSON</option>
            </Select>
          </Field>
          <Field label="设备形态">
            <Select
              value={options.device}
              onChange={(e) => setOptions({ device: e.target.value as 'client' | 'sidecar' | 'router' })}
            >
              {DEVICE_PROFILES.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.title}（{d.subtitle}）
                </option>
              ))}
            </Select>
          </Field>
          {options.core === 'singbox' && (
            <Field label="sing-box 版本" hint="不同版本的配置结构略有差异，按实际内核版本选择">
              <Select value={options.singboxVersion} onChange={(e) => setOptions({ singboxVersion: e.target.value as '1.11' | '1.12' })}>
                <option value="1.11">1.11.x</option>
                <option value="1.12">1.12.x</option>
              </Select>
            </Field>
          )}
          <Field label="混合代理端口" hint="HTTP + SOCKS5 共用；旁路由/路由器上局域网设备连这个端口">
            <Input type="number" value={options.mixedPort} onChange={(e) => setOptions({ mixedPort: Number(e.target.value) || 7890 })} />
          </Field>
          <Field label="控制面板端口" hint="Clash 面板 / clash-api 地址">
            <Input type="number" value={options.controllerPort} onChange={(e) => setOptions({ controllerPort: Number(e.target.value) || 9090 })} />
          </Field>
          <Field label="日志等级">
            <Select value={options.logLevel} onChange={(e) => setOptions({ logLevel: e.target.value as typeof options.logLevel })}>
              <option value="silent">silent</option>
              <option value="error">error</option>
              <option value="warning">warning</option>
              <option value="info">info</option>
              <option value="debug">debug</option>
            </Select>
          </Field>
          <Field label="规则集更新间隔（秒）" hint="默认 86400 = 每天一次">
            <Input
              type="number"
              value={options.ruleSetInterval}
              onChange={(e) => setOptions({ ruleSetInterval: Number(e.target.value) || 86400 })}
            />
          </Field>
        </div>
      </Card>

      <Card className="p-5">
        <SectionTitle icon="zap" title="流量接管" desc="决定流量如何进入代理内核。" />
        <div className="space-y-2.5">
          <Toggle
            checked={options.enableTun}
            onChange={(v) => setOptions({ enableTun: v })}
            label="TUN 模式（虚拟网卡接管）"
            desc="最彻底的接管方式，不依赖应用设置代理。旁路由/路由器同样推荐，会自动劫持 53 端口 DNS。"
          />
          <Toggle
            checked={options.allowLan || isBind}
            disabled={isBind}
            onChange={(v) => setOptions({ allowLan: v })}
            label="允许局域网连接（Allow-LAN）"
            desc={
              isBind
                ? '旁路由 / 主路由形态下强制开启并监听 0.0.0.0。'
                : '开启后局域网内其他设备可以把代理指向本机。'
            }
          />
          <Toggle
            checked={options.fakeIp}
            onChange={(v) => setOptions({ fakeIp: v })}
            label="Fake-IP 模式"
            desc="DNS 返回虚假 IP 由内核接管真实连接，解析零等待、无 DNS 泄漏。客户端强烈推荐；个别设备不兼容时可关闭。"
          />
          <Toggle
            checked={options.ipv6}
            onChange={(v) => setOptions({ ipv6: v })}
            label="启用 IPv6"
            desc="只在网络环境确实有 IPv6 时开启，否则会造成连接失败或回退变慢。"
          />
          <Toggle
            checked={options.blockQuic}
            onChange={(v) => setOptions({ blockQuic: v })}
            label="拦截 QUIC（UDP 443，推荐网关模式开启）"
            desc="UDP 443（QUIC/HTTP3）经网关或代理转发质量参差，拦截后浏览器自动回落 TCP，可改善部分网站打不开、视频卡顿、国内站点变慢的问题。客户端模式可关闭。"
          />
        </div>
      </Card>

      <Card className="p-5">
        <SectionTitle icon="search" title="DNS" desc="国内域名用国内 DNS，境外域名用加密 DNS，避免污染。" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="国内 DNS（直连域名解析）" hint="推荐 DoH：阿里 223.5.5.5 或腾讯 120.53.53.53">
            <Input value={options.dnsDirect} onChange={(e) => setOptions({ dnsDirect: e.target.value })} />
          </Field>
          <Field label="境外 DNS（代理域名解析）" hint="通过代理出去解析，防污染">
            <Input value={options.dnsRemote} onChange={(e) => setOptions({ dnsRemote: e.target.value })} />
          </Field>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field label="Fake-IP 过滤模式" hint="blacklist=国内域名返回真实 IP；whitelist=仅匹配列表的域名返回真实 IP">
            <Select
              value={options.fakeIpFilterMode}
              onChange={(e) => setOptions({ fakeIpFilterMode: e.target.value as 'blacklist' | 'whitelist' })}
            >
              <option value="blacklist">blacklist（默认，推荐）</option>
              <option value="whitelist">whitelist</option>
            </Select>
          </Field>
          <Field label="规则集镜像源">
            <Select value={options.mirror} onChange={(e) => setOptions({ mirror: e.target.value })}>
              <option value="raw">GitHub 官方源</option>
              <option value="ghproxy">gh-proxy 加速</option>
              <option value="ghfast">ghfast 加速</option>
              <option value="jsdelivr">jsDelivr CDN</option>
              <option value="ghgo">ghgo 加速</option>
            </Select>
          </Field>
        </div>
      </Card>

      <Card className="p-5">
        <SectionTitle icon="layers" title="策略组与节点" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="自动测速地址" hint="urltest 组按这个地址测延迟">
            <Input value={options.urlTestUrl} onChange={(e) => setOptions({ urlTestUrl: e.target.value })} />
          </Field>
          <Field label="测速间隔（秒）">
            <Input
              type="number"
              value={options.urlTestInterval}
              onChange={(e) => setOptions({ urlTestInterval: Number(e.target.value) || 300 })}
            />
          </Field>
        </div>
        <div className="mt-3 space-y-2.5">
          <Toggle
            checked={options.deduplicate}
            onChange={(v) => setOptions({ deduplicate: v })}
            label="节点去重"
            desc="自动去掉服务器、端口、凭据完全相同的重复节点。"
          />
          <Toggle
            checked={options.finalRule === 'proxy'}
            onChange={(v) => setOptions({ finalRule: v ? 'proxy' : 'direct' })}
            label="兜底流量走代理（漏网之鱼）"
            desc={
              options.strategy === 'blacklist'
                ? '黑名单模式下建议关闭：未被 GFWList 命中的流量直连更安全。'
                : '白名单模式下建议开启：没匹配到任何规则的流量走代理。'
            }
          />
          <Toggle
            checked={options.bypassLan}
            onChange={(v) => setOptions({ bypassLan: v })}
            label="局域网直连"
            desc="192.168 / 10.x 等内网地址不走代理。旁路由与主路由务必保持开启。"
          />
        </div>
      </Card>

      <Notice tone={activeCount ? 'info' : 'warn'}>
        将使用 <b>{activeCount}</b> 个启用状态的节点生成配置。{!activeCount && '当前没有启用节点，请回到「节点管理」启用或导入。'}
      </Notice>

      <StepFooter
        hint={
          activeCount
            ? '参数已按设备形态给出推荐值，不确定时保持默认即可。'
            : '没有启用节点也可以先生成配置，但内核将无可代理出口。'
        }
        nextLabel="下一步：预览与导出"
        onNext={onNext}
        onPrev={onPrev}
      />
    </div>
  );
}
