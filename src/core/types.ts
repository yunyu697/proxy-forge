/**
 * 统一的代理节点数据模型
 *
 * 设计原则：所有协议（无论来自分享链接、订阅还是手动输入）都归一化为 ProxyNode，
 * 再由 builders 分别翻译成 mihomo / sing-box 的方言。
 */

export type ProxyType =
  | 'shadowsocks'
  | 'shadowsocksr'
  | 'vmess'
  | 'vless'
  | 'trojan'
  | 'hysteria'
  | 'hysteria2'
  | 'tuic'
  | 'anytls'
  | 'wireguard'
  | 'http'
  | 'socks';

export const PROXY_TYPE_LABELS: Record<ProxyType, string> = {
  shadowsocks: 'Shadowsocks',
  shadowsocksr: 'ShadowsocksR',
  vmess: 'VMess',
  vless: 'VLESS',
  trojan: 'Trojan',
  hysteria: 'Hysteria',
  hysteria2: 'Hysteria 2',
  tuic: 'TUIC v5',
  anytls: 'AnyTLS',
  wireguard: 'WireGuard',
  http: 'HTTP / HTTPS',
  socks: 'SOCKS5',
};

/** 每种协议必需的字段，用于引导式表单校验 */
export const REQUIRED_FIELDS: Record<ProxyType, (keyof ProxyNode)[]> = {
  shadowsocks: ['server', 'port', 'cipher', 'password'],
  shadowsocksr: ['server', 'port', 'cipher', 'password', 'ssrProtocol', 'ssrObfs'],
  vmess: ['server', 'port', 'uuid'],
  vless: ['server', 'port', 'uuid'],
  trojan: ['server', 'port', 'password'],
  hysteria: ['server', 'port'],
  hysteria2: ['server', 'port', 'password'],
  tuic: ['server', 'port', 'uuid', 'password'],
  anytls: ['server', 'port', 'password'],
  wireguard: ['server', 'port', 'wgPrivateKey', 'wgPeerPublicKey', 'wgLocalAddress'],
  http: ['server', 'port'],
  socks: ['server', 'port'],
};

export interface ProxyNode {
  id: string;
  type: ProxyType;
  /** 节点名称（mihomo 的 name / sing-box 的 tag） */
  name: string;
  server: string;
  port: number;
  enabled: boolean;
  udp: boolean;
  /** 用户手动分组，空则按国家/来源自动归入默认组 */
  group?: string;

  /* ---------- Shadowsocks / SSR ---------- */
  cipher?: string;
  password?: string;
  /** simple-obfs / v2ray-plugin 插件名 */
  plugin?: string;
  pluginOpts?: Record<string, string>;
  ssrProtocol?: string;
  ssrObfs?: string;
  ssrProtocolParam?: string;
  ssrObfsParam?: string;

  /* ---------- VMess / VLESS / TUIC / Trojan / AnyTLS / Hysteria2 ---------- */
  uuid?: string;
  alterId?: number;
  /** VMess 加密方式：auto / none / aes-128-gcm / chacha20-poly1305 / zero */
  vmessSecurity?: string;
  /** XTLS flow，如 xtls-rprx-vision */
  flow?: string;
  /** trojan / hysteria2 / anytls 复用 password */

  /* ---------- Hysteria 1 / 2 ---------- */
  /** hysteria v1 认证字符串 */
  authStr?: string;
  /** hysteria2 的 obfs 混淆密码 */
  obfsPassword?: string;
  /** 带宽，如 "100 Mbps" 或纯数字 Mbps */
  up?: string;
  down?: string;
  /** 端口跳跃，如 10000-20000 或 1000,2000 */
  hopPorts?: string;

  /* ---------- TUIC ---------- */
  congestion?: string;
  udpRelayMode?: string;
  disableSni?: boolean;
  reduceRtt?: boolean;
  zeroRtt?: boolean;
  heartbeat?: number;

  /* ---------- WireGuard ---------- */
  wgLocalAddress?: string;
  wgPrivateKey?: string;
  wgPeerPublicKey?: string;
  wgPreSharedKey?: string;
  wgReserved?: string;
  wgMtu?: number;

  /* ---------- HTTP / SOCKS ---------- */
  username?: string;

  /* ---------- 传输层 ---------- */
  network?: '' | 'tcp' | 'ws' | 'grpc' | 'h2' | 'httpupgrade' | 'quic';
  wsPath?: string;
  wsHeaders?: Record<string, string>;
  grpcServiceName?: string;
  h2Path?: string;
  h2Host?: string;
  /** VMess/VLESS 分包编码：xudp / packetaddr */
  packetEncoding?: string;

  /* ---------- TLS ---------- */
  tls: boolean;
  sni?: string;
  alpn?: string[];
  skipCertVerify?: boolean;
  /** uTLS 指纹（mihomo client-fingerprint / sing-box utls） */
  fingerprint?: string;
  realityPublicKey?: string;
  realityShortId?: string;

  /* ---------- 元信息 ---------- */
  /** 原始链接，便于回溯 */
  raw?: string;
  /** 解析过程中的警告（例如不被目标内核支持的字段） */
  warnings?: string[];
  /** 测速延迟，ms */
  delay?: number;
  /** 节点所属国家/地区代码（可选，用于按地区分组） */
  region?: string;
}

let seq = 0;
export function newNodeId(): string {
  seq += 1;
  return `n_${Date.now().toString(36)}_${seq}`;
}

export function createEmptyNode(type: ProxyType): ProxyNode {
  const base: ProxyNode = {
    id: newNodeId(),
    type,
    name: `${PROXY_TYPE_LABELS[type]} 节点`,
    server: '',
    port: 443,
    enabled: true,
    udp: true,
    tls: type === 'trojan' || type === 'vless' || type === 'tuic' || type === 'hysteria2' || type === 'anytls',
  };
  switch (type) {
    case 'shadowsocks':
      return { ...base, port: 8388, cipher: 'chacha20-ietf-poly1305', tls: false };
    case 'shadowsocksr':
      return {
        ...base,
        port: 8388,
        cipher: 'chacha20-ietf-poly1305',
        ssrProtocol: 'auth_aes128_md5',
        ssrObfs: 'tls1.2_ticket_auth',
        tls: false,
      };
    case 'vmess':
      return { ...base, vmessSecurity: 'auto', alterId: 0, tls: false };
    case 'vless':
      return { ...base, tls: true, sni: '' };
    case 'trojan':
      return { ...base, tls: true };
    case 'hysteria':
      return { ...base, port: 443, tls: true, up: '100 Mbps', down: '100 Mbps' };
    case 'hysteria2':
      return { ...base, tls: true };
    case 'tuic':
      return { ...base, port: 443, tls: true, congestion: 'bbr' };
    case 'anytls':
      return { ...base, tls: true };
    case 'wireguard':
      return { ...base, port: 51820, tls: false, wgMtu: 1408, wgLocalAddress: '10.0.0.2/32' };
    case 'http':
      return { ...base, port: 8080, tls: false };
    case 'socks':
      return { ...base, port: 1080, tls: false };
    default:
      return base;
  }
}

export interface CustomRuleSet {
  id: string;
  name: string;
  url: string;
  /** 域名规则还是 IP 规则 */
  kind: 'domain' | 'ipcidr';
  /** 命中后的动作 */
  action: 'proxy' | 'direct' | 'reject';
  enabled: boolean;
}

/** 自定义单条规则支持的类型 */
export type CustomRuleType = 'DOMAIN-SUFFIX' | 'DOMAIN' | 'DOMAIN-KEYWORD' | 'IP-CIDR' | 'DST-PORT' | 'SRC-IP-CIDR';

export const CUSTOM_RULE_TYPE_META: Record<
  CustomRuleType,
  { label: string; hint: string; placeholder: string; isIp: boolean }
> = {
  'DOMAIN-SUFFIX': {
    label: '域名后缀',
    hint: '匹配该后缀的所有域名（含子域），最常用',
    placeholder: '例：example.com',
    isIp: false,
  },
  DOMAIN: { label: '完整域名', hint: '只精确匹配这一个域名', placeholder: '例：www.example.com', isIp: false },
  'DOMAIN-KEYWORD': { label: '域名关键词', hint: '域名中包含该关键词即命中', placeholder: '例：google', isIp: false },
  'IP-CIDR': {
    label: '目标 IP 段',
    hint: '按访问的目标 IP 匹配，建议勾选「局域网直连」防止误伤',
    placeholder: '例：192.168.1.0/24',
    isIp: true,
  },
  'DST-PORT': { label: '目标端口', hint: '按访问的目标端口匹配，如 8443', placeholder: '例：8443', isIp: false },
  'SRC-IP-CIDR': {
    label: '来源 IP 段',
    hint: '按发起连接的设备 IP 匹配，适合指定某台设备',
    placeholder: '例：192.168.1.100/32',
    isIp: true,
  },
};

export interface CustomRule {
  id: string;
  type: CustomRuleType;
  value: string;
  /** 命中后的动作 */
  target: 'proxy' | 'direct' | 'reject';
  enabled: boolean;
}

/* ==================================================================== */
/* 设备形态                                                             */
/* ==================================================================== */

export type DeviceProfile = 'client' | 'sidecar' | 'router';

export interface DeviceProfileMeta {
  id: DeviceProfile;
  title: string;
  subtitle: string;
  desc: string;
  icon: string;
}

export const DEVICE_PROFILES: DeviceProfileMeta[] = [
  {
    id: 'client',
    title: '客户端',
    subtitle: 'PC / 手机直连',
    desc: '软件装在使用设备上。开启 TUN 接管全局流量，Fake-IP 加速解析，提供 HTTP/SOCKS 混合端口供其他应用调用。',
    icon: 'laptop',
  },
  {
    id: 'sidecar',
    title: '旁路由',
    subtitle: '旁挂网关 / OpenWrt 旁路',
    desc: '设备作为局域网内其他设备的网关。开启 Allow LAN、监听 0.0.0.0、TProxy 或 TUN 自动路由，DNS 需要劫持 53 端口。',
    icon: 'router',
  },
  {
    id: 'router',
    title: '主路由',
    subtitle: '拨号主路由 / 软路由',
    desc: '设备承担全部 NAT 转发。CPU 与内存开销敏感：收敛并发、减少大规则集数量、优先 IP 类规则、关闭不必要的日志。',
    icon: 'server',
  },
];

/* ==================================================================== */
/* 内核与目标                                                           */
/* ==================================================================== */

export type CoreTarget = 'mihomo' | 'singbox';

/**
 * sing-box 版本。
 *
 * 只有两个方言分水岭，选高版本永远向下兼容：
 * - 1.11：DNS 仍是 `address` 字符串 + 独立 `dns.fakeip` 块，带宽用 `up_mbps` / `down_mbps`
 * - 1.12 起：DNS 拆成 `type` + `server`，fakeip 变成 servers 里的一个条目，带宽用 `up` / `down`
 * - 1.13 起：legacy outbound（block / dns / wireguard）彻底移除
 * - 1.14 起：legacy DNS 格式彻底移除
 *
 * 因此 1.13 与 1.14 生成的配置完全一致，1.15 与 1.16 同理，UI 上合并展示。
 */
export type SingBoxVersion = '1.11' | '1.12' | '1.14' | '1.16';

/** 使用新版 DNS 格式（1.12+） */
export function usesNewDnsFormat(v: SingBoxVersion): boolean {
  return v !== '1.11';
}

/** 入站不再写 sniff / domain_strategy，改用 route 规则动作（1.13+，1.14 起旧字段 FATAL） */
export function usesNewInboundFields(v: SingBoxVersion): boolean {
  return v === '1.14' || v === '1.16';
}

/* ==================================================================== */
/* 生成设置                                                             */
/* ==================================================================== */

export interface GenerateOptions {
  core: CoreTarget;
  device: DeviceProfile;
  /** sing-box 版本（影响 JSON 结构差异） */
  singboxVersion: SingBoxVersion;
  mixedPort: number;
  /** 混合代理端口 / TUN 是否开启 */
  enableTun: boolean;
  allowLan: boolean;
  /** 分流策略：白名单=国外全代理；黑名单=仅 GFW 代理；全局=全部代理 */
  strategy: 'whitelist' | 'blacklist' | 'global';
  /** mode: rule / global / direct */
  mode: 'rule' | 'global' | 'direct';
  logLevel: 'silent' | 'error' | 'warning' | 'info' | 'debug';
  /** 外部控制器端口（mihomo 面板） */
  controllerPort: number;
  /** Fake-IP（客户端强烈推荐） */
  fakeIp: boolean;
  /** Fake-IP 过滤模式：blacklist 只代理境外域名，whitelist 让 Fake-IP 不返回真实 IP */
  fakeIpFilterMode: 'blacklist' | 'whitelist';
  /** 是否开启 IPv6 */
  ipv6: boolean;
  /** DNS 上游 */
  dnsRemote: string;
  dnsDirect: string;
  /** 规则集下载镜像源 id */
  mirror: string;
  /** 规则集更新间隔（秒） */
  ruleSetInterval: number;
  /** 场景 id 列表 + 每个场景已回答的问题（value -> option） */
  scenarios: string[];
  /** 场景问题答案：{ [scenarioId]: { [questionId]: string[] } } */
  scenarioAnswers: Record<string, Record<string, string[]>>;
  /** 额外勾选的单个规则集 id */
  ruleSets: string[];
  /** 自定义规则集 */
  customRuleSets: CustomRuleSet[];
  /** 自定义单条规则（优先级最高，排在所有规则集之前） */
  customRules: CustomRule[];
  /** 拦截 UDP 443（QUIC/HTTP3），强制浏览器回落 TCP：可改善经代理时视频卡顿、部分站点打不开、国内站点变慢的问题 */
  blockQuic: boolean;
  /** 运行代理内核的设备局域网 IP（旁路由 / 容器），用于生成 RouterOS 等网关侧配置 */
  gatewayIp: string;
  /** 自动测速 URL */
  urlTestUrl: string;
  urlTestInterval: number;
  /** 节点去重 */
  deduplicate: boolean;
  /** 是否生成「漏网之鱼」兜底规则 */
  finalRule: 'proxy' | 'direct';
  /** LAN 直连（旁路由/路由器必须，避免内网被打洞） */
  bypassLan: boolean;
  /** clash 配置中是否附带 geodata 下载信息 */
  geoAutoUpdate: boolean;
}
