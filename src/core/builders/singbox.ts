import type { GenerateOptions, ProxyNode } from '../types';
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

function nodeToSingbox(n: ProxyNode, version: GenerateOptions['singboxVersion']): Record<string, unknown> {
  const isNew = version === '1.12';
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
      if (isNew) {
        if (n.up) base.up = n.up.endsWith('Mbps') ? n.up : `${n.up} Mbps`;
        if (n.down) base.down = n.down.endsWith('Mbps') ? n.down : `${n.down} Mbps`;
      } else {
        if (n.up) base.up_mbps = mbps(n.up);
        if (n.down) base.down_mbps = mbps(n.down);
      }
      if (n.authStr) base.auth_str = n.authStr;
      if (n.obfsPassword) base.obfs = n.obfsPassword;
      if (n.hopPorts) base.ports = n.hopPorts;
      base.alpn = n.alpn?.length ? n.alpn : ['hysteria'];
      break;
    }
    case 'hysteria2': {
      base.password = n.password;
      if (isNew) {
        if (n.up) base.up = n.up.endsWith('Mbps') ? n.up : `${n.up} Mbps`;
        if (n.down) base.down = n.down.endsWith('Mbps') ? n.down : `${n.down} Mbps`;
      } else {
        if (n.up) base.up_mbps = mbps(n.up);
        if (n.down) base.down_mbps = mbps(n.down);
      }
      if (n.obfsPassword) base.obfs = { type: 'salamander', password: n.obfsPassword };
      if (n.hopPorts) base.ports = n.hopPorts;
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
      if (n.fingerprint) base.utls = { enabled: true, fingerprint: n.fingerprint };
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

  if (n.type !== 'wireguard' && n.type !== 'hysteria' && n.type !== 'hysteria2' && n.type !== 'tuic') {
    const tls = tlsObject(n, isNew);
    if (tls) base.tls = tls;
  } else if (n.type === 'hysteria' || n.type === 'hysteria2' || n.type === 'tuic') {
    const tls: Record<string, unknown> = { enabled: true };
    const sni = n.sni || n.server;
    if (sni) tls.server_name = sni;
    if (n.type === 'tuic') tls.alpn = n.alpn?.length ? n.alpn : ['h3'];
    else if (n.alpn?.length) tls.alpn = n.alpn;
    if (n.skipCertVerify) tls.insecure = true;
    base.tls = tls;
  }

  const transport = transportObject(n);
  if (transport) base.transport = transport;

  if (n.udp) base.udp_fragment = false;
  return base;
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

  cfg.dns = {
    servers: [
      { tag: 'dns-direct', address: splitDnsFirst(options.dnsDirect), detour: 'direct' },
      { tag: 'dns-remote', address: splitDnsFirst(options.dnsRemote), detour: '🚀 节点选择' },
      ...(options.fakeIp
        ? [{ tag: 'dns-fakeip', address: 'fakeip' }]
        : []),
    ],
    rules: dnsRules,
    final: 'dns-remote',
    strategy: options.ipv6 ? 'prefer_ipv6' : 'prefer_ipv4',
    independent_cache: true,
    ...(options.fakeIp ? { fakeip: { enabled: true, inet4_range: '198.18.0.0/15' } } : {}),
  };

  /* ------------------------------ Inbounds ----------------------------- */
  const inbounds: Record<string, unknown>[] = [
    {
      type: 'mixed',
      tag: 'mixed-in',
      listen,
      listen_port: options.mixedPort,
      sniff: true,
      sniff_override_destination: true,
      domain_strategy: options.ipv6 ? 'prefer_ipv6' : 'prefer_ipv4',
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
      sniff: true,
      sniff_override_destination: false,
      stack: 'system',
      ...(isSidecar || isRouter ? { route_exclude_address: ['192.168.0.0/16', '10.0.0.0/8', '172.16.0.0/12'] } : {}),
    });
  } else if (isSidecar || isRouter) {
    inbounds.push({
      type: 'tproxy',
      tag: 'tproxy-in',
      listen: '0.0.0.0',
      listen_port: 7893,
      sniff: true,
      sniff_override_destination: true,
    });
    inbounds.push({
      type: 'redirect',
      tag: 'redirect-in',
      listen: '0.0.0.0',
      listen_port: 7892,
      sniff: true,
      sniff_override_destination: true,
    });
  }
  cfg.inbounds = inbounds;

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
      default: '🚀 节点选择',
      ...(g.type === 'urltest'
        ? { url: options.urlTestUrl, interval: `${options.urlTestInterval}s`, tolerance: 50 }
        : {}),
    });
  }
  outbounds.push({ type: 'direct', tag: 'direct' });
  outbounds.push({ type: 'block', tag: 'block' });
  outbounds.push({ type: 'dns', tag: 'dns-out' });
  for (const n of active) outbounds.push(nodeToSingbox(n, options.singboxVersion));
  cfg.outbounds = outbounds;

  /* -------------------------------- Route ------------------------------ */
  const routeRules: Record<string, unknown>[] = [];
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
    if (r.action === 'reject') {
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
    default_domain_resolver: { server: 'dns-direct', strategy: options.ipv6 ? 'prefer_ipv6' : 'prefer_ipv4' },
  };

  /* --------------------------- Experimental ---------------------------- */
  cfg.experimental = {
    clash_api: {
      external_controller: `${bindAll ? '0.0.0.0' : '127.0.0.1'}:${options.controllerPort}`,
      external_ui: 'ui',
      external_ui_download_url:
        'https://testingcf.jsdelivr.net/gh/MetaCubeX/Yacd-meta@gh-pages',
      secret: '',
      default_mode: options.strategy === 'global' ? 'global' : 'rule',
    },
    cache_file: { enabled: true, path: 'cache.db', store_fakeip: !isRouter },
  };

  cfg.ntp = {
    enable: true,
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
  return v
    .split(/[,\n]/)
    .map((x) => x.trim())
    .filter(Boolean)[0] || 'https://223.5.5.5/dns-query';
}
