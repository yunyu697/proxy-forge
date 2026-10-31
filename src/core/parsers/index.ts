import { ProxyNode, ProxyType, newNodeId, PROXY_TYPE_LABELS } from '../types';
import { decodeBase64, hostOf, parseBool, parseList, parseNumber, parseQuery, splitHostPort, splitUri } from '../utils';

export interface ParseResult {
  nodes: ProxyNode[];
  errors: { line: string; reason: string }[];
}

/** 从任意文本块中批量导入：支持换行分隔、订阅内容（base64）、YAML/JSON 混合 */
export function importFromText(text: string): ParseResult {
  const errors: { line: string; reason: string }[] = [];
  const nodes: ProxyNode[] = [];

  let raw = text.trim();
  if (!raw) return { nodes, errors };

  // 整段订阅（可能是 base64 过的）
  if (!raw.includes('\n') && !raw.includes('://')) {
    try {
      const decoded = decodeBase64(raw);
      if (decoded.includes('://')) raw = decoded;
    } catch {
      /* 不是 base64 就跳过 */
    }
  }

  // 也兼容 clash yaml 的 proxies 列表
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  for (const line of lines) {
    // YAML 列表项：- {name: xx, type: ss, ... }
    if (line.startsWith('- ') && line.includes('type:')) {
      const node = tryParseYamlNode(line);
      if (node) {
        nodes.push(node);
        continue;
      }
    }
    try {
      const node = parseUri(line);
      if (node) nodes.push(node);
      else errors.push({ line, reason: '无法识别的链接格式' });
    } catch (e) {
      errors.push({ line, reason: (e as Error).message });
    }
  }

  return { nodes: dedupe(nodes), errors };
}

function tryParseYamlNode(line: string): ProxyNode | null {
  try {
    const body = line.replace(/^-\s*/, '').replace(/^\{|\}$/g, '');
    const kv: Record<string, string> = {};
    for (const seg of body.split(/,\s*(?=[a-zA-Z-]+:)/)) {
      const i = seg.indexOf(':');
      if (i === -1) continue;
      kv[
        seg
          .slice(0, i)
          .trim()
          .replace(/^["']|["']$/g, '')
      ] = seg
        .slice(i + 1)
        .trim()
        .replace(/^["']|["']$/g, '');
    }
    const type = (kv.type || '').toLowerCase();
    const map: Record<string, ProxyType> = {
      ss: 'shadowsocks',
      ssr: 'shadowsocksr',
      vmess: 'vmess',
      vless: 'vless',
      trojan: 'trojan',
      hysteria: 'hysteria',
      hysteria2: 'hysteria2',
      tuic: 'tuic',
      anytls: 'anytls',
      wireguard: 'wireguard',
      http: 'http',
      socks: 'socks',
      socks5: 'socks',
    };
    if (!map[type]) return null;
    const node: ProxyNode = {
      id: newNodeId(),
      type: map[type],
      name: kv.name || `${PROXY_TYPE_LABELS[map[type]]} 节点`,
      server: kv.server,
      port: Number(kv.port) || 443,
      enabled: true,
      udp: kv.udp !== 'false',
      tls: false,
      cipher: kv.cipher,
      password: kv.password,
      raw: line,
    };
    if (kv.uuid) node.uuid = kv.uuid;
    if (kv.sni) node.sni = kv.sni;
    return node;
  } catch {
    return null;
  }
}

export function parseUri(uri: string): ProxyNode | null {
  if (!uri || !uri.includes('://')) return null;
  const { scheme, body, hash } = splitUri(uri);

  switch (scheme) {
    case 'ss':
      return parseShadowsocks(body, hash, uri);
    case 'ssr':
      return parseShadowsocksR(body, uri);
    case 'vmess':
      return parseVmess(body, uri);
    case 'vless':
      return parseVless(body, hash, uri);
    case 'trojan':
      return parseTrojan(body, hash, uri);
    case 'hysteria':
      return parseHysteria1(body, hash, uri);
    case 'hysteria2':
    case 'hy2':
      return parseHysteria2(body, hash, uri);
    case 'tuic':
      return parseTuic(body, hash, uri);
    case 'anytls':
      return parseAnytls(body, hash, uri);
    case 'wireguard':
    case 'wg':
      return parseWireguard(body, hash, uri);
    case 'http':
    case 'https':
      return parseHttp(body, hash, uri, scheme === 'https');
    case 'socks':
    case 'socks5':
    case 'socks5h':
      return parseSocks(body, hash, uri);
    default:
      return null;
  }
}

/* ---------------------------- Shadowsocks ---------------------------- */

function parseShadowsocks(body: string, hash: string, raw: string): ProxyNode {
  const name = hash;
  let main = body;

  // 去 plugin 查询串
  let query = '';
  const qIdx = body.indexOf('?');
  if (qIdx !== -1 && !body.slice(0, qIdx).includes('/')) {
    // SIP002: ss://userinfo@host:port/?plugin=...
  }
  const slashIdx = body.indexOf('/');
  if (slashIdx !== -1) {
    const tail = body.slice(slashIdx + 1);
    if (tail.startsWith('?') || tail.includes('=')) query = tail.startsWith('?') ? tail.slice(1) : tail;
    main = body.slice(0, slashIdx);
  }

  let cipher = '';
  let password = '';
  let server = '';
  let port = 0;

  if (main.includes('@')) {
    // SIP002
    const at = main.lastIndexOf('@');
    const userInfo = main.slice(0, at);
    const target = main.slice(at + 1);
    const decodedUser = decodeBase64(userInfo.replace(/\+/g, '+'));
    const colon = decodedUser.indexOf(':');
    cipher = decodedUser.slice(0, colon);
    password = decodedUser.slice(colon + 1);
    const hp = splitHostPort(target);
    server = hp.host;
    port = hp.port;
  } else {
    // legacy: base64(method:password@host:port) 或明文
    let decoded = main;
    if (!main.includes(':')) {
      decoded = decodeBase64(main);
    }
    const at = decoded.lastIndexOf('@');
    const userPart = decoded.slice(0, at);
    const target = decoded.slice(at + 1);
    const colon = userPart.indexOf(':');
    cipher = userPart.slice(0, colon);
    password = userPart.slice(colon + 1);
    const hp = splitHostPort(target);
    server = hp.host;
    port = hp.port;
  }

  const q = parseQuery(query);
  const node: ProxyNode = {
    id: newNodeId(),
    type: 'shadowsocks',
    name: name || `${server}:${port}`,
    server,
    port,
    enabled: true,
    udp: !('udp' in q && q.udp === 'false'),
    tls: false,
    cipher,
    password,
    raw,
  };

  if (q.plugin) {
    // 形如 obfs=http_simple;obfs-host=xxx 或 v2ray-plugin;tls;host=xx
    const segs = q.plugin.split(';').filter(Boolean);
    const pluginName = segs[0];
    const opts: Record<string, string> = {};
    for (const seg of segs.slice(1)) {
      const i = seg.indexOf('=');
      if (i === -1) opts[seg] = 'true';
      else opts[seg.slice(0, i)] = seg.slice(i + 1);
    }
    node.plugin = pluginName;
    if (Object.keys(opts).length) node.pluginOpts = opts;
    if (pluginName.startsWith('v2ray-plugin')) node.tls = true;
  }
  return node;
}

/* --------------------------- ShadowsocksR ---------------------------- */

/** SSR 内部字段的 base64 解码，非法内容静默降级为 undefined */
function tryB64(s?: string): string | undefined {
  if (!s) return undefined;
  try {
    const v = decodeBase64(s.replace(/-/g, '+').replace(/_/g, '/'));
    return v || undefined;
  } catch {
    return undefined;
  }
}

function parseShadowsocksR(body: string, raw: string): ProxyNode {
  const decoded = decodeBase64(body);
  const qIdx = decoded.indexOf('/?');
  let main = decoded;
  let query = '';
  if (qIdx !== -1) {
    main = decoded.slice(0, qIdx);
    query = decoded.slice(qIdx + 2);
  }
  const parts = main.split(':');
  if (parts.length < 6) throw new Error('SSR 链接格式不完整');

  const [server, portStr, protocol, method, obfs, passB64] = parts;
  const password = decodeBase64(passB64);
  const q = parseQuery(query);

  const name = tryB64(q.remarks) || `${server}:${portStr}`;
  const group = tryB64(q.group);

  return {
    id: newNodeId(),
    type: 'shadowsocksr',
    name,
    server,
    port: Number(portStr) || 8388,
    enabled: true,
    udp: true,
    tls: false,
    cipher: method,
    password,
    ssrProtocol: protocol,
    ssrObfs: obfs,
    ssrProtocolParam: tryB64(q.protoparam),
    ssrObfsParam: tryB64(q.obfsparam),
    group,
    raw,
  };
}

/* ------------------------------- VMess ------------------------------- */

function parseVmess(body: string, raw: string): ProxyNode {
  const text = body.trim().startsWith('{') ? body : decodeBase64(body);
  const obj = JSON.parse(text) as Record<string, any>;
  const port = Number(obj.port ?? 443);
  const base: ProxyNode = {
    id: newNodeId(),
    type: 'vmess',
    name: obj.ps || obj.remarks || `${obj.add}:${port}`,
    server: obj.add,
    port,
    enabled: true,
    udp: true,
    tls: String(obj.tls ?? '').toLowerCase() === 'tls',
    uuid: obj.id,
    alterId: Number(obj.aid ?? 0),
    vmessSecurity: obj.scy || obj.security || 'auto',
    sni: obj.sni || obj.host || undefined,
    raw,
  };
  const net = String(obj.net || obj.type || 'tcp').toLowerCase();
  const host = obj.host || obj.obfsParam || '';
  const path = obj.path || '';

  switch (net) {
    case 'ws':
      base.network = 'ws';
      base.wsPath = path;
      base.wsHeaders = host ? { Host: host } : undefined;
      break;
    case 'grpc':
      base.network = 'grpc';
      base.grpcServiceName = path || obj.serviceName || '';
      break;
    case 'h2':
      base.network = 'h2';
      base.h2Path = path;
      base.h2Host = host;
      break;
    case 'httpupgrade':
      base.network = 'httpupgrade';
      base.wsPath = path;
      base.wsHeaders = host ? { Host: host } : undefined;
      break;
    case 'quic':
      base.network = 'quic';
      break;
    default:
      base.network = 'tcp';
      // v2rayN 的 http 伪装（tcp + headerType http）
      if (String(obj.type || '').toLowerCase() === 'http' || String(obj.headerType || '').toLowerCase() === 'http') {
        base.network = 'h2';
        base.h2Path = path;
        base.h2Host = host;
      }
  }
  if (obj.alpn) base.alpn = parseList(String(obj.alpn));
  if (obj.fp) base.fingerprint = obj.fp;
  if (obj.maxEarlyData) {
    base.wsPath = (base.wsPath || '') + (base.wsPath?.includes('?') ? '&' : '?') + 'ed=2048';
  }
  return base;
}

/* ------------------------------- VLESS ------------------------------- */

function parseVless(body: string, hash: string, raw: string): ProxyNode {
  const { userinfo, host: target, query } = splitUserinfoTarget(body);
  const q = parseQuery(query);
  const hp = splitHostPort(target);
  const name = hash || `${hp.host}:${hp.port}`;

  const node: ProxyNode = {
    id: newNodeId(),
    type: 'vless',
    name,
    server: hp.host,
    port: hp.port,
    enabled: true,
    udp: true,
    tls: q.security === 'tls' || q.security === 'reality',
    uuid: userinfo,
    sni: q.sni || q.host || undefined,
    alpn: parseList(q.alpn),
    flow: q.flow || undefined,
    fingerprint: q.fp || undefined,
    raw,
  };

  if (q.security === 'reality') {
    node.realityPublicKey = q.pbk;
    node.realityShortId = q.sid;
  } else {
    node.skipCertVerify = q.allowInsecure === 'true' || q.allowInsecure === '1';
  }

  applyTransport(node, q);
  return node;
}

/* ------------------------------- Trojan ------------------------------ */

function parseTrojan(body: string, hash: string, raw: string): ProxyNode {
  const { userinfo, host: target, query } = splitUserinfoTarget(body);
  const q = parseQuery(query);
  const hp = splitHostPort(target);
  const node: ProxyNode = {
    id: newNodeId(),
    type: 'trojan',
    name: hash || `${hp.host}:${hp.port}`,
    server: hp.host,
    port: hp.port,
    enabled: true,
    udp: true,
    tls: true,
    password: userinfo,
    sni: q.sni || q.peer || q.host || undefined,
    alpn: parseList(q.alpn),
    skipCertVerify: parseBool(q.allowInsecure),
    fingerprint: q.fp,
    raw,
  };
  // trojan-go 的 websocket / grpc 传输
  applyTransport(node, q);
  return node;
}

/* ----------------------------- Hysteria 1 ---------------------------- */

function parseHysteria1(body: string, hash: string, raw: string): ProxyNode {
  // 两种形式：hysteria://host:port?auth=xx 或 hysteria://auth@host:port
  let target = body;
  let query = '';
  let auth: string | undefined;
  const qIdx = body.indexOf('?');
  if (qIdx !== -1) {
    target = body.slice(0, qIdx);
    query = body.slice(qIdx + 1);
  }
  if (target.includes('@')) {
    const at = target.lastIndexOf('@');
    auth = decodeURIComponent(target.slice(0, at));
    target = target.slice(at + 1);
  }
  const q = parseQuery(query);
  const hp = splitHostPort(target);

  const upMbps = q.upmbps || q.up_mbps || q.up;
  const downMbps = q.downmbps || q.down_mbps || q.down;

  return {
    id: newNodeId(),
    type: 'hysteria',
    name: hash || `${hp.host}:${hp.port}`,
    server: hp.host,
    port: hp.port,
    enabled: true,
    udp: true,
    tls: true,
    authStr: auth || q.auth,
    sni: q.peer || q.sni || undefined,
    alpn: parseList(q.alpn) || ['hysteria'],
    skipCertVerify: parseBool(q.insecure) || parseBool(q.allowInsecure),
    up: upMbps ? `${upMbps} Mbps` : undefined,
    down: downMbps ? `${downMbps} Mbps` : undefined,
    obfsPassword: q.obfs || undefined,
    hopPorts: q.mport || undefined,
    raw,
  };
}

/* ----------------------------- Hysteria 2 ---------------------------- */

function parseHysteria2(body: string, hash: string, raw: string): ProxyNode {
  let target = body;
  let query = '';
  const qIdx = body.indexOf('?');
  if (qIdx !== -1) {
    target = body.slice(0, qIdx);
    query = body.slice(qIdx + 1);
  }
  let password = '';
  if (target.includes('@')) {
    const at = target.lastIndexOf('@');
    password = decodeURIComponent(target.slice(0, at));
    target = target.slice(at + 1);
  }
  const q = parseQuery(query);
  const hp = splitHostPort(target);
  if (!password) password = q.auth || q.password || '';

  const upMbps = q.upmbps || q.up_mbps || q.up;
  const downMbps = q.downmbps || q.down_mbps || q.down;

  return {
    id: newNodeId(),
    type: 'hysteria2',
    name: hash || `${hp.host}:${hp.port}`,
    server: hp.host,
    port: hp.port,
    enabled: true,
    udp: true,
    tls: true,
    password,
    sni: q.sni || q.peer || undefined,
    alpn: parseList(q.alpn),
    skipCertVerify: parseBool(q.insecure) || parseBool(q.allowInsecure),
    obfsPassword: q['obfs-password'] || q.obfsPassword || (q.obfs && q.obfs !== 'none' ? undefined : undefined),
    up: upMbps ? `${upMbps} Mbps` : undefined,
    down: downMbps ? `${downMbps} Mbps` : undefined,
    hopPorts: q.mport || undefined,
    raw,
  };
}

/* -------------------------------- TUIC ------------------------------- */

function parseTuic(body: string, hash: string, raw: string): ProxyNode {
  const { userinfo, host: target, query } = splitUserinfoTarget(body);
  const q = parseQuery(query);
  const hp = splitHostPort(target);
  // userinfo = uuid:password
  const colon = userinfo.indexOf(':');
  const uuid = colon === -1 ? userinfo : userinfo.slice(0, colon);
  const password = colon === -1 ? '' : userinfo.slice(colon + 1);

  return {
    id: newNodeId(),
    type: 'tuic',
    name: hash || `${hp.host}:${hp.port}`,
    server: hp.host,
    port: hp.port,
    enabled: true,
    udp: true,
    tls: true,
    uuid,
    password,
    sni: q.sni || q.peer || undefined,
    alpn: parseList(q.alpn) || ['h3'],
    skipCertVerify: parseBool(q.allow_insecure) || parseBool(q.allowInsecure) || parseBool(q.insecure),
    congestion: q.congestion_control || q.congestion || undefined,
    udpRelayMode: q.udp_relay_mode || q.udpRelayMode || undefined,
    disableSni: parseBool(q.disable_sni),
    reduceRtt: parseBool(q.reduce_rtt),
    zeroRtt: parseBool(q.zero_rtt_handshake),
    heartbeat: parseNumber(q.heartbeat_interval || q.heartbeat),
    raw,
  };
}

/* ------------------------------- AnyTLS ------------------------------ */

function parseAnytls(body: string, hash: string, raw: string): ProxyNode {
  const { userinfo, host: target, query } = splitUserinfoTarget(body);
  const q = parseQuery(query);
  const hp = splitHostPort(target);
  return {
    id: newNodeId(),
    type: 'anytls',
    name: hash || `${hp.host}:${hp.port}`,
    server: hp.host,
    port: hp.port,
    enabled: true,
    udp: true,
    tls: true,
    password: userinfo,
    sni: q.sni || q.peer || undefined,
    alpn: parseList(q.alpn),
    skipCertVerify: parseBool(q.insecure) || parseBool(q.allowInsecure),
    fingerprint: q.fp,
    raw,
  };
}

/* ------------------------------ WireGuard ---------------------------- */

function parseWireguard(body: string, hash: string, raw: string): ProxyNode {
  const { userinfo, host: target, query } = splitUserinfoTarget(body);
  const q = parseQuery(query);
  const hp = splitHostPort(target);
  return {
    id: newNodeId(),
    type: 'wireguard',
    name: hash || `${hp.host}:${hp.port}`,
    server: hp.host,
    port: hp.port,
    enabled: true,
    udp: true,
    tls: false,
    wgPrivateKey: userinfo || q.privatekey || q.private_key,
    wgPeerPublicKey: q.publickey || q.peer_public_key || q.public_key,
    wgPreSharedKey: q.presharedkey || q.pre_shared_key,
    wgLocalAddress: q.address || q.ip || '10.0.0.2/32',
    wgReserved: q.reserved,
    wgMtu: parseNumber(q.mtu, 1408),
    raw,
  };
}

/* ---------------------------- HTTP / SOCKS --------------------------- */

function parseHttp(body: string, hash: string, raw: string, isTls: boolean): ProxyNode {
  const { userinfo, host: target } = splitUserinfoTarget(body);
  const hp = splitHostPort(target);
  const colon = userinfo.indexOf(':');
  return {
    id: newNodeId(),
    type: 'http',
    name: hash || `${hp.host}:${hp.port}`,
    server: hp.host,
    port: hp.port,
    enabled: true,
    udp: false,
    tls: isTls,
    username: colon === -1 ? userinfo || undefined : userinfo.slice(0, colon),
    password: colon === -1 ? undefined : userinfo.slice(colon + 1),
    raw,
  };
}

function parseSocks(body: string, hash: string, raw: string): ProxyNode {
  const { userinfo, host: target } = splitUserinfoTarget(body);
  const hp = splitHostPort(target);
  const colon = userinfo.indexOf(':');
  return {
    id: newNodeId(),
    type: 'socks',
    name: hash || `${hp.host}:${hp.port}`,
    server: hp.host,
    port: hp.port,
    enabled: true,
    udp: true,
    tls: false,
    username: colon === -1 ? userinfo || undefined : userinfo.slice(0, colon),
    password: colon === -1 ? undefined : userinfo.slice(colon + 1),
    raw,
  };
}

/* ------------------------------- 工具 -------------------------------- */

function splitUserinfoTarget(body: string): { userinfo: string; host: string; query: string } {
  let main = body;
  let query = '';
  const qIdx = body.indexOf('?');
  if (qIdx !== -1) {
    main = body.slice(0, qIdx);
    query = body.slice(qIdx + 1);
  }
  const at = main.lastIndexOf('@');
  if (at === -1) return { userinfo: '', host: main, query };
  return { userinfo: main.slice(0, at), host: main.slice(at + 1), query };
}

/** 通用传输层参数（vless / trojan 的 type=ws|grpc|h2|httpupgrade） */
function applyTransport(node: ProxyNode, q: Record<string, string>) {
  const type = (q.type || '').toLowerCase();
  const path = q.path || q.serviceName || '';
  const host = q.host || '';
  switch (type) {
    case 'ws':
      node.network = 'ws';
      node.wsPath = path || '/';
      node.wsHeaders = host ? { Host: host } : undefined;
      break;
    case 'httpupgrade':
      node.network = 'httpupgrade';
      node.wsPath = path || '/';
      node.wsHeaders = host ? { Host: host } : undefined;
      break;
    case 'grpc':
      node.network = 'grpc';
      node.grpcServiceName = path;
      break;
    case 'h2':
    case 'http':
      node.network = 'h2';
      node.h2Path = path;
      node.h2Host = host;
      break;
    default:
      if (!node.network) node.network = 'tcp';
  }
}

function keyOf(n: ProxyNode): string {
  return [n.type, n.server, n.port, n.password || '', n.uuid || '', n.name].join('|');
}

export function dedupe(nodes: ProxyNode[]): ProxyNode[] {
  const seen = new Set<string>();
  const out: ProxyNode[] = [];
  for (const n of nodes) {
    const k = keyOf(n);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(n);
  }
  return out;
}

/** 生成可复制的分享链接（用于导出节点） */
export function buildUri(node: ProxyNode): string {
  const name = encodeURIComponent(node.name);
  const host = hostOf(node.server).includes(':') && !node.server.startsWith('[') ? `[${node.server}]` : node.server;
  switch (node.type) {
    case 'shadowsocks': {
      const user = btoa(`${node.cipher}:${node.password}`).replace(/=+$/, '');
      let uri = `ss://${user}@${host}:${node.port}`;
      if (node.plugin) {
        const opts = Object.entries(node.pluginOpts || {})
          .map(([k, v]) => (v === 'true' ? k : `${k}=${v}`))
          .join(';');
        uri += `/?plugin=${encodeURIComponent([node.plugin, opts].filter(Boolean).join(';'))}`;
      }
      return `${uri}#${name}`;
    }
    case 'vmess': {
      const obj: Record<string, any> = {
        v: '2',
        ps: node.name,
        add: node.server,
        port: String(node.port),
        id: node.uuid,
        aid: String(node.alterId ?? 0),
        scy: node.vmessSecurity || 'auto',
        net: node.network || 'tcp',
        type: 'none',
        host: node.wsHeaders?.Host || node.h2Host || '',
        path: node.wsPath || node.h2Path || node.grpcServiceName || '',
        tls: node.tls ? 'tls' : '',
        sni: node.sni || '',
      };
      return `vmess://${btoa(JSON.stringify(obj))}#${name}`;
    }
    case 'vless': {
      const q = new URLSearchParams();
      q.set('encryption', 'none');
      q.set('security', node.realityPublicKey ? 'reality' : node.tls ? 'tls' : 'none');
      q.set('type', node.network || 'tcp');
      if (node.sni) q.set('sni', node.sni);
      if (node.flow) q.set('flow', node.flow);
      if (node.fingerprint) q.set('fp', node.fingerprint);
      if (node.alpn?.length) q.set('alpn', node.alpn.join(','));
      if (node.wsPath) q.set('path', node.wsPath);
      if (node.wsHeaders?.Host) q.set('host', node.wsHeaders.Host);
      if (node.grpcServiceName) q.set('serviceName', node.grpcServiceName);
      if (node.realityPublicKey) q.set('pbk', node.realityPublicKey);
      if (node.realityShortId) q.set('sid', node.realityShortId);
      return `vless://${node.uuid}@${host}:${node.port}?${q.toString()}#${name}`;
    }
    case 'trojan': {
      const q = new URLSearchParams();
      if (node.sni) q.set('sni', node.sni);
      if (node.alpn?.length) q.set('alpn', node.alpn.join(','));
      if (node.skipCertVerify) q.set('allowInsecure', '1');
      return `trojan://${encodeURIComponent(node.password || '')}@${host}:${node.port}?${q.toString()}#${name}`;
    }
    case 'hysteria2': {
      const q = new URLSearchParams();
      if (node.sni) q.set('sni', node.sni);
      if (node.obfsPassword) q.set('obfs-password', node.obfsPassword);
      if (node.skipCertVerify) q.set('insecure', '1');
      if (node.up) q.set('up', node.up.replace(/\s*Mbps$/i, ''));
      if (node.down) q.set('down', node.down.replace(/\s*Mbps$/i, ''));
      return `hysteria2://${encodeURIComponent(node.password || '')}@${host}:${node.port}?${q.toString()}#${name}`;
    }
    case 'tuic': {
      const q = new URLSearchParams();
      if (node.sni) q.set('sni', node.sni);
      if (node.congestion) q.set('congestion_control', node.congestion);
      if (node.alpn?.length) q.set('alpn', node.alpn.join(','));
      return `tuic://${node.uuid}:${encodeURIComponent(node.password || '')}@${host}:${node.port}?${q.toString()}#${name}`;
    }
    case 'http':
    case 'socks': {
      const scheme = node.type === 'http' ? (node.tls ? 'https' : 'http') : 'socks5';
      const auth = node.username
        ? `${encodeURIComponent(node.username)}:${encodeURIComponent(node.password || '')}@`
        : '';
      return `${scheme}://${auth}${host}:${node.port}#${name}`;
    }
    default:
      return node.raw || '';
  }
}
