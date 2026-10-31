import { describe, expect, it } from 'vitest';
import { defaultOptions, generateConfig } from './generator';
import type { ProxyNode } from './types';

/**
 * 这些用例锁的是「生成的配置能被真实内核加载」这一底线。
 * 每条断言都对应一次线上事故，改动 builder 时不要放宽。
 */

const nodes: ProxyNode[] = [
  {
    id: '1',
    type: 'vmess',
    name: 'HK-01',
    server: 'hk.example.com',
    port: 443,
    enabled: true,
    udp: true,
    uuid: '11111111-1111-1111-1111-111111111111',
    tls: true,
    network: 'ws',
    wsPath: '/ws',
  },
  { id: '2', type: 'trojan', name: 'SG-01', server: 'sg.example.com', port: 443, enabled: true, udp: true, tls: false, password: 'p' },
  {
    id: '3',
    type: 'hysteria2',
    name: 'US-01',
    server: 'us.example.com',
    port: 8443,
    enabled: true,
    udp: true,
    tls: false,
    password: 'p',
    obfsPassword: 'o',
    hopPorts: '20000-30000',
  },
  { id: '4', type: 'anytls', name: 'FR-01', server: 'fr.example.com', port: 443, enabled: true, udp: true, tls: false, password: 'p' },
  {
    id: '5',
    type: 'wireguard',
    name: 'WG-01',
    server: 'wg.example.com',
    port: 51820,
    enabled: true,
    udp: true,
    tls: false,
    wgPrivateKey: 'yAnz5TF+lXXJte14tji3zlMNq+hd2rYUIgJBgB3fBmk=',
    wgPeerPublicKey: 'xTIBA5rboUvnH4htodjb6e697QjLERt1NAB4mZqp8Dg=',
    wgLocalAddress: '10.0.0.2/32',
  },
];

function build(core: 'mihomo' | 'singbox', patch: Record<string, unknown> = {}) {
  const options = { ...defaultOptions(), core, ...patch } as ReturnType<typeof defaultOptions>;
  return generateConfig(nodes, options).content;
}

function singboxOutbounds(core: 'singbox' = 'singbox') {
  const cfg = JSON.parse(build(core));
  return cfg as {
    outbounds: Record<string, unknown>[];
    endpoints?: Record<string, unknown>[];
    dns: { servers: unknown[] };
  };
}

describe('mihomo 配置兼容性', () => {
  const yaml = build('mihomo');

  it('策略组用 url-test 而不是 urltest', () => {
    // mihomo 的 adapter/outboundgroup/parser.go 只认 "url-test"，
    // 写 urltest 会报 `unsupported type: urltest` 导致整份配置加载失败
    expect(yaml).toContain('type: url-test');
    expect(yaml).not.toContain('type: urltest');
  });

  it('respect-rules 开启时必须给出 proxy-server-nameserver', () => {
    // 缺失时 mihomo 报 "if respect-rules is turned on, proxy-server-nameserver cannot be empty"
    expect(yaml).toContain('respect-rules: true');
    expect(yaml).toContain('proxy-server-nameserver:');
  });

  it('proxy-server-nameserver 只放 IP 字面量', () => {
    const line = yaml.split('\n').findIndex((l) => l.includes('proxy-server-nameserver:'));
    const block = yaml.split('\n').slice(line + 1, line + 4);
    for (const entry of block.filter((l) => l.trim().startsWith('- '))) {
      const host = entry.trim().replace('- ', '');
      expect(host).toMatch(/^(\d{1,3}\.){3}\d{1,3}$|^[0-9a-f:]+$/i);
    }
  });

  it('域名型 DoH 也能回退出可用地址', () => {
    const out = build('mihomo', { dnsDirect: 'https://dns.alidns.com/dns-query' });
    expect(out).toContain('- 223.5.5.5');
  });
});

describe('sing-box 配置兼容性', () => {
  const cfg = singboxOutbounds();

  it('不声明 block / dns 这两个 legacy 特殊 outbound', () => {
    // sing-box 1.12 起会 FATAL：legacy special outbounds ... ENABLE_DEPRECATED_SPECIAL_OUTBOUNDS
    const types = cfg.outbounds.map((o) => o.type);
    expect(types).not.toContain('block');
    expect(types).not.toContain('dns');
  });

  it('urltest 组不带 default 字段', () => {
    // default 只有 selector 认，urltest 带它会 unknown field "default"
    for (const o of cfg.outbounds.filter((x) => x.type === 'urltest')) {
      expect(o).not.toHaveProperty('default');
      expect(o).toHaveProperty('url');
    }
  });

  it('outbound 顶层没有 alpn（alpn 属于 tls）', () => {
    for (const o of cfg.outbounds) {
      expect(o).not.toHaveProperty('alpn');
    }
  });

  it('强制 TLS 的协议都带 tls 块', () => {
    // trojan / anytls / hysteria2 缺 tls 会报 "TLS required"
    // （anytls 是 1.12 才有的协议，1.11 会被剔除，所以这里用 1.12 生成）
    const cfg12 = JSON.parse(build('singbox', { singboxVersion: '1.12' })) as typeof cfg;
    for (const type of ['trojan', 'anytls', 'hysteria2']) {
      const o = cfg12.outbounds.find((x) => x.type === type);
      expect(o, `${type} 未生成`).toBeTruthy();
      expect(o!.tls, `${type} 缺 tls`).toMatchObject({ enabled: true });
    }
  });

  it('WireGuard 写在 endpoints 里而不是 outbounds', () => {
    // outbound 形态 1.12 起 FATAL：ENABLE_DEPRECATED_WIREGUARD_OUTBOUND
    expect(cfg.outbounds.map((o) => o.type)).not.toContain('wireguard');
    expect(cfg.endpoints?.length).toBe(1);
    const ep = cfg.endpoints![0];
    expect(ep.type).toBe('wireguard');
    expect(ep.address).toEqual(['10.0.0.2/32']);
    expect((ep.peers as Record<string, unknown>[])[0]).toMatchObject({ address: 'wg.example.com', port: 51820 });
  });

  it('端口跳跃用 server_ports 而不是 ports', () => {
    const hy2 = cfg.outbounds.find((o) => o.type === 'hysteria2')!;
    expect(hy2).not.toHaveProperty('ports');
    expect(hy2.server_ports).toEqual(['20000:30000']);
  });

  it('ntp 用 enabled 而不是 enable', () => {
    const full = JSON.parse(build('singbox')) as Record<string, unknown>;
    expect((full.ntp as Record<string, unknown>).enabled).toBe(true);
    expect(full.ntp).not.toHaveProperty('enable');
  });

  it('ss 插件被剥离并给出告警', () => {
    const withPlugin: ProxyNode[] = [
      {
        id: '9',
        type: 'shadowsocks',
        name: 'KR-01',
        server: 'kr.example.com',
        port: 8388,
        enabled: true,
        udp: true,
        tls: false,
        cipher: 'aes-256-gcm',
        password: 'p',
        plugin: 'obfs',
        pluginOpts: { mode: 'tls' },
      },
    ];
    const res = generateConfig(withPlugin, { ...defaultOptions(), core: 'singbox' });
    const parsed = JSON.parse(res.content) as { outbounds: Record<string, unknown>[] };
    const ss = parsed.outbounds.find((o) => o.type === 'shadowsocks')!;
    expect(ss).not.toHaveProperty('plugin');
    expect(res.warnings.join('|')).toContain('插件');
  });
});

describe('sing-box 版本方言', () => {
  type Cfg = {
    inbounds: Record<string, unknown>[];
    outbounds: Record<string, unknown>[];
    dns: { servers: Record<string, unknown>[]; fakeip?: unknown };
    route: { rules: Record<string, unknown>[] };
  };
  const sb = (version: string) => JSON.parse(build('singbox', { singboxVersion: version })) as Cfg;

  it('1.11 用旧 DNS 格式（address + 独立 fakeip 块）', () => {
    const cfg = sb('1.11');
    expect(cfg.dns.servers[0]).toHaveProperty('address');
    expect(cfg.dns.servers[0]).not.toHaveProperty('type');
    expect(cfg.dns.fakeip).toBeTruthy();
  });

  it('1.12 / 1.14 / 1.16 用新 DNS 格式（type + server，fakeip 是一个 server）', () => {
    for (const v of ['1.12', '1.14', '1.16']) {
      const cfg = sb(v);
      expect(cfg.dns.servers[0], v).toMatchObject({ type: 'https', server: '223.5.5.5', tag: 'dns-direct' });
      expect(cfg.dns.fakeip, v).toBeUndefined();
      expect(cfg.dns.servers.map((s) => s.type), v).toContain('fakeip');
    }
  });

  it('1.14 / 1.16 把入站 sniff 字段换成 route 规则动作', () => {
    // 1.13 起入站 sniff / domain_strategy 被移除，1.14 起再写就 FATAL
    for (const v of ['1.14', '1.16']) {
      const cfg = sb(v);
      for (const ib of cfg.inbounds) {
        expect(ib, v).not.toHaveProperty('sniff');
        expect(ib, v).not.toHaveProperty('sniff_override_destination');
        expect(ib, v).not.toHaveProperty('domain_strategy');
      }
      const actions = cfg.route.rules.map((r) => r.action);
      expect(actions, v).toContain('sniff');
      expect(actions, v).toContain('resolve');
      // sniff 动作只有 sniffer / timeout 两个参数，没有 override_destination
      for (const r of cfg.route.rules.filter((x) => x.action === 'sniff')) {
        expect(r).not.toHaveProperty('override_destination');
      }
    }
  });

  it('1.11 / 1.12 仍用旧入站字段', () => {
    for (const v of ['1.11', '1.12']) {
      const cfg = sb(v);
      expect(cfg.inbounds[0], v).toMatchObject({ sniff: true });
    }
  });

  it('hysteria 带宽一律用 up_mbps / down_mbps', () => {
    // 1.12 与 1.14 都不认 up / down（unknown field）
    for (const v of ['1.11', '1.12', '1.14', '1.16']) {
      for (const o of sb(v).outbounds.filter((x) => x.type === 'hysteria' || x.type === 'hysteria2')) {
        expect(o, v).not.toHaveProperty('up');
        expect(o, v).not.toHaveProperty('down');
        expect(o.up_mbps, v).toBeGreaterThan(0);
        expect(o.down_mbps, v).toBeGreaterThan(0);
      }
    }
  });

  it('default_domain_resolver 只在 1.12+ 出现', () => {
    // 1.11 内核没有这个字段，写进去会 unknown field
    const route = (v: string) => (sb(v) as unknown as { route: Record<string, unknown> }).route;
    expect(route('1.11')).not.toHaveProperty('default_domain_resolver');
    for (const v of ['1.12', '1.14', '1.16']) {
      expect(route(v).default_domain_resolver, v).toMatchObject({ server: 'dns-direct' });
    }
  });

  it('1.11 会剔除 AnyTLS 节点（1.12 才支持）', () => {
    const res = generateConfig(nodes, { ...defaultOptions(), core: 'singbox', singboxVersion: '1.11' });
    expect(res.content).not.toContain('anytls');
    expect(res.warnings.join('|')).toContain('AnyTLS');
  });

  it('server_ports 的单端口写成 443:443', () => {
    const hy2 = sb('1.14').outbounds.find((o) => o.type === 'hysteria2')!;
    expect(hy2.server_ports).toEqual(['20000:30000']);
  });
});
