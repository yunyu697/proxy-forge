/**
 * 部署与 DNS 指南
 *
 * 职责：
 *  1. 根据当前生成选项（设备形态 / 内核 / TUN / Fake-IP / 端口）输出 DNS 拓扑说明，
 *     告诉用户「这份配置的 DNS 是怎么工作的、上游路由器要怎么配合」；
 *  2. 提供主流路由系统的设置步骤（OpenWrt / iStoreOS / 华硕梅林 / 通用 DHCP）；
 *  3. 生成 RouterOS 的增量 / 全量配置脚本，保证与代理配置相容：
 *     - mihomo 有独立 DNS 监听（1053），可以直接做 53 -> 1053 的端口重定向；
 *     - sing-box 没有独立 DNS 监听，依赖 TUN 的 hijack-dns 规则，必须走「网关模式」。
 */
import type { GenerateOptions } from './types';

export interface CodeBlock {
  title: string;
  lang: 'bash' | 'routeros';
  content: string;
}

export interface RouterGuide {
  id: string;
  name: string;
  summary: string;
  steps: string[];
  commands?: CodeBlock[];
  notes?: string[];
}

export interface DnsGuide {
  /** DNS 接管方式一句话描述 */
  mode: string;
  /** DNS 监听地址（对局域网暴露的入口） */
  listen: string;
  /** 劫持方式说明 */
  hijack: string;
  /** 上游：国内 / 国外 */
  upstream: { direct: string; remote: string };
  /** Fake-IP 信息 */
  fakeIp: string;
  /** 与代理配置相容的注意事项 */
  compatNotes: string[];
  /** 主流路由系统步骤 */
  guides: RouterGuide[];
}

/* ------------------------------------------------------------------ */
/* DNS 拓扑说明                                                        */
/* ------------------------------------------------------------------ */

export function buildDnsGuide(options: GenerateOptions): DnsGuide {
  const isGateway = options.device !== 'client';
  const coreName = options.core === 'mihomo' ? 'mihomo' : 'sing-box';

  const listen =
    options.core === 'mihomo'
      ? isGateway
        ? '0.0.0.0:1053（对局域网开放，上游可把 53 转发/重定向到该端口）'
        : '127.0.0.1:1053（仅本机使用）'
      : '无独立监听端口，DNS 查询经 TUN / 透明代理入站后由 hijack-dns 规则接管';

  const hijack = options.enableTun
    ? 'TUN 模式自动劫持 53 端口（mihomo dns-hijack / sing-box hijack-dns）：凡是经过代理设备的 53 端口查询都会被交给内核 DNS，无需上游做端口转换。'
    : `透明代理模式（tproxy/redir）：${options.core === 'mihomo' ? '内核在 1053 端口提供 DNS 服务，需要上游路由器把全网 53 端口重定向到该端口（见下方各系统步骤）。' : 'sing-box 没有独立 DNS 监听，网关模式下客户端的网关与 DNS 必须都指向代理设备，由透明代理入站接管。'}`;

  const compatNotes: string[] = [
    `Fake-IP 网段 198.18.0.0/15 由内核直接接管，主路由不要对该网段做 NAT、静态路由或 DNS 缓存改写；dnsmasq 等转发器可原样转发 Fake-IP 应答，无副作用。`,
    '所有 53 端口的劫持/重定向规则必须豁免代理设备自身 IP，否则 DNS 查询会在内核与上游之间形成回环。',
    '不要在代理设备的 DNS 链路里再插入公共 DNS（如把 dnsmasq 上游改成 223.5.5.5），那会绕过内核分流，导致污染与分流失效。',
    '若主路由通过 IPv6 RA 下发了 IPv6 DNS，客户端可能绕过 IPv4 劫持：建议关闭 RA 中的 RDNSS，或对 IPv6 的 53 端口做同样处理。',
    'Fake-IP 下，nslookup 国外域名返回 198.18.x.x 属正常现象；用「真实连接」而非「解析结果」判断是否劫持成功。',
  ];

  const guides: RouterGuide[] = [];
  if (isGateway) {
    guides.push(guideOpenWrtMain(options), guideOpenWrtSidecar(options), guideMerlin(options), guideGeneric(options));
  }
  return {
    mode: `${coreName} · ${options.enableTun ? 'TUN 接管' : '透明代理（tproxy/redir）'} · ${options.fakeIp ? 'Fake-IP DNS' : 'redir-host DNS'}`,
    listen,
    hijack,
    upstream: { direct: options.dnsDirect, remote: options.dnsRemote },
    fakeIp: options.fakeIp
      ? `198.18.0.0/15 · 过滤模式 ${options.fakeIpFilterMode === 'blacklist' ? 'blacklist（国内域名返回真实 IP）' : 'whitelist（仅列表内域名返回真实 IP）'}`
      : '未启用（redir-host 模式，解析后按 IP 分流）',
    compatNotes,
    guides,
  };
}

/* ------------------------------------------------------------------ */
/* 各路由系统步骤                                                      */
/* ------------------------------------------------------------------ */

function guideOpenWrtMain(options: GenerateOptions): RouterGuide {
  const gateway = effectiveIp(options);
  return {
    id: 'openwrt-main',
    name: 'OpenWrt / iStoreOS（内核跑在主路由上）',
    summary: '推荐让 dnsmasq 继续监听 53，把上游转发给内核 DNS：兼容性最好，客户端无感知。',
    steps: [
      '确认内核已在路由器上启动，DNS 监听 0.0.0.0:1053（本工具生成的 mihomo 配置已内置）。',
      '把 dnsmasq 的上游改为内核 DNS（127.0.0.1#1053）并关闭 resolv 文件，避免 dnsmasq 直接问运营商 DNS。',
      '重启 dnsmasq 后，客户端的 DNS 仍是路由器地址，查询会自动进入内核分流。',
      '（可选，TUN 模式下更彻底）用防火墙把 LAN 侧 53 端口重定向到 1053，防客户端手动改 DNS 绕过。',
      '验证：客户端 nslookup 国外域名返回 198.18.x.x 即 Fake-IP 生效。',
    ],
    commands: [
      {
        title: 'SSH：dnsmasq 上游指向内核 DNS',
        lang: 'bash',
        content: [
          'uci set dhcp.@dnsmasq[0].noresolv="1"',
          'uci del_list dhcp.@dnsmasq[0].server="114.114.114.114" 2>/dev/null',
          'uci add_list dhcp.@dnsmasq[0].server="127.0.0.1#1053"',
          'uci commit dhcp',
          '/etc/init.d/dnsmasq restart',
        ].join('\n'),
      },
    ],
    notes: [
      'iStoreOS 是 OpenWrt 的发行版，同样适用；也可以在「网络 → DHCP/DNS → 常规设置」里把 DNS 转发填为 127.0.0.1#1053。',
      '如果内核开着 TUN（dns-hijack），dnsmasq 自己发往上游 127.0.0.1#1053 的查询是本机流量，不会被 TUN 二次劫持，放心使用。',
      `如果代理内核不在本机而是旁挂设备（${gateway}），请改用「旁路由」那份步骤。`,
    ],
  };
}

function guideOpenWrtSidecar(options: GenerateOptions): RouterGuide {
  const gateway = effectiveIp(options);
  return {
    id: 'openwrt-sidecar',
    name: 'OpenWrt / iStoreOS（内核跑在旁路由上）',
    summary: '主路由只负责拨号与 DHCP，把 DNS（网关模式再连同网关）指向旁路由。',
    steps: [
      `旁路由（${gateway}）上启动内核，确认配置为本工具生成的网关形态（Allow-LAN、监听 0.0.0.0）。`,
      '主路由 DHCP 里把 DNS 下发为旁路由 IP；旁路由自身 IP 要在主路由上做好豁免，避免劫持回环。',
      '旁路由是 OpenWrt 时：若它自己的 dnsmasq 占用了 53 端口，同样用「上游转发到 127.0.0.1#1053」或直接停用它的 dnsmasq DNS（内核 TUN 劫持已覆盖）。',
      '网关模式（推荐，sing-box 必须）：主路由 DHCP 把网关也下发给旁路由，或逐台客户端把网关改到旁路由。',
      '仅 DNS 模式（仅 mihomo）：主路由防火墙把全网 53 转发到 旁路由IP:1053，网关保持主路由。sing-box 无独立 DNS 监听，不支持此模式。',
      '旁路由必须在主路由同网段且能直连外网；建议旁路由网关仍指向主路由、DNS 指向自己（内核自行分流）。',
    ],
    notes: [
      'LAN 互访、打印机等本地服务依赖「局域网直连」规则（本工具默认开启 bypassLan），无需在主路由上额外放行。',
    ],
  };
}

function guideMerlin(options: GenerateOptions): RouterGuide {
  const gateway = effectiveIp(options);
  return {
    id: 'merlin',
    name: '华硕梅林（Asuswrt-Merlin）',
    summary: '梅林自带 dnsmasq，可直接把上游指向本机内核，或把 DHCP DNS 指向旁路由。',
    steps: [
      '内核跑在梅林本体（Entware/插件方式）：开启「系统信息 → 服务 → 自定义 dnsmasq 配置」，把上游指向 127.0.0.1#1053。',
      '用 /jffs/scripts/dnsmasq.postconf 追加转发行，重启后对所有客户端生效。',
      '内核跑在旁挂设备：管理页面「内部网络(LAN) → DHCP 服务器」把「DNS Server 1」填为旁路由 IP（网关模式再把网关一并指向旁路由，或逐台客户端设置）。',
      '在「外部网络(WAN) → 互联网连接」确认「WAN DNS」没有被运营商 DNS 自动覆盖（关闭「自动获取 DNS」）。',
      '验证：连接到梅林的客户端 nslookup 国外域名应返回 198.18.x.x。',
    ],
    commands: [
      {
        title: 'SSH：dnsmasq.postconf 转发到内核 DNS',
        lang: 'bash',
        content: [
          'cat >> /jffs/scripts/dnsmasq.postconf <<\'EOF\'',
          'server=/#/127.0.0.1#1053',
          'no-resolv',
          'EOF',
          'chmod +x /jffs/scripts/dnsmasq.postconf',
          'service restart_dnsmasq',
        ].join('\n'),
      },
    ],
    notes: [`旁挂设备 IP 以 ${gateway} 为例，请替换为实际地址。`],
  };
}

function guideGeneric(options: GenerateOptions): RouterGuide {
  const gateway = effectiveIp(options);
  return {
    id: 'generic',
    name: '通用方法（任意路由系统）',
    summary: '不改路由系统也能部署：把客户端的 DNS（网关模式再连同网关）指到代理设备即可。',
    steps: [
      `在主路由的 DHCP 设置里，把 DNS 服务器改为代理设备 IP（${gateway}）；mihomo 可再用防火墙把 53 强转到 1053，防客户端绕过。`,
      '客户端数量少时，直接在每台设备上手动设置 DNS（网关模式再改网关）最快。',
      '修改后让客户端重连 WiFi 或续租 DHCP 生效。',
      '用 nslookup 验证国外域名返回 198.18.x.x、国内域名返回真实 IP。',
    ],
    notes: ['运营商光猫桥接 + 主路由拨号时，光猫的 DNS 不会影响已手动设置的客户端。'],
  };
}

/* ------------------------------------------------------------------ */
/* RouterOS 配置生成                                                   */
/* ------------------------------------------------------------------ */

export interface RouterOsResult {
  filename: string;
  content: string;
  warnings: string[];
}

/**
 * RouterOS 网络参数（引导式表单收集）
 * 代理设备 IP 存在 GenerateOptions.gatewayIp（与 DNS 指南共用）。
 */
export interface RouterOsProfile {
  /**
   * 内核运行位置：
   *  - sidecar：独立旁路由/设备跑 mihomo / sing-box（RouterOS 做转发与 DHCP 调整）
   *  - onRouter：内核跑在 RouterOS 本机（v7 container 容器），DNS 劫持到本机 1053
   */
  topology: 'sidecar' | 'onRouter';
  /** LAN 网段，如 192.168.88.0/24 */
  lanSubnet: string;
  /** 主路由（RouterOS）自身 IP */
  routerIp: string;
  /** LAN 桥/接口名（全量模板用） */
  lanInterface: string;
  /** WAN 接入方式 */
  wanType: 'pppoe' | 'dhcp' | 'static';
  /** WAN 接口名（全量模板用） */
  wanInterface: string;
  /** PPPoE 账号（全量模板、wanType=pppoe 时使用） */
  pppoeUser: string;
  pppoePass: string;
  /** wanType=static 时的 WAN IP/掩码，如 10.0.0.2/24 */
  staticWan: string;
  /** DHCP 地址池，如 192.168.88.100-192.168.88.200（全量模板用） */
  dhcpPool: string;
  /**
   * DNS 接管策略（仅 mihomo 可选；sing-box 固定网关模式）：
   *  - hijack53：dst-nat 劫持全网 53 → 内核 1053，不改动 DHCP，对静态 DNS 客户端也生效
   *  - dhcpOnly：只把 DHCP 下发的 DNS 改为代理设备，侵入最小，但手动设 DNS 的客户端会绕过
   */
  dnsStrategy: 'hijack53' | 'dhcpOnly';
  /** 网关也指向代理设备（流量级接管；sing-box 恒为 true） */
  fullTakeover: boolean;
  /** 关闭 RouterOS 自身 DNS 服务（allow-remote-requests=no），避免缓存 Fake-IP */
  disableRouterDns: boolean;
}

export function defaultRouterOsProfile(): RouterOsProfile {
  return {
    topology: 'sidecar',
    lanSubnet: '192.168.88.0/24',
    routerIp: '192.168.88.1',
    lanInterface: 'bridge-lan',
    wanType: 'pppoe',
    wanInterface: 'pppoe-out1',
    pppoeUser: '',
    pppoePass: '',
    staticWan: '',
    dhcpPool: '192.168.88.100-192.168.88.200',
    dnsStrategy: 'hijack53',
    fullTakeover: false,
    disableRouterDns: true,
  };
}

/* --------------------------- 参数校验 --------------------------- */

export interface ProfileIssue {
  level: 'error' | 'warn';
  field: string;
  message: string;
}

const IPV4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

export function isValidIpv4(v: string): boolean {
  const m = v.match(IPV4);
  if (!m) return false;
  return m.slice(1).every((x) => Number(x) <= 255);
}

/** 解析 CIDR，返回 { network 数值, prefix }；不合法返回 null */
function parseCidr(cidr: string): { net: number; bits: number } | null {
  const [ip, bitsStr] = cidr.split('/');
  const bits = Number(bitsStr);
  if (!isValidIpv4(ip || '') || !Number.isInteger(bits) || bits < 8 || bits > 32) return null;
  const [a, b, c, d] = (ip || '').split('.').map(Number);
  const addr = ((a << 24) | (b << 16) | (c << 8) | d) >>> 0;
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return { net: (addr & mask) >>> 0, bits };
}

function ipToInt(ip: string): number | null {
  if (!isValidIpv4(ip)) return null;
  const [a, b, c, d] = ip.split('.').map(Number);
  return ((a << 24) | (b << 16) | (c << 8) | d) >>> 0;
}

function ipInCidr(ip: string, cidr: string): boolean {
  const p = parseCidr(cidr);
  const n = ipToInt(ip);
  if (!p || n === null) return false;
  const mask = p.bits === 0 ? 0 : (0xffffffff << (32 - p.bits)) >>> 0;
  return ((n & mask) >>> 0) === p.net;
}

/** 校验引导表单：errors 会阻止下载，warns 仅提示 */
export function validateProfile(
  options: GenerateOptions,
  profile: RouterOsProfile,
  mode: 'incremental' | 'full',
): ProfileIssue[] {
  const issues: ProfileIssue[] = [];
  const onRouter = profile.topology === 'onRouter';
  // onRouter 时内核跑在本机，"代理设备" 就是主路由自身
  const proxyIp = onRouter ? profile.routerIp.trim() : options.gatewayIp.trim();
  const proxyField = onRouter ? 'routerIp' : 'proxyIp';

  if (!proxyIp) {
    issues.push({
      level: 'error',
      field: proxyField,
      message: onRouter ? '主路由 IP 必填：本机容器部署时 DNS 劫持目标就是它。' : '代理设备 IP 必填：脚本需要它做豁免与转发目标。',
    });
  } else if (!isValidIpv4(proxyIp)) {
    issues.push({ level: 'error', field: proxyField, message: 'IP 不是合法的 IPv4 地址。' });
  }

  if (!isValidIpv4(profile.routerIp)) {
    issues.push({ level: 'error', field: 'routerIp', message: '主路由 IP 不是合法的 IPv4 地址。' });
  }
  if (!parseCidr(profile.lanSubnet)) {
    issues.push({ level: 'error', field: 'lanSubnet', message: 'LAN 网段格式应为 a.b.c.d/掩码，如 192.168.88.0/24。' });
  }

  if (!onRouter && isValidIpv4(proxyIp) && isValidIpv4(profile.routerIp) && proxyIp === profile.routerIp) {
    issues.push({
      level: 'error',
      field: 'proxyIp',
      message: '代理设备 IP 与主路由 IP 相同：代理内核应跑在独立设备或容器里，否则 DNS 劫持会形成回环。若内核确实跑在 RouterOS 本机，请把「内核运行位置」切换为「RouterOS 本机（容器）」。',
    });
  }
  if (isValidIpv4(proxyIp) && parseCidr(profile.lanSubnet) && !ipInCidr(proxyIp, profile.lanSubnet)) {
    issues.push({
      level: 'error',
      field: proxyField,
      message: `代理设备 ${proxyIp} 不在 LAN 网段 ${profile.lanSubnet} 内，客户端将无法访问它。`,
    });
  }
  if (isValidIpv4(profile.routerIp) && parseCidr(profile.lanSubnet) && !ipInCidr(profile.routerIp, profile.lanSubnet)) {
    issues.push({ level: 'error', field: 'routerIp', message: `主路由 ${profile.routerIp} 不在 LAN 网段 ${profile.lanSubnet} 内。` });
  }

  // 本机容器部署：53 劫持必须限定 LAN 入接口，否则容器自身查询会回环
  if (onRouter && !profile.lanInterface.trim()) {
    issues.push({
      level: 'error',
      field: 'lanInterface',
      message: '本机容器部署需要填写 LAN 桥/接口名：53 劫持规则用它限定范围，否则容器自身的 DNS 查询会形成回环。',
    });
  }

  // DHCP 池与关键 IP 冲突检查
  const pool = profile.dhcpPool.trim();
  const poolMatch = pool.match(/^(\d{1,3}(?:\.\d{1,3}){3})-(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (mode === 'full') {
    if (!poolMatch) {
      issues.push({ level: 'error', field: 'dhcpPool', message: 'DHCP 地址池格式应为 起-止，如 192.168.88.100-192.168.88.200。' });
    } else if (parseCidr(profile.lanSubnet)) {
      for (const bound of [poolMatch[1], poolMatch[2]]) {
        if (!ipInCidr(bound, profile.lanSubnet)) {
          issues.push({ level: 'error', field: 'dhcpPool', message: `地址池边界 ${bound} 不在 LAN 网段内。` });
        }
      }
      if (isValidIpv4(proxyIp) && ipInCidr(proxyIp, profile.lanSubnet)) {
        const pn = ipToInt(proxyIp)!;
        const lo = ipToInt(poolMatch[1])!;
        const hi = ipToInt(poolMatch[2])!;
        if (pn >= lo && pn <= hi) {
          issues.push({
            level: 'warn',
            field: 'dhcpPool',
            message: onRouter
              ? `主路由 ${proxyIp} 落在 DHCP 地址池内：主路由 IP 一般固定在池外，请调整地址池避开它。`
              : `代理设备 ${proxyIp} 落在 DHCP 地址池内：请把它排除出池或在设备上做静态租约，否则重启后可能被别的设备占用其 IP。`,
          });
        }
      }
    }
    if (profile.wanType === 'pppoe' && !profile.pppoeUser.trim()) {
      issues.push({ level: 'warn', field: 'pppoeUser', message: 'PPPoE 账号未填写，脚本中保留了占位符「宽带账号」，导入前请修改。' });
    }
    if (profile.wanType === 'static' && !profile.staticWan.trim()) {
      issues.push({ level: 'error', field: 'staticWan', message: '静态 WAN 需要填写 IP/掩码，如 10.0.0.2/24。' });
    }
  }

  // 拓扑级提醒（sing-box 选 dhcpOnly 已在 UI 中静默强制为网关模式）
  if (onRouter && options.core === 'singbox') {
    issues.push({
      level: 'warn',
      field: 'topology',
      message:
        'sing-box 在 RouterOS 容器内跑需要 TUN（/dev/net/tun 透传），容器配置较复杂且 RouterOS 容器对 TUN 支持有限；建议 sing-box 用独立旁路由部署，或本机部署改用 mihomo。',
    });
  }
  if (!onRouter && profile.fullTakeover && options.core === 'mihomo' && options.enableTun === false) {
    issues.push({
      level: 'warn',
      field: 'fullTakeover',
      message: 'mihomo 未开 TUN 时走 tproxy/redir，网关模式下客户端 TCP 可被承接，但 UDP（游戏、QUIC）在 redir 下不可用；建议开启 TUN。',
    });
  }
  return issues;
}

/** 使用的代理设备 IP；未填时给出示例 IP 并提示替换 */
function effectiveIp(options: GenerateOptions): string {
  const v = options.gatewayIp.trim();
  return v || '192.168.88.2';
}

/** 53 端口劫持 + DHCP 调整 + 可选看护（增量与全量共用；区分旁路由 / 本机容器两种拓扑） */
function routerOsProxyBlock(options: GenerateOptions, profile: RouterOsProfile): { lines: string[]; warnings: string[] } {
  const onRouter = profile.topology === 'onRouter';
  const ip = onRouter ? profile.routerIp || '192.168.88.1' : effectiveIp(options);
  const warnings: string[] = [];
  if (!onRouter && !options.gatewayIp.trim()) {
    warnings.push('未填写代理设备 IP，脚本中使用了示例地址 192.168.88.2，导入前请全局替换为实际 IP。');
  }
  const coreName = options.core === 'mihomo' ? 'mihomo' : 'sing-box';
  const lines: string[] = [];

  // 网关模式：客户端网关指向代理设备。onRouter 时网关本来就是主路由，无此概念。
  const gatewayMode = !onRouter && (options.core === 'singbox' || profile.fullTakeover);
  const dnsOnly = !onRouter && options.core === 'mihomo' && !profile.fullTakeover && profile.dnsStrategy === 'dhcpOnly';
  // DNS 劫持（dst-nat 53）：mihomo 两种拓扑都可用；onRouter 时必须限定 LAN 入接口防容器回环
  const hijack = options.core === 'mihomo' && (onRouter || !dnsOnly);

  lines.push('# ---------- ProxyForge：代理接入（与代理配置相容） ----------');
  lines.push(
    `# 拓扑：RouterOS 主路由 + ${onRouter ? `${coreName} 跑在本机 v7 容器（DNS 劫持到本机 1053）` : `${ip} 上运行的 ${coreName}`}`,
  );
  lines.push(
    `# DNS 相容性：${
      onRouter
        ? '客户端 53 查询经 dst-nat 重定向到主路由自身 1053 端口的内核 DNS（规则限定 LAN 入接口，容器自身查询不会回环）'
        : options.core === 'mihomo'
          ? gatewayMode
            ? 'mihomo 在旁路由 1053 端口提供 DNS 服务，客户端 53 查询被 dst-nat 重定向到它'
            : 'mihomo 在旁路由 1053 端口提供 DNS 服务'
          : 'sing-box 没有独立 DNS 监听，DNS 由 TUN/透明代理入站的 hijack-dns 规则接管，因此必须把客户端网关一并指向旁路由'
    }`,
  );

  // 1) 豁免列表（防回环）
  lines.push('');
  lines.push('/ip firewall address-list');
  if (!onRouter) {
    lines.push(`add list=proxyforge-bypass address=${ip} comment="ProxyForge: proxy device self bypass"`);
  }
  // 豁免 Fake-IP 网段被误处理（仅提示性，RouterOS 默认不会路由该网段，交给网关）
  lines.push('add list=proxyforge-bypass address=198.18.0.0/15 comment="ProxyForge: fake-ip range (handled by proxy gateway)"');
  if (onRouter) {
    lines.push('');
    lines.push('# 本机容器部署的回环防护：53 劫持规则用 in-interface 限定 LAN 桥，');
    lines.push(`# 容器（veth 接口）发出的查询不会命中 dst-nat。请确认下方接口名 "${profile.lanInterface}" 是实际 LAN 桥名。`);
  }

  // 2) DNS 接管
  if (hijack) {
    const inIf = onRouter ? `in-interface=${profile.lanInterface} ` : '';
    lines.push('');
    lines.push(
      onRouter
        ? `# 劫持 LAN 侧 53 端口到本机内核 DNS（in-interface=${profile.lanInterface} 防容器回环）`
        : '# 劫持全网 53 端口到内核 DNS（豁免代理设备自身，防回环）',
    );
    lines.push('/ip firewall nat');
    lines.push(
      `add chain=dstnat ${inIf}protocol=udp dst-port=53 src-address-list=!proxyforge-bypass dst-address=!${ip} action=dst-nat to-addresses=${ip} to-ports=1053 comment="ProxyForge: DNS hijack -> core DNS" place-before=0`,
    );
    lines.push(
      `add chain=dstnat ${inIf}protocol=tcp dst-port=53 src-address-list=!proxyforge-bypass dst-address=!${ip} action=dst-nat to-addresses=${ip} to-ports=1053 comment="ProxyForge: DNS(TCP) hijack" place-before=1`,
    );
  } else if (dnsOnly) {
    lines.push('');
    lines.push('# 已选「仅 DHCP 下发 DNS」：不劫持 53 端口（侵入最小）。');
    lines.push('# 注意：客户端手动设置了 DNS（如 8.8.8.8）会绕过内核分流，如需强制接管请改用劫持模式。');
  } else if (options.core === 'singbox') {
    lines.push('');
    if (onRouter) {
      lines.push('# sing-box 跑在 RouterOS 容器内时，客户端 53 查询终止于 RouterOS 自身，容器 TUN 无法接管；');
      lines.push('# 需要内核额外提供 53 端口 DNS 入站。本工具生成的 sing-box 配置不含该入站，强烈建议：');
      lines.push('# 改用独立旁路由部署 sing-box，或本机部署改用 mihomo。');
      warnings.push('sing-box + RouterOS 本机容器拓扑无法可靠接管 DNS（无独立 DNS 监听 + 容器 TUN 受限），建议改用 mihomo 或独立旁路由。');
    } else {
      lines.push('# sing-box 必须使用网关模式：客户端网关与 DNS 都指向代理设备，');
      lines.push('# 53 端口查询随流量进入 TUN/tproxy 后由 hijack-dns 规则自动接管。');
      if (!options.enableTun) {
        warnings.push(
          'sing-box 未开启 TUN（tproxy/redir 模式）：RouterOS 不支持 TPROXY，无法只靠 RouterOS 完成 DNS 劫持，强烈建议开启 TUN。',
        );
        lines.push('# 注意：当前代理配置未开 TUN，RouterOS 无法做 TPROXY 转发；');
        lines.push('# 请在代理配置里开启 TUN 后重新生成本脚本，或在代理设备上用 Linux 防火墙自行处理。');
      }
    }
  }

  // 3) DHCP 下发
  lines.push('');
  lines.push('# DHCP：按网段精确匹配（多 DHCP 网络不会被误改）');
  lines.push('/ip dhcp-server network');
  if (gatewayMode) {
    lines.push(':if ([:len [find address="' + profile.lanSubnet + '"]] > 0) do={');
    lines.push(`  set [find address="${profile.lanSubnet}"] gateway=${ip} dns-server=${ip}`);
    lines.push('} else={');
    lines.push(`  add address=${profile.lanSubnet} gateway=${ip} dns-server=${ip} comment="ProxyForge: via proxy gateway"`);
    lines.push('}');
  } else if (dnsOnly) {
    lines.push(':if ([:len [find address="' + profile.lanSubnet + '"]] > 0) do={');
    lines.push(`  set [find address="${profile.lanSubnet}"] dns-server=${ip}`);
    lines.push('} else={');
    lines.push(`  add address=${profile.lanSubnet} gateway=${profile.routerIp} dns-server=${ip} comment="ProxyForge: dns only"`);
    lines.push('}');
  } else {
    // 劫持模式 / 本机容器：DNS 由劫持保证，DHCP 无需改动
    lines.push(
      onRouter
        ? '# 本机容器 + 劫持模式下 DHCP 无需改动：客户端网关本来就是主路由，53 查询会被重定向。'
        : '# 劫持模式下 DHCP 无需改动：无论客户端拿到什么 DNS，53 端口都会被重定向。',
    );
  }

  // 4) 可选看护：代理设备离线时自动停用劫持，恢复时启用（网关模式无法自动恢复网关，仅提示）
  if (!gatewayMode && !onRouter) {
    lines.push('');
    lines.push('# 可选：代理设备离线看护（取消注释启用；离线自动停用劫持规则，恢复后重新启用，避免全网断网）');
    lines.push(`# /tool netwatch add host=${ip} interval=30s \\`);
    lines.push(`#   down-script="/ip firewall nat set [find comment~\\"ProxyForge: DNS\\"] disabled=yes" \\`);
    lines.push(`#   up-script="/ip firewall nat set [find comment~\\"ProxyForge: DNS\\"] disabled=no"`);
  } else if (gatewayMode) {
    lines.push('');
    lines.push('# 注意：网关模式下代理设备离线 = 全网上不了外网。建议在代理设备上配置 systemd 开机自启与崩溃自动拉起，');
    lines.push('# 或准备回滚：把下方 DHCP 的 gateway/dns 改回主路由 ' + profile.routerIp + ' 即可恢复。');
  } else if (onRouter) {
    lines.push('');
    lines.push('# 注意：内核跑在本机时，容器崩溃会影响 DNS/分流。建议给容器配置 RouterOS 启动时自动运行，');
    lines.push('# 并保留回滚命令（见下）：删掉劫持规则即恢复原始解析。');
  }

  if (profile.disableRouterDns) {
    lines.push('');
    lines.push('# 关闭 RouterOS 自身 DNS 服务，避免缓存 Fake-IP 或与劫持冲突');
    lines.push('/ip dns set allow-remote-requests=no');
  } else if (options.fakeIp) {
    lines.push('');
    lines.push('# 提醒：RouterOS 自身 DNS 服务（allow-remote-requests）仍开启，Fake-IP 可能进入其缓存；');
    lines.push('# 若出现「部分域名在重启路由后失效」，执行 /ip dns cache flush 或关闭该服务。');
  }

  lines.push('');
  lines.push('# 校验：客户端 nslookup baidu.com 应返回真实 IP；');
  lines.push('# nslookup google.com 返回 198.18.x.x 属 Fake-IP 正常现象。');
  lines.push(`# 若需回滚：/ip firewall nat remove [find comment~"ProxyForge"]；/ip firewall address-list remove [find list=proxyforge-bypass]`);
  return { lines, warnings };
}

export function buildRouterOsScript(
  options: GenerateOptions,
  mode: 'incremental' | 'full',
  profile: RouterOsProfile = defaultRouterOsProfile(),
): RouterOsResult {
  const onRouter = profile.topology === 'onRouter';
  const ip = onRouter ? profile.routerIp || '192.168.88.1' : effectiveIp(options);
  const coreName = options.core === 'mihomo' ? 'mihomo' : 'sing-box';
  const gatewayMode = !onRouter && (options.core === 'singbox' || profile.fullTakeover);
  const warnings: string[] = [];
  const header: string[] = [
    '# ============================================================',
    `# ProxyForge · RouterOS ${mode === 'incremental' ? '增量配置（在现有配置上追加）' : '全量配置模板'}`,
    `# 拓扑：${onRouter ? '内核跑在 RouterOS 本机（v7 容器）' : '内核跑在独立旁路由'} · 目标内核 ${coreName} · 代理设备 ${ip}`,
    `# LAN：${profile.lanSubnet}${onRouter ? ` · 劫持范围限定 in-interface=${profile.lanInterface}` : ''}`,
    `# DNS 模式：${onRouter ? '53 劫持到本机 1053（DHCP 不动）' : options.core === 'singbox' ? '网关模式（sing-box 必选）' : gatewayMode ? '网关 + 53 劫持' : profile.dnsStrategy === 'hijack53' ? '53 劫持（不改 DHCP）' : '仅 DHCP 下发 DNS'}`,
    `# 生成时间：${new Date().toLocaleString('zh-CN')}`,
    '# ============================================================',
  ];

  if (mode === 'incremental') {
    const { lines, warnings: w } = routerOsProxyBlock(options, profile);
    warnings.push(...w);
    lines.unshift(...header);
    return { filename: 'proxyforge-routeros-incremental.rsc', content: lines.join('\n') + '\n', warnings };
  }

  // 全量模板：基础网络 + 代理接入
  const { lines: proxyLines, warnings: w } = routerOsProxyBlock(options, profile);
  warnings.push(...w);
  warnings.push('全量模板按引导表单生成，导入前请再核对 WAN 账号与网段；建议先在测试设备上演练。');
  warnings.push('导入会新增配置项，建议在新设备或恢复出厂后的设备上使用，并配合 Safe Mode（终端 Ctrl-X）操作。');

  const lines: string[] = [...header];
  lines.push('');
  lines.push('# ---------------- 1. 基础网络（按引导表单生成） ----------------');
  if (profile.wanType === 'pppoe') {
    lines.push(`# WAN：${profile.wanInterface} PPPoE 拨号`);
    lines.push('');
    lines.push('/interface pppoe-client');
    lines.push(
      `add name=${profile.wanInterface} interface=ether1 user="${profile.pppoeUser.trim() || '宽带账号'}" password="${profile.pppoePass || '宽带密码'}" \\`,
    );
    lines.push('    add-default-route=yes use-peer-dns=no disabled=no');
  } else if (profile.wanType === 'dhcp') {
    lines.push(`# WAN：${profile.wanInterface} DHCP 自动获取（上层光猫/网关分配）`);
    lines.push('');
    lines.push('/ip dhcp-client');
    lines.push(`add interface=ether1 disabled=no comment="ProxyForge: WAN dhcp"`);
  } else {
    lines.push(`# WAN：${profile.wanInterface} 静态 IP ${profile.staticWan}`);
    lines.push('');
    lines.push('/ip address');
    lines.push(`add address=${profile.staticWan || '10.0.0.2/24'} interface=ether1`);
    lines.push('/ip route');
    lines.push(`add dst-address=0.0.0.0/0 gateway=\${wan-gateway} comment="ProxyForge: default route"`);
    lines.push('# 静态 WAN 请把 ${wan-gateway} 替换为运营商网关地址');
  }
  lines.push('/interface bridge');
  lines.push(`add name=${profile.lanInterface} protocol-mode=rstp`);
  lines.push('/interface bridge port');
  lines.push(`add bridge=${profile.lanInterface} interface=ether2`);
  lines.push('/ip address');
  lines.push(`add address=${profile.routerIp}/${profile.lanSubnet.split('/')[1] || '24'} interface=${profile.lanInterface}`);
  lines.push('/ip pool');
  lines.push(`add name=proxyforge-pool ranges=${profile.dhcpPool}`);
  lines.push('/ip dhcp-server');
  lines.push(`add name=proxyforge-dhcp interface=${profile.lanInterface} address-pool=proxyforge-pool disabled=no`);
  lines.push('/ip dhcp-server network');
  const gwLine = gatewayMode ? ip : profile.routerIp;
  lines.push(`add address=${profile.lanSubnet} gateway=${gwLine} dns-server=${ip} comment="ProxyForge: DNS -> proxy device"`);
  lines.push('/ip firewall nat');
  lines.push(`add chain=srcnat out-interface=${profile.wanInterface} action=masquerade comment="ProxyForge: WAN NAT"`);
  lines.push('');
  lines.push('# ---------------- 2. ProxyForge 代理接入 ----------------');
  lines.push(...proxyLines);
  lines.push('');
  lines.push('# 导入方法：把本文件上传到 RouterOS（Files），然后在终端执行（建议先按 Ctrl-X 进入 Safe Mode）：');
  lines.push(`# /import file=proxyforge-routeros-full.rsc`);
  return { filename: 'proxyforge-routeros-full.rsc', content: lines.join('\n') + '\n', warnings };
}

/* ------------------------------------------------------------------ */
/* 上线前检查清单（防断网 / 防不相容）                                   */
/* ------------------------------------------------------------------ */

export interface ChecklistItem {
  level: 'must' | 'should' | 'info';
  title: string;
  detail: string;
}

export function preFlightChecklist(options: GenerateOptions, profile: RouterOsProfile): ChecklistItem[] {
  const gatewayMode = options.core === 'singbox' || profile.fullTakeover;
  const items: ChecklistItem[] = [
    {
      level: 'must',
      title: '在 Safe Mode 下应用配置',
      detail: '终端里先按 Ctrl-X 进入 Safe Mode 再粘贴/导入脚本：一旦 3 分钟内失去连接（比如把自己踢下线），配置会自动回滚。这是防「改完路由器进不去」的第一保命符。',
    },
    {
      level: 'must',
      title: '先备份再动手',
      detail: '执行 /export hide-sensitive file=before-proxyforge 导出当前配置、/system backup save name=before-proxyforge 做二制备份。出问题时 /import 恢复或回滚命令见脚本尾部注释。',
    },
    {
      level: 'must',
      title: '确认豁免列表包含代理设备自身',
      detail: '53 端口劫持规则必须排除代理设备 IP（脚本已内置 proxyforge-bypass 地址列表）。若你在代理设备上又指了网关到主路由，缺了这条会形成 DNS 死循环，全网解析失败。',
    },
  ];

  if (gatewayMode) {
    items.push({
      level: 'must',
      title: '网关模式下代理设备必须高可用',
      detail: '所有客户端的网关都指向代理设备：它一离线，全网断外网。请给内核配置开机自启（systemd / OpenWrt init）与崩溃自动重启；临时恢复方法是把 DHCP 网关改回主路由。',
    });
  }
  if (profile.topology === 'onRouter') {
    items.push(
      {
        level: 'must',
        title: '确认 RouterOS 容器环境可用',
        detail: '本机部署需要 RouterOS v7 + container 软件包：先在 /system/device-mode update container=yes 开启容器模式（需重启或按 reset 键确认），再建 veth 接口挂给容器。架构需为 arm/arm64/x86_64。',
      },
      {
        level: 'should',
        title: '内核监听与容器回环',
        detail: '容器内的 mihomo 要监听 0.0.0.0:1053（本工具生成的配置已内置）；53 劫持规则用 in-interface 限定 LAN 桥，容器自身（veth）的查询不会命中规则，因此不会回环。LAN 桥名填错时劫持会静默失效——导入后务必用 nslookup 验证。',
      },
      {
        level: 'info',
        title: '容器 TUN 的限制',
        detail: '容器内开 TUN 需要 /dev/net/tun 透传，RouterOS 对此支持有限；本机部署建议 mihomo + TPROXY 或仅 DNS 劫持模式。sing-box 建议放独立旁路由跑。',
      },
    );
  }
  if (options.core === 'mihomo' && !profile.fullTakeover && profile.dnsStrategy === 'dhcpOnly') {
    items.push({
      level: 'should',
      title: '「仅 DHCP 下发 DNS」的盲区',
      detail: '手动设置了 DNS 的客户端（写死 8.8.8.8 等）不会被接管。想强制覆盖所有设备，改用「53 劫持」策略即可，无需动客户端。',
    });
  }
  items.push(
    {
      level: 'should',
      title: '静态 IP 客户端单独处理',
      detail: 'DHCP 修改只影响自动获取的设备。网关模式下请把静态设备的网关/DNS 也指向代理设备；劫持模式下静态设备会被 53 劫持自动覆盖 DNS，但网关仍需在网关模式时手动改。',
    },
    {
      level: 'should',
      title: 'IPv6 旁路',
      detail: '若路由器通过 RA 下发 IPv6 DNS，双栈客户端可能优先走 IPv6 解析而绕过接管：关闭 RA 的 RDNSS，或让代理配置覆盖 IPv6（本工具默认关闭 IPv6）。',
    },
    {
      level: 'should',
      title: '避免双重 NAT 叠加',
      detail: '光猫是路由模式时，主路由 WAN 是私网地址：DNS 劫持仍有效，但端口回源、游戏联机会受影响。有条件把光猫改桥接、主路由拨号。',
    },
    {
      level: 'info',
      title: '应用后先验证再扩散',
      detail: '先用一台设备改 DNS/网关验证：nslookup 国外域名返回 198.18.x.x（Fake-IP 正常）、国内域名返回真实 IP、直连网段互访正常，然后再改 DHCP 全网生效。',
    },
    {
      level: 'info',
      title: '客户端缓存刷新',
      detail: '切换 DNS 方案后，客户端可能缓存了旧解析或 Fake-IP：重连 WiFi / ipconfig flushdns 后再判断。RouterOS 侧执行 /ip dns cache flush。',
    },
  );
  if (options.fakeIp && !options.enableTun) {
    items.push({
      level: 'info',
      title: 'Fake-IP 与主路由缓存',
      detail: '透明代理模式下若 RouterOS 自身 DNS 服务开着（allow-remote-requests=yes），Fake-IP 可能被它缓存并在内核离线后无法恢复——脚本中已按你的选择关闭该服务或附上清理命令。',
    });
  }
  return items;
}
