import yaml from 'js-yaml';
import type { GenerateOptions, ProxyNode } from '../types';
import { CUSTOM_RULE_TYPE_META } from '../types';
import type { ConfigPlan } from '../generator';

/** 移除 undefined / null / 空对象 / 空数组，保留 false */
function clean<T>(obj: T): T {
  if (Array.isArray(obj)) {
    return obj.filter((v) => v !== undefined && v !== null).map((v) => clean(v)) as unknown as T;
  }
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

function nodeToMihomo(n: ProxyNode): Record<string, unknown> {
  const o: Record<string, unknown> = {
    name: n.name,
    server: n.server,
    port: n.port,
    udp: n.udp,
  };

  const tlsBlock = () => {
    if (n.realityPublicKey) {
      o['reality-opts'] = { 'public-key': n.realityPublicKey, 'short-id': n.realityShortId || '' };
    }
    if (n.sni) o.servername = n.sni;
    if (n.alpn?.length) o.alpn = n.alpn;
    if (n.skipCertVerify) o['skip-cert-verify'] = true;
    if (n.fingerprint) o['client-fingerprint'] = n.fingerprint;
  };

  switch (n.type) {
    case 'shadowsocks': {
      o.type = 'ss';
      o.cipher = n.cipher;
      o.password = n.password;
      if (n.plugin) {
        o.plugin = normalizePlugin(n.plugin);
        if (n.pluginOpts && Object.keys(n.pluginOpts).length) {
          o['plugin-opts'] = { ...n.pluginOpts };
        }
      }
      break;
    }
    case 'shadowsocksr': {
      o.type = 'ssr';
      o.cipher = n.cipher || 'auto';
      o.password = n.password;
      o.protocol = n.ssrProtocol || 'origin';
      o.obfs = n.ssrObfs || 'plain';
      if (n.ssrProtocolParam) o['protocol-param'] = n.ssrProtocolParam;
      if (n.ssrObfsParam) o['obfs-param'] = n.ssrObfsParam;
      break;
    }
    case 'vmess': {
      o.type = 'vmess';
      o.uuid = n.uuid;
      o.alterId = n.alterId ?? 0;
      o.cipher = n.vmessSecurity || 'auto';
      if (n.tls) {
        o.tls = true;
        tlsBlock();
      }
      applyTransport(o, n);
      if (n.packetEncoding) o['packet-addr'] = n.packetEncoding === 'packetaddr';
      break;
    }
    case 'vless': {
      o.type = 'vless';
      o.uuid = n.uuid;
      if (n.flow) o.flow = n.flow;
      if (n.tls) {
        o.tls = true;
        tlsBlock();
      }
      applyTransport(o, n);
      if (n.packetEncoding) o['packet-addr'] = n.packetEncoding === 'packetaddr';
      break;
    }
    case 'trojan': {
      o.type = 'trojan';
      o.password = n.password;
      o.tls = true;
      if (n.sni) o.sni = n.sni;
      else o.sni = n.server;
      if (n.alpn?.length) o.alpn = n.alpn;
      if (n.skipCertVerify) o['skip-cert-verify'] = true;
      if (n.fingerprint) o.fingerprint = n.fingerprint;
      applyTransport(o, n);
      break;
    }
    case 'hysteria': {
      o.type = 'hysteria';
      if (n.authStr) o['auth-str'] = n.authStr;
      o.up = n.up || '100 Mbps';
      o.down = n.down || '100 Mbps';
      o.protocol = 'udp';
      if (n.sni) o.sni = n.sni;
      else o.sni = n.server;
      if (n.obfsPassword) o.obfs = n.obfsPassword;
      if (n.hopPorts) o.ports = n.hopPorts;
      o.alpn = n.alpn?.length ? n.alpn : ['hysteria'];
      if (n.skipCertVerify) o['skip-cert-verify'] = true;
      break;
    }
    case 'hysteria2': {
      o.type = 'hysteria2';
      o.password = n.password;
      if (n.up) o.up = n.up;
      if (n.down) o.down = n.down;
      if (n.obfsPassword) {
        o.obfs = 'salamander';
        o['obfs-password'] = n.obfsPassword;
      }
      if (n.hopPorts) o.ports = n.hopPorts;
      if (n.sni) o.sni = n.sni;
      else o.sni = n.server;
      if (n.skipCertVerify) o['skip-cert-verify'] = true;
      break;
    }
    case 'tuic': {
      o.type = 'tuic';
      o.uuid = n.uuid;
      o.password = n.password;
      if (n.congestion) o['congestion-controller'] = n.congestion;
      if (n.udpRelayMode) o['udp-relay-mode'] = n.udpRelayMode;
      if (n.sni) o.sni = n.sni;
      else o.sni = n.server;
      o.alpn = n.alpn?.length ? n.alpn : ['h3'];
      if (n.disableSni) o['disable-sni'] = true;
      if (n.reduceRtt) o['reduce-rtt'] = true;
      if (n.zeroRtt) o['zero-rtt-handshake'] = true;
      if (n.heartbeat) o['heartbeat-interval'] = n.heartbeat;
      if (n.skipCertVerify) o['skip-cert-verify'] = true;
      break;
    }
    case 'anytls': {
      o.type = 'anytls';
      o.password = n.password;
      if (n.sni) o.sni = n.sni;
      else o.sni = n.server;
      if (n.alpn?.length) o.alpn = n.alpn;
      if (n.skipCertVerify) o['skip-cert-verify'] = true;
      if (n.fingerprint) o.fingerprint = n.fingerprint;
      break;
    }
    case 'wireguard': {
      o.type = 'wireguard';
      o.ip = n.wgLocalAddress;
      o['private-key'] = n.wgPrivateKey;
      o['peer-public-key'] = n.wgPeerPublicKey;
      if (n.wgPreSharedKey) o['pre-shared-key'] = n.wgPreSharedKey;
      if (n.wgReserved) o.reserved = parseReserved(n.wgReserved);
      if (n.wgMtu) o.mtu = n.wgMtu;
      o['remote-dns-resolve'] = true;
      o.dns = ['1.1.1.1', '8.8.8.8'];
      break;
    }
    case 'http': {
      o.type = 'http';
      if (n.username) o.username = n.username;
      if (n.password) o.password = n.password;
      if (n.tls) {
        o.tls = true;
        if (n.sni) o.sni = n.sni;
        if (n.skipCertVerify) o['skip-cert-verify'] = true;
      }
      break;
    }
    case 'socks': {
      o.type = 'socks5';
      if (n.username) o.username = n.username;
      if (n.password) o.password = n.password;
      if (n.tls) {
        o.tls = true;
        if (n.skipCertVerify) o['skip-cert-verify'] = true;
      }
      break;
    }
  }
  return o;
}

function normalizePlugin(p: string): string {
  if (p.startsWith('simple-obfs')) return 'obfs';
  return p;
}

function parseReserved(s: string): number[] | undefined {
  const nums = s.split(/[,\s]+/).map((x) => Number(x));
  return nums.length === 3 && nums.every(Number.isFinite) ? nums : undefined;
}

function applyTransport(o: Record<string, unknown>, n: ProxyNode) {
  switch (n.network) {
    case 'ws':
      o.network = 'ws';
      o['ws-opts'] = { path: n.wsPath || '/', headers: n.wsHeaders };
      break;
    case 'httpupgrade':
      o.network = 'httpupgrade';
      o['ws-opts'] = { path: n.wsPath || '/', headers: n.wsHeaders };
      break;
    case 'grpc':
      o.network = 'grpc';
      o['grpc-opts'] = { 'grpc-service-name': n.grpcServiceName || '' };
      break;
    case 'h2':
      o.network = 'h2';
      o['h2-opts'] = { path: n.h2Path || '/', host: n.h2Host ? [n.h2Host] : undefined };
      break;
    default:
      break;
  }
}

export function buildMihomo(nodes: ProxyNode[], options: GenerateOptions, plan: ConfigPlan): string {
  const isRouter = options.device === 'router';
  const isSidecar = options.device === 'sidecar';
  const bindAll = isSidecar || isRouter;

  const cfg: Record<string, unknown> = {
    'mixed-port': options.mixedPort,
    'allow-lan': options.allowLan || bindAll,
    'bind-address': bindAll ? '*' : '127.0.0.1',
    mode: options.strategy === 'global' ? 'global' : 'rule',
    'log-level': isRouter ? 'warning' : options.logLevel,
    ipv6: options.ipv6,
    'unified-delay': true,
    'tcp-concurrent': !isRouter,
    'find-process-mode': isRouter ? 'off' : 'strict',
    'external-controller': `${bindAll ? '0.0.0.0' : '127.0.0.1'}:${options.controllerPort}`,
    'keep-alive-interval': isRouter ? 60 : 30,
    'global-ua': 'clash.meta',
    profile: {
      'store-selected': true,
      'store-fake-ip': !isRouter,
    },
  };

  /* ------------------------------- TUN ------------------------------- */
  if (options.enableTun) {
    cfg.tun = {
      enable: true,
      stack: 'system',
      'auto-route': true,
      'auto-detect-interface': true,
      'strict-route': true,
      // 路由器/旁路由出口多为 PPPoE（MTU 1492），9000 的大包会分片，部分站点因此打不开
      mtu: isRouter ? 1500 : 9000,
      'dns-hijack': ['tcp://any:53', 'udp://any:53'],
      'endpoint-independent-nat': !isRouter,
    };
  } else if (isSidecar || isRouter) {
    // 不开 TUN 时，旁路由/路由器用 tproxy + redir 承接透明代理
    cfg['tproxy-port'] = 7893;
    cfg['redir-port'] = 7892;
  }

  /* ------------------------------- DNS ------------------------------- */
  const dns: Record<string, unknown> = {
    enable: true,
    'prefer-h3': true,
    ipv6: options.ipv6,
    'respect-rules': true,
    'use-hosts': true,
    listen: `${bindAll ? '0.0.0.0' : '127.0.0.1'}:1053`,
    'enhanced-mode': options.fakeIp ? 'fake-ip' : 'redir-host',
    nameserver: splitDns(options.dnsDirect),
    fallback: splitDns(options.dnsRemote),
    // respect-rules 为 true 时 mihomo 强制要求此项非空，否则整份配置拒绝加载：
    //   "if "respect-rules" is turned on, "proxy-server-nameserver" cannot be empty"
    // 它负责在不经代理的前提下解析节点域名，所以只能填「本身不需要再解析」的地址。
    'proxy-server-nameserver': plainDnsOf(options.dnsDirect),
    'fallback-filter': { geoip: true, 'geoip-code': 'CN', ipcidr: ['240.0.0.0/4', '0.0.0.0/32'] },
  };
  if (options.fakeIp) {
    dns['fake-ip-range'] = '198.18.0.1/16';
    dns['fake-ip-filter-mode'] = options.fakeIpFilterMode;
    dns['fake-ip-filter'] = [
      '+.lan',
      '+.local',
      '+.arpa',
      '+.router',
      '+.home',
      '+.msftconnecttest.com',
      '+.msftncsi.com',
      '+.openwrt.org',
      'time.*.com',
      'ntp.*.com',
      '+.pool.ntp.org',
      '+.cn',
    ];
  }
  cfg.dns = dns;

  cfg.sniffer = {
    enable: true,
    'force-dns-mapping': true,
    'parse-pure-ip': true,
    'override-destination': true,
    sniff: {
      HTTP: { ports: [80, '8080-8880'], 'override-destination': true },
      TLS: { ports: [443, 8443] },
      QUIC: { ports: [443, 8443] },
    },
  };

  cfg.geodata = {
    mode: true,
    loader: isRouter ? 'memconservative' : 'standard',
  };
  cfg['geox-url'] = {
    geoip:
      options.mirror === 'raw'
        ? 'https://testingcf.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@release/geoip.dat'
        : 'https://testingcf.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@release/geoip.dat',
    geosite: 'https://testingcf.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@release/geosite.dat',
    mmdb: 'https://testingcf.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@release/country.mmdb',
    asn: 'https://testingcf.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@release/GeoLite2-ASN.mmdb',
  };
  cfg['external-ui-url'] = 'https://testingcf.jsdelivr.net/gh/MetaCubeX/Yacd-meta@gh-pages';

  /* ---------------------------- 节点与策略组 ---------------------------- */
  const active = nodes.filter((n) => n.enabled);
  const proxyNames = active.map((n) => n.name);
  cfg.proxies = active.map(nodeToMihomo);

  const groups: Record<string, unknown>[] = [];

  const mainProxies = ['♻️ 自动选择', ...proxyNames, 'DIRECT'];
  groups.push({
    name: '🚀 节点选择',
    type: 'select',
    proxies: mainProxies,
  });
  groups.push({
    name: '♻️ 自动选择',
    // mihomo 只认带连字符的 url-test；写 urltest 会被 adapter/outboundgroup/parser.go
    // 判为 `unsupported type: urltest` 而整份配置加载失败
    type: 'url-test',
    proxies: [...proxyNames],
    url: options.urlTestUrl,
    interval: options.urlTestInterval,
    tolerance: 50,
  });

  for (const g of plan.groups) {
    if (g.type === 'reject') continue;
    groups.push({
      name: g.label,
      type: g.type === 'urltest' ? 'url-test' : 'select',
      proxies: g.type === 'urltest' ? [...proxyNames] : ['🚀 节点选择', ...proxyNames, 'DIRECT'],
      url: g.type === 'urltest' ? options.urlTestUrl : undefined,
      interval: g.type === 'urltest' ? options.urlTestInterval : undefined,
      tolerance: g.type === 'urltest' ? 50 : undefined,
    });
  }

  groups.push({
    name: '🐟 漏网之鱼',
    type: 'select',
    proxies: ['🚀 节点选择', ...proxyNames, 'DIRECT'],
  });

  cfg['proxy-groups'] = groups;

  /* ------------------------------ 规则集 ------------------------------ */
  const providers: Record<string, unknown> = {};
  for (const rs of plan.ruleSets) {
    providers[rs.key] = {
      type: 'http',
      behavior: rs.def.kind === 'ipcidr' ? 'ipcidr' : 'domain',
      format: 'mrs',
      url: rs.url,
      path: `./ruleset/${rs.key}.mrs`,
      interval: options.ruleSetInterval,
    };
  }
  if (Object.keys(providers).length) cfg['rule-providers'] = providers;

  /* ------------------------------- 规则 ------------------------------- */
  const rules: string[] = [];
  // 拦截 QUIC：UDP 443 经网关/代理转发质量差，强制回落 TCP 能改善「部分站点打不开」「视频卡」「国内站慢」
  if (options.blockQuic) {
    rules.push('AND,((NETWORK,UDP),(DST-PORT,443)),REJECT');
  }
  for (const r of plan.route) {
    const noResolve = r.ruleSetDef?.kind === 'ipcidr' ? ',no-resolve' : '';
    if (r.kind === 'ruleset') {
      rules.push(`RULE-SET,${r.ruleSetKey},${r.target}${noResolve}`);
    } else if (r.kind === 'custom') {
      const c = r.customRule!;
      const ipRule = CUSTOM_RULE_TYPE_META[c.type].isIp;
      rules.push(`${c.type},${c.value.trim()},${r.target}${ipRule ? ',no-resolve' : ''}`);
    } else {
      rules.push(`${r.builtin},${r.target}${noResolve}`);
    }
  }
  if (options.bypassLan) rules.push('GEOIP,LAN,DIRECT,no-resolve');
  rules.push(`MATCH,${options.finalRule === 'proxy' ? '🚀 节点选择' : 'DIRECT'}`);
  cfg.rules = rules;

  /* ------------------------------ 输出 ------------------------------- */
  const body = yaml.dump(clean(cfg), {
    lineWidth: -1,
    noRefs: true,
    quotingType: '"',
    forceQuotes: false,
    indent: 2,
  });

  return `${header(options, plan)}\n${body}`;
}

function splitDns(v: string): string[] {
  return v
    .split(/[,\n]/)
    .map((x) => x.trim())
    .filter(Boolean);
}

/**
 * 从直连 DNS 列表里挑出「无需再解析」的地址，供 proxy-server-nameserver 使用。
 *
 * DoH 形如 https://223.5.5.5/dns-query，主机部分本身就是 IP，可以直接用；
 * 若用户填的是 https://dns.alidns.com/dns-query 这种域名型 DoH，会解析失败
 * （解析它自己又需要 DNS），此时回退到公共明文 DNS。
 */
function plainDnsOf(v: string): string[] {
  const out: string[] = [];
  for (const raw of splitDns(v)) {
    const host = raw.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '').split('/')[0].replace(/^\[|\]$/g, '');
    const isIpv4 = /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
    const isIpv6 = host.includes(':') && /^[0-9a-f:.]+$/i.test(host);
    if (isIpv4 || isIpv6) out.push(host);
  }
  return out.length ? out : ['223.5.5.5', '119.29.29.29'];
}

function header(options: GenerateOptions, plan: ConfigPlan): string {
  const lines: string[] = [];
  lines.push('# ============================================================');
  lines.push('# 由「代理工坊 ProxyForge」生成 · mihomo (Clash.Meta)');
  lines.push(`# 设备形态：${deviceName(options.device)}   分流策略：${strategyName(options.strategy)}`);
  lines.push(
    `# 节点 ${plan.nodeCount} 个    规则集 ${plan.ruleSets.length} 套    生成时间 ${new Date().toLocaleString('zh-CN')}`,
  );
  lines.push('# ============================================================');
  lines.push('#');
  if (options.device === 'client') {
    lines.push('# 客户端用法：本配置直接作为 config.yaml 启动即可，');
    lines.push(`#   HTTP/SOCKS 混合端口 ${options.mixedPort}，控制面板 http://127.0.0.1:${options.controllerPort}/ui`);
    if (options.enableTun) lines.push('#   TUN 已开启，可在客户端中打开「系统代理 / TUN 模式」接管全部流量。');
  } else {
    lines.push('# 旁路由 / 路由器用法：');
    lines.push('#   1) 本配置放到设备后启动，mixed-port 对外提供 HTTP/SOCKS；');
    if (options.enableTun) {
      lines.push('#   2) TUN 已开启并自动劫持 53 端口 DNS，局域网设备把网关与 DNS 指向本机即可；');
    } else {
      lines.push(
        `#   2) 已开启 redir-port ${7892} 与 tproxy-port ${7893}，需要配合 nftables/iptables 规则做透明代理；`,
      );
      lines.push('#      同时请把 dnsmasq 的上游设为 127.0.0.1:1053 或劫持 53 端口到本机。');
    }
    lines.push(`#   3) 控制面板已监听 0.0.0.0:${options.controllerPort}，可从局域网访问。`);
  }
  if (plan.warnings.length) {
    lines.push('#');
    lines.push('# ⚠️ 注意事项：');
    for (const w of plan.warnings) lines.push(`#   - ${w}`);
  }
  if (plan.tips.length) {
    lines.push('#');
    lines.push('# 💡 使用提示：');
    for (const t of plan.tips) lines.push(`#   - ${t}`);
  }
  lines.push('# ============================================================');
  lines.push('');
  return lines.join('\n');
}

function deviceName(d: GenerateOptions['device']): string {
  return d === 'client' ? '客户端' : d === 'sidecar' ? '旁路由' : '主路由';
}

function strategyName(s: GenerateOptions['strategy']): string {
  return s === 'whitelist' ? '白名单（国外走代理）' : s === 'blacklist' ? '黑名单（仅 GFW 走代理）' : '全局代理';
}
