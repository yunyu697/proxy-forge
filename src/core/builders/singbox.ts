import type { GenerateOptions, ProxyNode } from '../types';
import { usesNewDnsFormat, usesNewInboundFields } from '../types';
import type { CustomRuleType } from '../types';
import type { ConfigPlan } from '../generator';

function clean<T>(obj: T): T {
  if (Array.isArray(obj)) return obj.filter((v) => v !== undefined && v !== null).map((v) => clean(v)) as unknown as T;
  if (obj && typeof obj === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (v === undefined || v === null || v === '') continue;
      if (Array.isArray(v) && v.length === 0) continue;
      if (typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0) continue;
      out[k] = clean(v);
    }
    return out as T;
  }
  return obj;
}

function tlsObject(n: ProxyNode, isNew: boolean): Record<string, unknown> | undefined {
  if (n.type === 'shadowsocks' || n.type === 'shadowsocksr' || n.type === 'socks' || n.type === 'wireguard') {
    if (!n.tls) return undefined;
  }
  if (!n.tls) return undefined;

  const tls: Record<string, unknown> = { enabled: true };
  const sni = n.sni || (n.server && !/^\d+\.\d+\.\d+\.\d+$/.test(n.server) ? n.server : undefined);
  if (sni) tls.server_name = sni;
  if (n.alpn?.length) tls.alpn = n.alpn;
  if (n.skipCertVerify) tls.insecure = true;
  if (n.realityPublicKey) {
    tls.reality = { enabled: true, public_key: n.realityPublicKey, short_id: n.realityShortId || '' };
    tls.utls = { enabled: true, fingerprint: n.fingerprint || 'chrome' };
  } else if (n.fingerprint) {
    tls.utls = { enabled: true, fingerprint: n.fingerprint };
  }
  // 1.12 起 uTLS 写法保持兼容
  if (isNew && !tls.utls && n.type !== 'hysteria' && n.type !== 'hysteria2') {
    tls.utls = { enabled: false };
  }
  return tls;
}

function transportObject(n: ProxyNode): Record<string, unknown> | undefined {
  switch (n.network) {
    case 'ws':
      return {
        type: 'ws',
        path: n.wsPath || '/',
        headers: n.wsHeaders,
        max_early_data: 2048,
        early_data_header_name: 'Sec-WebSocket-Protocol',
      };
    case 'httpupgrade':
      return { type: 'httpupgrade', path: n.wsPath || '/', headers: n.wsHeaders };
    case 'grpc':
      return { type: 'grpc', service_name: n.grpcServiceName || '' };
    case 'h2':
      return { type: 'http', path: n.h2Path || '/', host: n.h2Host ? [n.h2Host] : undefined };
    case 'quic':
      return { type: 'quic' };
    default:
      return undefined;
  }
}

/** Mbps 字符串 -> 数字 */
function mbps(v?: string): number | undefined {
  if (!v) return undefined;
  const m = String(v).match(/([\d.]+)/);
  return m ? Number(m[1]) : undefined;
}

/**
 * 端口跳跃：mihomo 的 `ports`（"1000-3000,443"）→ sing-box 的 `server_ports`。
 *
 * sing-box 没有 `ports` 字段，且 `server_ports` 只接受 `起始:结束` 形式，
 * 单个端口必须写成 `443:443`，否则报 "bad port range: 443"。
 */
function toServerPorts(v: string): string[] {
  return v
    .split(/[,\s]+/)
    .map((x) => x.trim())
    .filter(Boolean)
    .map((x) => {
      const range = x.replace('-', ':');
      return range.includes(':') ? range : `${range}:${range}`;
    });
}

function nodeToSingbox(n: ProxyNode, version: GenerateOptions['singboxVersion']): Record<string, unknown> {
  // 1.12 起 uTLS 需要显式 enabled 字段
  const newUtls = version !== '1.11';
  const base: Record<string, unknown> = {
    type: n.type === 'shadowsocksr' ? 'shadowsocks' : n.type,
    tag: n.name,
    server: n.server,
    server_port: n.port,
  };

  switch (n.type) {
    case 'shadowsocks': {
      base.method = n.cipher;
      base.password = n.password;
      if (n.plugin) {
        base.plugin = n.plugin.replace('simple-obfs', 'obfs');
        if (n.pluginOpts) base.plugin_opts = Object.entries(n.pluginOpts).join(';');
      }
      break;
    }
    case 'shadowsocksr': {
      // sing-box 不支持 SSR，退化为 ss 并在 warnings 中提示
      base.method = n.cipher || 'none';
      base.password = n.password;
      break;
    }
    case 'vmess': {
      base.uuid = n.uuid;
      base.security = n.vmessSecurity && n.vmessSecurity !== 'auto' ? n.vmessSecurity : 'auto';
      base.alter_id = n.alterId ?? 0;
      base.global_padding = false;
      base.authenticated_length = true;
      base.packet_encoding = n.packetEncoding || 'xudp';
      break;
    }
    case 'vless': {
      base.uuid = n.uuid;
      base.packet_encoding = n.packetEncoding || 'xudp';
      if (n.flow) base.flow = n.flow;
      break;
    }
    case 'trojan': {
      base.password = n.password;
      break;
    }
    case 'hysteria': {
      // 带宽是 hysteria 的必填项，缺了 sing-box 会以 "missing upload speed" 拒绝启动。
      // 注意字段是 up_mbps / down_mbps —— 1.12 与 1.14 都不认 `up` / `down`（unknown field）。
      base.up_mbps = mbps(n.up) ?? 100;
      base.down_mbps = mbps(n.down) ?? 100;
      if (n.authStr) base.auth_str = n.authStr;
      if (n.obfsPassword) base.obfs = n.obfsPassword;
      // 端口跳跃：sing-box 用 server_ports（"443:8443" 数组），没有 mihomo 的 ports 字段
      if (n.hopPorts) base.server_ports = toServerPorts(n.hopPorts);
      // alpn 是 TLS 层字段，不能放 outbound 顶层（否则 decode 报 unknown field "alpn"）
      break;
    }
    case 'hysteria2': {
      base.password = n.password;
      base.up_mbps = mbps(n.up) ?? 100;
      base.down_mbps = mbps(n.down) ?? 100;
      if (n.obfsPassword) base.obfs = { type: 'salamander', password: n.obfsPassword };
      if (n.hopPorts) base.server_ports = toServerPorts(n.hopPorts);
      break;
    }
    case 'tuic': {
      base.uuid = n.uuid;
      base.password = n.password;
      if (n.congestion) base.congestion_control = n.congestion;
      if (n.udpRelayMode) base.udp_relay_mode = n.udpRelayMode;
      if (n.zeroRtt) base.zero_rtt_handshake = true;
      if (n.heartbeat) base.heartbeat = `${n.heartbeat}s`;
      break;
    }
    case 'anytls': {
      base.password = n.password;
      // utls 属于 TLS 层字段，在下面的 tls 块里统一处理
      break;
    }
    case 'wireguard': {
      base.local_address = n.wgLocalAddress ? n.wgLocalAddress.split(',').map((s) => s.trim()) : ['10.0.0.2/32'];
      base.private_key = n.wgPrivateKey;
      base.peer_public_key = n.wgPeerPublicKey;
      if (n.wgPreSharedKey) base.pre_shared_key = n.wgPreSharedKey;
      if (n.wgMtu) base.mtu = n.wgMtu;
      if (n.wgReserved) {
        const nums = n.wgReserved.split(/[,\s]+/).map(Number);
        if (nums.length === 3 && nums.every(Number.isFinite)) base.reserved = nums;
      }
      break;
    }
    case 'http': {
      if (n.username) base.username = n.username;
      if (n.password) base.password = n.password;
      break;
    }
    case 'socks': {
      base.version = '5';
      if (n.username) base.username = n.username;
      if (n.password) base.password = n.password;
      break;
    }
  }

  // trojan / anytls / hysteria / hysteria2 / tuic 都属于强制 TLS 的协议：
  // 节点上没有显式 tls 标记也必须写 tls 块，否则 sing-box 报 "TLS required" 拒绝启动。
  const forcedTls = n.type === 'trojan' || n.type === 'anytls' || n.type === 'hysteria' || n.type === 'hysteria2' || n.type === 'tuic';
  if (forcedTls) {
    const tls: Record<string, unknown> = { enabled: true };
    const sni = n.sni || n.server;
    if (sni) tls.server_name = sni;
    // hysteria v1 默认 alpn 是 hysteria，hysteria2 / tuic 是 h3，其余协议不设默认
    const defaultAlpn =
      n.type === 'hysteria' ? ['hysteria'] : n.type === 'hysteria2' || n.type === 'tuic' ? ['h3'] : undefined;
    const alpn = n.alpn?.length ? n.alpn : defaultAlpn;
    if (alpn) tls.alpn = alpn;
    if (n.skipCertVerify) tls.insecure = true;
    if (n.fingerprint) tls.utls = { enabled: true, fingerprint: n.fingerprint };
    base.tls = tls;
  } else if (n.type !== 'wireguard') {
    const tls = tlsObject(n, newUtls);
    if (tls) base.tls = tls;
  }

  const transport = transportObject(n);
  if (transport) base.transport = transport;

  if (n.udp) base.udp_fragment = false;
  return base;
}

/**
 * WireGuard 在 sing-box 1.11+ 必须写成 endpoint 形态（outbound 形态 1.12 起直接 FATAL）。
 * endpoints 的 tag 可以被 selector / urltest 引用，所以节点名照旧出现在策略组里。
 */
function nodeToWireguardEndpoint(n: ProxyNode): Record<string, unknown> {
  const reserved = n.wgReserved
    ? n.wgReserved
        .split(/[,\s]+/)
        .map(Number)
        .filter(Number.isFinite)
    : undefined;

  const endpoint: Record<string, unknown> = {
    type: 'wireguard',
    tag: n.name,
    address: n.wgLocalAddress ? n.wgLocalAddress.split(',').map((s) => s.trim()) : ['10.0.0.2/32'],
    private_key: n.wgPrivateKey,
    peers: [
      {
        address: n.server,
        port: n.port,
        public_key: n.wgPeerPublicKey,
        ...(n.wgPreSharedKey ? { pre_shared_key: n.wgPreSharedKey } : {}),
        ...(reserved && reserved.length === 3 ? { reserved } : {}),
        allowed_ips: ['0.0.0.0/0', '::/0'],
      },
    ],
  };
  if (n.wgMtu) endpoint.mtu = n.wgMtu;
  return endpoint;
}

export function buildSingbox(nodes: ProxyNode[], options: GenerateOptions, plan: ConfigPlan): string {
  const isRouter = options.device === 'router';
  const isSidecar = options.device === 'sidecar';
  const bindAll = isSidecar || isRouter;
  const listen = bindAll ? '0.0.0.0' : '127.0.0.1';

  const active = nodes.filter((n) => n.enabled && n.type !== 'shadowsocksr');
  const proxyTags = active.map((n) => n.name);

  const cfg: Record<string, unknown> = {
    log: {
      level: isRouter ? 'warn' : options.logLevel === 'silent' ? 'error' : options.logLevel,
      timestamp: true,
    },
  };

  /* ------------------------------- DNS ------------------------------- */
  const cnDomain = plan.ruleSets.find((r) => r.def.id === 'geo-cn-domain');
  const dnsRules: Record<string, unknown>[] = [];
  if (cnDomain) {
    dnsRules.push({ action: 'route', rule_set: [cnDomain.key], server: 'dns-direct' });
  }
  dnsRules.push({ action: 'route', query_type: ['A', 'AAAA'], server: options.fakeIp ? 'dns-fakeip' : 'dns-remote' });

  // 1.14 起 legacy DNS 格式被彻底移除（1.12 起弃用），必须按版本切换方言：
  //   1.11 → address 字符串 + 独立 dns.fakeip 块
  //   1.12+ → type + server，fakeip 作为 servers 里的一个条目
  const newDns = usesNewDnsFormat(options.singboxVersion);
  const dnsServers: Record<string, unknown>[] = newDns
    ? [
        { ...dnsServerOf(options.dnsDirect, 'direct'), tag: 'dns-direct' },
        { ...dnsServerOf(options.dnsRemote, '🚀 节点选择'), tag: 'dns-remote' },
        ...(options.fakeIp ? [{ type: 'fakeip', tag: 'dns-fakeip', inet4_range: '198.18.0.0/15' }] : []),
      ]
    : [
        { tag: 'dns-direct', address: splitDnsFirst(options.dnsDirect), detour: 'direct' },
        { tag: 'dns-remote', address: splitDnsFirst(options.dnsRemote), detour: '🚀 节点选择' },
        ...(options.fakeIp ? [{ tag: 'dns-fakeip', address: 'fakeip' }] : []),
      ];

  cfg.dns = {
    servers: dnsServers,
    rules: dnsRules,
    final: 'dns-remote',
    strategy: options.ipv6 ? 'prefer_ipv6' : 'prefer_ipv4',
    independent_cache: true,
    ...(options.fakeIp && !newDns ? { fakeip: { enabled: true, inet4_range: '198.18.0.0/15' } } : {}),
  };

  /* ------------------------------ Inbounds ----------------------------- */
  // 1.13 起入站的 sniff / sniff_override_destination / domain_strategy 被移除，
  // 改为 route 规则动作；1.14 起再写旧字段会直接 FATAL。
  const newInbound = usesNewInboundFields(options.singboxVersion);
  const dnsStrategy = options.ipv6 ? 'prefer_ipv6' : 'prefer_ipv4';
  const sniffFields = (override: boolean) =>
    newInbound ? {} : { sniff: true, sniff_override_destination: override };

  const inbounds: Record<string, unknown>[] = [
    {
      type: 'mixed',
      tag: 'mixed-in',
      listen,
      listen_port: options.mixedPort,
      ...sniffFields(true),
      ...(newInbound ? {} : { domain_strategy: dnsStrategy }),
    },
  ];
  if (options.enableTun) {
    inbounds.push({
      type: 'tun',
      tag: 'tun-in',
      interface_name: 'sing-box',
      address: options.ipv6 ? ['172.19.0.1/30', 'fdfe:dcba:9876::1/126'] : ['172.19.0.1/30'],
      // 路由器出口多为 PPPoE（MTU 1492），9000 的大包会分片，部分站点因此打不开
      mtu: isRouter ? 1500 : 9000,
      auto_route: true,
      strict_route: true,
      endpoint_independent_nat: !isRouter,
      ...sniffFields(false),
      stack: 'system',
      ...(isSidecar || isRouter ? { route_exclude_address: ['192.168.0.0/16', '10.0.0.0/8', '172.16.0.0/12'] } : {}),
    });
  } else if (isSidecar || isRouter) {
    inbounds.push({
      type: 'tproxy',
      tag: 'tproxy-in',
      listen: '0.0.0.0',
      listen_port: 7893,
      ...sniffFields(true),
    });
    inbounds.push({
      type: 'redirect',
      tag: 'redirect-in',
      listen: '0.0.0.0',
      listen_port: 7892,
      ...sniffFields(true),
    });
  }
  cfg.inbounds = inbounds;

  // 新版用 route 规则动作承担旧入站字段的职责。
  // sniff 动作只有 sniffer / timeout 两个参数（没有 override_destination），
  // 嗅探后连接目标会被自动改写，无需再显式声明。
  const sniffRules: Record<string, unknown>[] = [];
  if (newInbound) {
    for (const ib of inbounds) {
      const tag = ib.tag as string;
      if (tag === 'mixed-in') sniffRules.push({ inbound: [tag], action: 'resolve', strategy: dnsStrategy });
      sniffRules.push({ inbound: [tag], action: 'sniff' });
    }
  }

  /* ------------------------------ Outbounds ---------------------------- */
  const outbounds: Record<string, unknown>[] = [];
  outbounds.push({
    type: 'selector',
    tag: '🚀 节点选择',
    outbounds: ['♻️ 自动选择', ...proxyTags, 'direct'],
    default: '♻️ 自动选择',
  });
  outbounds.push({
    type: 'urltest',
    tag: '♻️ 自动选择',
    outbounds: [...proxyTags],
    url: options.urlTestUrl,
    interval: `${options.urlTestInterval}s`,
    tolerance: 50,
  });
  for (const g of plan.groups) {
    if (g.type === 'reject') continue;
    outbounds.push({
      type: g.type === 'urltest' ? 'urltest' : 'selector',
      tag: g.label,
      outbounds: g.type === 'urltest' ? [...proxyTags] : ['🚀 节点选择', ...proxyTags, 'direct'],
      // default 只有 selector 认；urltest 带这个字段会报 unknown field "default"
      ...(g.type === 'urltest'
        ? { url: options.urlTestUrl, interval: `${options.urlTestInterval}s`, tolerance: 50 }
        : { default: '🚀 节点选择' }),
    });
  }
  outbounds.push({ type: 'direct', tag: 'direct' });
  // 注意：这里不能声明 `block` / `dns` 这两个 legacy 特殊 outbound。
  // sing-box 1.11 起弃用它们，1.12 起直接 FATAL 拒绝启动：
  //   "legacy special outbounds is deprecated ... set ENABLE_DEPRECATED_SPECIAL_OUTBOUNDS=true"
  // 拦截与 DNS 劫持已全部由 route.rules 的 action: reject / hijack-dns 承担，无需占位。
  //
  // WireGuard 同理：1.11 起 outbound 形态被弃用、1.12 起 FATAL，必须写成 endpoints。
  // endpoints 的 tag 同样可以被 proxy-groups 引用，所以节点名照旧可用。
  for (const n of active) {
    if (n.type !== 'wireguard') outbounds.push(nodeToSingbox(n, options.singboxVersion));
  }
  const wgEndpoints = active.filter((n) => n.type === 'wireguard').map(nodeToWireguardEndpoint);
  if (wgEndpoints.length) cfg.endpoints = wgEndpoints;
  cfg.outbounds = outbounds;

  /* -------------------------------- Route ------------------------------ */
  const routeRules: Record<string, unknown>[] = [...sniffRules];
  // DNS 劫持：53 端口查询交给内置 DNS。sing-box 没有独立 DNS 监听端口，
  // 上游路由器把客户端 DNS 指向本机后，查询必须经入站被这条规则接管，
  // 否则网关模式下（RouterOS / 主路由把 DNS 指过来）所有解析都会失败。
  if (options.enableTun || options.device !== 'client') {
    routeRules.push({ port: 53, action: 'hijack-dns' });
  }
  // 拦截 QUIC：UDP 443 经网关/代理转发质量差，强制回落 TCP
  if (options.blockQuic) {
    routeRules.push({ network: 'udp', port: 443, action: 'reject' });
  }
  for (const r of plan.route) {
    if (r.kind === 'custom') {
      const c = r.customRule!;
      routeRules.push(customRuleToSingbox(c, r.target));
      continue;
    }
    if (r.kind === 'builtin') {
      if (r.builtin === 'GEOIP,LAN') {
        routeRules.push({ action: 'route', ip_is_private: true, outbound: 'direct' });
      }
      continue;
    }
    if (r.action === 'reject' || r.target === 'REJECT') {
      routeRules.push({ action: 'reject', rule_set: [r.ruleSetKey] });
    } else {
      routeRules.push({ action: 'route', rule_set: [r.ruleSetKey], outbound: mapTarget(r.target) });
    }
  }

  cfg.route = {
    rules: routeRules,
    rule_set: plan.ruleSets.map((rs) => ({
      tag: rs.key,
      type: 'remote',
      format: 'binary',
      url: rs.url,
      update_interval: `${options.ruleSetInterval}s`,
      download_detour: 'direct',
    })),
    final: options.finalRule === 'proxy' ? '🚀 节点选择' : 'direct',
    auto_detect_interface: true,
    // default_domain_resolver 是 1.12 才引入的，1.11 写进去会 unknown field
    ...(newDns
      ? { default_domain_resolver: { server: 'dns-direct', strategy: options.ipv6 ? 'prefer_ipv6' : 'prefer_ipv4' } }
      : {}),
  };

  /* --------------------------- Experimental ---------------------------- */
  cfg.experimental = {
    clash_api: {
      external_controller: `${bindAll ? '0.0.0.0' : '127.0.0.1'}:${options.controllerPort}`,
      external_ui: 'ui',
      external_ui_download_url: 'https://testingcf.jsdelivr.net/gh/MetaCubeX/Yacd-meta@gh-pages',
      secret: '',
      default_mode: options.strategy === 'global' ? 'global' : 'rule',
    },
    cache_file: { enabled: true, path: 'cache.db', store_fakeip: !isRouter },
  };

  cfg.ntp = {
    // sing-box 统一用 enabled，写成 enable 会 decode 失败（unknown field "enable"）
    enabled: true,
    server: 'time.apple.com',
    server_port: 123,
    interval: '30m',
    write_to_system: false,
  };

  return JSON.stringify(clean(cfg), null, 2);
}

/** 中间计划里使用 mihomo 语义的保留字，这里映射到 sing-box 的内置 tag */
function mapTarget(t: string): string {
  if (t === 'DIRECT') return 'direct';
  if (t === 'REJECT') return 'block';
  return t;
}

/** mihomo 语义的自定义规则 -> sing-box route rule */
function customRuleToSingbox(c: { type: CustomRuleType; value: string }, target: string): Record<string, unknown> {
  const outbound = mapTarget(target);
  const action = outbound === 'block' ? 'reject' : 'route';
  const base: Record<string, unknown> = action === 'reject' ? { action: 'reject' } : { action: 'route', outbound };
  switch (c.type) {
    case 'DOMAIN-SUFFIX':
      return { ...base, domain_suffix: [c.value] };
    case 'DOMAIN':
      return { ...base, domain: [c.value] };
    case 'DOMAIN-KEYWORD':
      return { ...base, domain_keyword: [c.value] };
    case 'IP-CIDR':
      return { ...base, ip_cidr: [c.value] };
    case 'SRC-IP-CIDR':
      return { ...base, source_ip_cidr: [c.value] };
    case 'DST-PORT': {
      const port = Number(c.value);
      return { ...base, port: Number.isFinite(port) ? port : c.value };
    }
  }
}

function splitDnsFirst(v: string): string {
  return (
    v
      .split(/[,\n]/)
      .map((x) => x.trim())
      .filter(Boolean)[0] || 'https://223.5.5.5/dns-query'
  );
}

/**
 * 把用户填的 DNS 地址翻译成 sing-box 1.12+ 的服务器条目（1.14 起只认这种写法）。
 *
 * https://223.5.5.5/dns-query → { type: 'https', server: '223.5.5.5' }
 * 8.8.8.8 / udp://8.8.8.8     → { type: 'udp',   server: '8.8.8.8' }
 * tls://1.1.1.1               → { type: 'tls',   server: '1.1.1.1' }
 * local                       → { type: 'local' }
 * dhcp://auto                 → { type: 'dhcp' }
 */
function dnsServerOf(raw: string, detour: string): Record<string, unknown> {
  const v = splitDnsFirst(raw).trim();
  if (v === 'local') return { type: 'local' };

  const m = /^([a-z][a-z0-9+.-]*):\/\/(.*)$/i.exec(v);
  const scheme = (m ? m[1] : 'udp').toLowerCase();
  const rest = m ? m[2] : v;

  if (scheme === 'dhcp') {
    const iface = rest.split('/')[0];
    return iface && iface !== 'auto' ? { type: 'dhcp', interface: iface } : { type: 'dhcp' };
  }

  // DoH 的路径（/dns-query）在新格式里由 type 表达，不再需要
  const server = rest.split('/')[0];
  const type = ['tcp', 'tls', 'https', 'quic', 'h3'].includes(scheme) ? scheme : 'udp';
  return { type, server, detour };
}
