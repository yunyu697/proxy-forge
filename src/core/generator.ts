/**
 * 生成编排层
 *
 * 职责：把「场景选择 + 问题答案 + 设备形态 + 分流策略」翻译成一份
 * 与内核无关的中间计划（ConfigPlan），再交给 mihomo / sing-box 的 builder 落地。
 */
import type { CustomRule, GenerateOptions, ProxyNode } from './types';
import { RULESET_MAP, RuleSetDef, resolveRuleSetUrl } from './rulesets/catalog';
import { SCENARIOS, SCENARIO_MAP } from './rulesets/scenarios';
import { buildMihomo } from './builders/mihomo';
import { buildSingbox } from './builders/singbox';

export interface RuleSetPlanItem {
  /** 在配置中引用的 key（mihomo rule-provider 键名 / sing-box rule_set tag） */
  key: string;
  def: RuleSetDef;
  url: string;
  custom?: boolean;
}

export interface GroupPlan {
  scenarioId: string;
  label: string;
  type: 'select' | 'urltest' | 'reject';
  ruleSetIds: string[];
}

export interface RouteItem {
  kind: 'ruleset' | 'builtin' | 'custom';
  /** ruleset 模式下的引用 key */
  ruleSetKey?: string;
  ruleSetDef?: RuleSetDef;
  /** custom 模式下的自定义规则 */
  customRule?: CustomRule;
  /** builtin 模式下的内置规则名 */
  builtin?: string;
  /** proxy 模式下的目标策略组名；direct/reject 时由 builder 自行映射 */
  target: string;
  action: 'proxy' | 'direct' | 'reject';
  /** 注释说明 */
  note?: string;
}

export interface ConfigPlan {
  nodeCount: number;
  ruleSets: RuleSetPlanItem[];
  groups: GroupPlan[];
  route: RouteItem[];
  warnings: string[];
  /** 设备相关的使用提示（非错误），在预览页与配置注释中展示 */
  tips: string[];
}

export interface GenerateResult {
  content: string;
  plan: ConfigPlan;
  warnings: string[];
  /** 被跳过的节点 */
  skipped: { node: ProxyNode; reason: string }[];
}

/** 收集「场景 + 问题答案 + 手动勾选」最终启用的规则集 */
export function collectEnabledRuleSetIds(options: GenerateOptions): Map<string, string | undefined> {
  const set = new Map<string, string | undefined>();
  for (const sid of options.scenarios) {
    const s = SCENARIO_MAP[sid];
    if (!s) continue;
    for (const rs of s.baseRuleSets) set.set(rs, sid);
    const answers = options.scenarioAnswers[sid] || {};
    for (const q of s.questions) {
      const picked = answers[q.id] || [];
      for (const o of q.options) {
        if (picked.includes(o.value)) {
          for (const rs of o.ruleSets || []) set.set(rs, sid);
        }
      }
    }
  }
  for (const rs of options.ruleSets) if (!set.has(rs)) set.set(rs, undefined);
  return set;
}

function scenarioGroupType(scenarioId: string, options: GenerateOptions): 'select' | 'urltest' | 'reject' {
  const s = SCENARIO_MAP[scenarioId];
  if (!s) return 'select';
  if (s.groupType === 'reject') return 'reject';
  const answers = options.scenarioAnswers[scenarioId] || {};
  // 流媒体：允许用户在「手动指定 / 自动选最快」之间切换
  if (scenarioId === 'streaming') return answers.mode?.[0] === 'auto' ? 'urltest' : 'select';
  return s.groupType;
}

export function buildPlan(nodes: ProxyNode[], options: GenerateOptions): ConfigPlan {
  const warnings: string[] = [];
  const tips: string[] = [];
  const enabled = collectEnabledRuleSetIds(options);

  /* -------------------- 节点预处理 -------------------- */
  const activeNodes = nodes.filter((n) => n.enabled);
  const skipped: { node: ProxyNode; reason: string }[] = [];
  let usable = activeNodes;

  if (options.core === 'singbox') {
    const ssr = usable.filter((n) => n.type === 'shadowsocksr');
    if (ssr.length) {
      for (const n of ssr) skipped.push({ node: n, reason: 'sing-box 不支持 ShadowsocksR 协议' });
      usable = usable.filter((n) => n.type !== 'shadowsocksr');
      warnings.push(`已跳过 ${ssr.length} 个 ShadowsocksR 节点，sing-box 不支持该协议`);
    }
  }

  // 游戏场景里用户选了关闭 UDP
  const gameUdpOff = (options.scenarioAnswers['game']?.udp || []).includes('off');
  if (gameUdpOff) {
    usable = usable.map((n) => ({ ...n, udp: false }));
  }

  /* -------------------- 规则集 -------------------- */
  const ruleSetItems: RuleSetPlanItem[] = [];
  for (const [id] of enabled) {
    const def = RULESET_MAP[id];
    if (!def) continue;
    ruleSetItems.push({
      key: id,
      def,
      url: resolveRuleSetUrl(def, options.core, options.mirror),
    });
  }
  for (const c of options.customRuleSets) {
    if (!c.enabled || !c.url) continue;
    ruleSetItems.push({
      key: c.id,
      def: {
        id: c.id,
        name: c.name,
        desc: '自定义规则集',
        group: 'geo',
        kind: c.kind,
        path: '',
        size: 'medium',
        action: c.action,
      },
      url: c.url,
      custom: true,
    });
  }

  const rsMap = new Map(ruleSetItems.map((r) => [r.key, r]));

  /* -------------------- 策略组 -------------------- */
  const groups: GroupPlan[] = [];
  const groupOrder: string[] = [
    'privacy',
    'streaming',
    'ai',
    'dev',
    'game',
    'social',
    'work',
    'academic',
    'news',
    'finance',
    'cloud',
    'creative',
  ];
  for (const sid of groupOrder) {
    if (!options.scenarios.includes(sid)) continue;
    const s = SCENARIO_MAP[sid];
    if (!s) continue;
    const ids = ruleSetItems.filter((r) => enabled.get(r.key) === sid).map((r) => r.key);
    if (!ids.length) continue;
    groups.push({
      scenarioId: sid,
      label: `${s.emoji} ${s.groupName}`,
      type: scenarioGroupType(sid, options),
      ruleSetIds: ids,
    });
  }

  /* -------------------- 路由计划 -------------------- */
  const route: RouteItem[] = [];
  const usedKeys = new Set<string>();

  const push = (key: string, action: 'proxy' | 'direct' | 'reject', target?: string) => {
    const item = rsMap.get(key);
    if (!item) return;
    usedKeys.add(key);
    route.push({
      kind: 'ruleset',
      ruleSetKey: key,
      ruleSetDef: item.def,
      action,
      target: action === 'proxy' ? target || '🚀 节点选择' : action === 'direct' ? 'DIRECT' : 'REJECT',
    });
  };

  if (options.strategy !== 'global') {
    // 0) 自定义规则优先级最高（用户显式指定）
    for (const c of options.customRules) {
      if (!c.enabled || !c.value.trim()) continue;
      route.push({
        kind: 'custom',
        customRule: c,
        action: c.target,
        target: c.target === 'proxy' ? '🚀 节点选择' : c.target === 'direct' ? 'DIRECT' : 'REJECT',
      });
    }

    // 1) 广告拦截优先
    for (const r of ruleSetItems) {
      if (r.def.action === 'reject' && r.def.group === 'ads') push(r.key, 'reject');
    }
    // 2) 局域网直连
    if (rsMap.has('geo-private')) push('geo-private', 'direct');

    // 3) 自定义 reject 规则
    for (const c of options.customRuleSets) {
      if (c.enabled && c.url && c.action === 'reject') push(c.id, 'reject');
    }

    // 3.5) 直连加速场景：Apple/微软/Steam 国内 CDN 强制直连，优先于场景代理组
    if (options.scenarios.includes('accel')) {
      const accelIds = ruleSetItems.filter((r) => enabled.get(r.key) === 'accel').map((r) => r.key);
      for (const id of accelIds) push(id, 'direct');
    }

    // 4) 各场景策略组
    for (const g of groups) {
      for (const id of g.ruleSetIds) {
        if (g.type === 'reject') push(id, 'reject');
        else push(id, 'proxy', g.label);
      }
    }

    // 5) 国内直连
    if (rsMap.has('geo-cn-domain')) push('geo-cn-domain', 'direct');
    if (rsMap.has('geo-cn-ip')) push('geo-cn-ip', 'direct');

    // 6) 分流策略
    if (options.strategy === 'whitelist') {
      if (rsMap.has('geo-notcn-domain')) push('geo-notcn-domain', 'proxy');
    } else if (options.strategy === 'blacklist') {
      if (rsMap.has('geo-gfw')) push('geo-gfw', 'proxy');
    }

    // 7) 其余手动勾选的规则集按默认动作处理
    for (const r of ruleSetItems) {
      if (usedKeys.has(r.key)) continue;
      if (r.def.group === 'ads') continue;
      push(r.key, r.def.action);
    }
  } else {
    for (const c of options.customRules) {
      if (!c.enabled || !c.value.trim()) continue;
      route.push({
        kind: 'custom',
        customRule: c,
        action: c.target,
        target: c.target === 'proxy' ? '🚀 节点选择' : c.target === 'direct' ? 'DIRECT' : 'REJECT',
      });
    }
    for (const r of ruleSetItems) {
      if (r.def.action === 'reject') push(r.key, 'reject');
    }
    if (rsMap.has('geo-private')) push('geo-private', 'direct');
  }

  if (options.bypassLan) {
    route.push({ kind: 'builtin', builtin: 'GEOIP,LAN', action: 'direct', target: 'DIRECT' });
  }

  /* -------------------- 提示与警告 -------------------- */
  if (!usable.length) warnings.push('没有启用任何节点，生成的配置只能直连。');
  if (options.device === 'router') {
    const large = ruleSetItems.filter((r) => r.def.size === 'large');
    if (large.length > 2) {
      warnings.push(
        `启用了 ${large.length} 套大体积规则集（${large.map((r) => r.def.name).join('、')}），低内存路由器可能吃力，建议改用「黑名单」分流策略。`,
      );
    }
  }
  if (options.device === 'client' && !options.enableTun) {
    warnings.push('客户端未开启 TUN，只有手动设置代理的应用会走代理，游戏机与部分 App 不受影响。');
  }
  if (options.core === 'singbox' && options.singboxVersion === '1.11') {
    const hasAny = usable.some((n) => n.type === 'anytls');
    if (hasAny) warnings.push('AnyTLS 需要 sing-box 1.11 及以上版本，请确保内核版本匹配。');
  }
  if (options.strategy === 'blacklist' && !rsMap.has('geo-gfw')) {
    warnings.push('黑名单模式需要「GFWList」规则集，请在规则集中勾选它，否则境外流量会全部直连。');
  }
  if (options.strategy === 'whitelist' && !rsMap.has('geo-notcn-domain') && !rsMap.has('geo-cn-domain')) {
    warnings.push('白名单模式依赖国内/境外规则集，建议至少启用「中国大陆域名」或「境外域名」。');
  }
  if (gameUdpOff) warnings.push('已按游戏场景设置关闭所有节点的 UDP，语音与 QUIC 可能受影响。');

  // 未被任何规则引用的规则集也提醒
  const unused = ruleSetItems.filter((r) => !usedKeys.has(r.key));
  if (unused.length) {
    warnings.push(`有 ${unused.length} 套规则集未被引用（${unused.map((r) => r.def.name).join('、')}），已自动并入路由。`);
  }

  /* -------------------- 设备相关提示 -------------------- */
  if (options.device !== 'client') {
    // 功耗问题：确实存在，机制与缓解措施
    tips.push(
      '关于终端功耗：确实存在一定影响。网关模式会通过 keep-alive 心跳维持代理长连接、劫持全网 DNS，后台 App 会被更频繁地唤醒，手机等无线设备耗电会比直连时略高。本配置已内置缓解：keep-alive 间隔已放宽至 60 秒、关闭了 UDP 会话保持（EIN）与进程探测。如耗电仍明显，可延长「自动测速间隔」、关闭不用的场景，或让手机在闲置时切回普通 WiFi。',
    );
    // 部分网站打不开（客户端同配置能打开）的经典原因
    tips.push(
      '关于「路由器上打不开、客户端能打开」：常见原因有 ① PPPoE 链路 MTU 偏小导致大包分片丢失（本配置 TUN MTU 已降为 1500 缓解，若仍出现可再降到 1400）；② 终端拿到 IPv6 地址后流量绕过网关（建议在路由器关闭 IPv6 RA 或保持本配置 IPv6 为关）；③ 浏览器自带安全 DNS（DoH）绕过了 53 端口劫持，Fake-IP 失效（请在浏览器关闭「安全 DNS / Secure DNS」）；④ 个别站点依赖 QUIC，本配置已默认拦截 UDP 443 强制回落 TCP。',
    );
    // 国内网站慢
    tips.push(
      '关于「国内网站变慢」：请确保「中国大陆域名 / IP」规则集处于启用状态（分流错误的国内流量走代理是最常见原因）；其次浏览器对国内站点使用 QUIC 时经网关转发可能变慢，拦截 UDP 443 强制回落 TCP 通常更快；另外建议勾选「直连加速」场景，让 Apple / 微软 / Steam 这类国内有 CDN 的服务不走代理。',
    );
    if (!options.blockQuic) {
      warnings.push('「拦截 QUIC (UDP 443)」已关闭：部分网站可能加载缓慢或打不开，网关模式建议保持开启。');
    }
    if (!options.scenarios.includes('accel')) {
      tips.push('「直连加速」场景未启用：Apple 更新、Steam 下载等大流量走代理会明显变慢，建议到规则集步骤勾选。');
    }
  }

  return {
    nodeCount: usable.length,
    ruleSets: ruleSetItems,
    groups,
    route,
    warnings,
    tips,
  };
}

/** 预处理节点（协议兼容、UDP 开关等），供 builder 使用 */
export function prepareNodes(nodes: ProxyNode[], options: GenerateOptions): ProxyNode[] {
  let list = nodes.filter((n) => n.enabled);
  if (options.core === 'singbox') list = list.filter((n) => n.type !== 'shadowsocksr');
  if ((options.scenarioAnswers['game']?.udp || []).includes('off')) {
    list = list.map((n) => ({ ...n, udp: false }));
  }
  let out = list;
  if (options.deduplicate) {
    const seen = new Set<string>();
    out = list.filter((n) => {
      const k = `${n.type}|${n.server}|${n.port}|${n.password || ''}|${n.uuid || ''}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }
  // 修复重名（mihomo / sing-box 都要求唯一）
  const names = new Set<string>();
  return out.map((n) => {
    let name = n.name;
    if (names.has(name)) {
      let i = 2;
      while (names.has(`${name} ${i}`)) i += 1;
      name = `${name} ${i}`;
    }
    names.add(name);
    return { ...n, name };
  });
}

export function generateConfig(nodes: ProxyNode[], options: GenerateOptions): GenerateResult {
  const plan = buildPlan(nodes, options);
  const prepared = prepareNodes(nodes, options);
  const skipped: { node: ProxyNode; reason: string }[] = [];
  for (const n of nodes.filter((x) => x.enabled)) {
    if (options.core === 'singbox' && n.type === 'shadowsocksr') {
      skipped.push({ node: n, reason: 'sing-box 不支持 ShadowsocksR 协议' });
    }
  }
  plan.nodeCount = prepared.length;

  const content =
    options.core === 'mihomo' ? buildMihomo(prepared, options, plan) : buildSingbox(prepared, options, plan);

  return { content, plan, warnings: plan.warnings, skipped };
}

/** 默认生成选项 */
export function defaultOptions(): GenerateOptions {
  return {
    core: 'mihomo',
    device: 'client',
    singboxVersion: '1.11',
    mixedPort: 7890,
    enableTun: true,
    allowLan: false,
    strategy: 'whitelist',
    mode: 'rule',
    logLevel: 'info',
    controllerPort: 9090,
    fakeIp: true,
    fakeIpFilterMode: 'blacklist',
    ipv6: false,
    dnsRemote: 'https://1.1.1.1/dns-query',
    dnsDirect: 'https://223.5.5.5/dns-query',
    mirror: 'raw',
    ruleSetInterval: 86400,
    scenarios: ['daily'],
    scenarioAnswers: { daily: {} },
    ruleSets: [],
    customRuleSets: [],
    customRules: [],
    blockQuic: false,
    gatewayIp: '',
    urlTestUrl: 'https://www.gstatic.com/generate_204',
    urlTestInterval: 300,
    deduplicate: true,
    finalRule: 'proxy',
    bypassLan: true,
    geoAutoUpdate: true,
  };
}

/** 设备形态差异化建议，供界面展示 */
export function deviceRecommendations(device: GenerateOptions['device']) {
  const common = {
    mixedPort: 7890,
    enableTun: true,
    allowLan: device !== 'client',
    fakeIp: device === 'client',
    ipv6: false,
    strategy: device === 'router' ? ('blacklist' as const) : ('whitelist' as const),
    logLevel: device === 'router' ? ('warning' as const) : ('info' as const),
    // 网关模式下默认拦截 QUIC：UDP 经网关转发质量参差，回落 TCP 更稳更快
    blockQuic: device !== 'client',
  };
  return common;
}

export { SCENARIOS };
