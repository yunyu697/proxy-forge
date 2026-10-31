import { useStore } from '../store/useStore';
import { Card, Icon, Notice, SectionTitle, StepFooter } from './ui';
import { DEVICE_PROFILES, DeviceProfile } from '../core/types';
import { deviceRecommendations } from '../core/generator';

const ICON_MAP: Record<string, string> = { laptop: 'laptop', router: 'router', server: 'server' };

export function DeviceStep({ onNext, onPrev }: { onNext: () => void; onPrev?: () => void }) {
  const device = useStore((s) => s.options.device);
  const setOptions = useStore((s) => s.setOptions);

  const pick = (id: DeviceProfile) => {
    const rec = deviceRecommendations(id);
    setOptions({ device: id, ...rec });
  };

  return (
    <div className="space-y-5">
      <Card className="p-5">
        <SectionTitle
          icon="router"
          title="这份配置会运行在哪里？"
          desc="不同形态对端口、DNS、TUN、日志的要求差别很大。选择后会自动应用推荐参数，你仍可在「高级设置」里调整。"
        />
        <div className="grid gap-3 sm:grid-cols-3">
          {DEVICE_PROFILES.map((p) => {
            const active = device === p.id;
            return (
              <button
                key={p.id}
                onClick={() => pick(p.id)}
                className={`group relative flex flex-col rounded-xl border p-4 text-left transition ${
                  active
                    ? 'border-brand-500 bg-brand-50/70 ring-2 ring-brand-100'
                    : 'border-ink-200 bg-white hover:border-brand-300 hover:bg-brand-50/30'
                }`}
              >
                {active && (
                  <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-brand-600 text-white">
                    <Icon name="check" size={12} />
                  </span>
                )}
                <span
                  className={`mb-3 flex h-10 w-10 items-center justify-center rounded-lg ${
                    active ? 'bg-brand-600 text-white' : 'bg-ink-100 text-ink-500 group-hover:text-brand-600'
                  }`}
                >
                  <Icon name={ICON_MAP[p.icon]} size={20} />
                </span>
                <h3 className="text-[14px] font-semibold text-ink-800">{p.title}</h3>
                <p className="mt-0.5 text-[11px] font-medium text-brand-600">{p.subtitle}</p>
                <p className="mt-2 text-[12px] leading-relaxed text-ink-500">{p.desc}</p>
              </button>
            );
          })}
        </div>
      </Card>

      <Card className="p-5">
        <SectionTitle title="这一步会自动做什么" icon="sparkles" />
        <ul className="space-y-2 text-[13px] leading-relaxed text-ink-600">
          {device === 'client' && (
            <>
              <li>• 开启 TUN 模式 + Fake-IP DNS，接管系统全部流量，浏览器无需任何设置</li>
              <li>• 控制面板只监听 127.0.0.1，避免暴露到局域网</li>
              <li>• mixed-port 默认 7890，可给其他软件当 HTTP/SOCKS 代理用</li>
            </>
          )}
          {device === 'sidecar' && (
            <>
              <li>• 开启 Allow-LAN 并监听 0.0.0.0，局域网设备把网关指向本机即可</li>
              <li>• DNS 监听 0.0.0.0:1053 并劫持 53 端口，防止客户端绕过分流规则</li>
              <li>• 自动排除内网网段（192.168/10/172.16），保证设备互访不走代理</li>
            </>
          )}
          {device === 'router' && (
            <>
              <li>• 日志降级到 warning、关闭进程探测、降低 keepalive 频率，尽量省 CPU/内存</li>
              <li>• geodata 使用 memconservative 加载器，规则集建议控制数量</li>
              <li>• 默认改用「黑名单」分流策略（仅 GFW 走代理），比白名单省一大截内存</li>
            </>
          )}
        </ul>
        <div className="mt-4">
          {device !== 'client' && (
            <Notice tone="warn">
              <b>网关模式的三点提醒（配置已内置缓解措施，生成时会写入注释）：</b>
              <ul className="mt-1.5 list-disc space-y-1 pl-4">
                <li>
                  <b>终端功耗可能增加</b>：keep-alive 心跳、DNS 劫持会让后台 App
                  更频繁唤醒，无线设备耗电略高于直连。已放宽 keepalive 间隔、关闭 UDP
                  会话保持；仍明显时可延长测速间隔或让闲置设备切回普通 WiFi。
                </li>
                <li>
                  <b>个别网站可能打不开</b>（客户端同配置却正常）：多为 PPPoE 导致的 MTU 分片、IPv6 绕行或浏览器安全
                  DNS（DoH）绕过劫持。TUN MTU 已按链路调低、默认拦截 QUIC 强制回落 TCP；如仍复现，请在浏览器关闭「安全
                  DNS」并保持 IPv6 关闭。
                </li>
                <li>
                  <b>国内网站可能变慢</b>：请保持「中国大陆域名 / IP」规则集启用，并建议勾选「直连加速」场景（Apple /
                  微软 / Steam 国内 CDN 走代理反而慢）。
                </li>
              </ul>
            </Notice>
          )}
        </div>
      </Card>

      <StepFooter
        hint="切换设备形态只会调整生成参数，不会改动你的节点。"
        nextLabel="下一步：场景与规则集"
        onNext={onNext}
        onPrev={onPrev}
      />
    </div>
  );
}
