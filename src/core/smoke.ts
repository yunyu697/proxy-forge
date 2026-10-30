/**
 * 冒烟测试：node 下验证 解析 -> 生成 全链路
 * 运行：npx esbuild src/core/smoke.ts --bundle --platform=node --outfile=/tmp/pf-smoke.mjs && node /tmp/pf-smoke.mjs
 */
import { importFromText } from './parsers';
import { generateConfig, defaultOptions } from './generator';
import { SCENARIOS } from './rulesets/scenarios';
import { buildRouterOsScript, defaultRouterOsProfile, validateProfile } from './deploy';

const SAMPLE = [
  'ss://YWVzLTI1Ni1nY206cGFzc3dvcmQxMjM=@1.2.3.4:8388#%E9%A6%99%E6%B8%AF%2001',
  'vmess://' + Buffer.from(JSON.stringify({ v: '2', ps: '日本 02', add: 'jp.example.com', port: '443', id: 'b831381d-6324-4d53-ad4f-8cda48b30811', aid: '0', scy: 'auto', net: 'ws', host: 'cdn.example.com', path: '/ws', tls: 'tls', sni: 'cdn.example.com' })).toString('base64'),
  'vless://b831381d-6324-4d53-ad4f-8cda48b30811@5.6.7.8:443?encryption=none&security=reality&sni=www.microsoft.com&fp=chrome&pbk=SbVKOEMjK0sIlbwg4akyBg5mL5KZwwB-ed4eEE7YnRc&sid=6ba85179&type=tcp&flow=xtls-rprx-vision#Reality%20Node',
  'trojan://passw0rd@trojan.example.com:443?sni=trojan.example.com&allowInsecure=1#Trojan HK',
  'hysteria2://letmein@hy2.example.com:443?sni=hy2.example.com&insecure=1&obfs=salamander&obfs-password=obfspass#HY2 US',
  'tuic://b831381d-6324-4d53-ad4f-8cda48b30811:tupass@tuic.example.com:443?congestion_control=bbr&alpn=h3&sni=tuic.example.com#TUIC JP',
  'ss://YWVzLTI1Ni1nY206cGFzc3dvcmQxMjM=@1.2.3.4:8388#%E9%A6%99%E6%B8%AF%2001', // 重复节点，应被去重
  'ssr://MS4yLjMuNDo4Mzg4OmF1dGhfYWVzMTI4X21kNTphZXMtMjU2LWNmYjp0bHMxLjJfdGlja2V0X2F1dGg6Y0dGemN6RXlNdz09Lz9vYmZzcGFyYW09ZUhoNGVBPT0mcHJvdG9wYXJhbT0mcmVtYXJrcz1VMU5TSU9hMWkraXZsZWlLZ3VlQ3VRPT0mZ3JvdXA9NXJXTDZLK1Y1N3VF',
  'socks5://user:pass@10.0.0.1:1080#LAN%20SOCKS',
].join('\n');

function check(name: string, cond: boolean, detail = '') {
  console.log(`${cond ? '✅' : '❌'} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!cond) process.exitCode = 1;
}

const { nodes, errors } = importFromText(SAMPLE);
check('解析节点数量（含去重）', nodes.length === 8, `got ${nodes.length}`);
check('无解析错误', errors.length === 0, errors.map((e) => e.reason).join(','));
check('SS 节点', nodes[0].type === 'shadowsocks' && nodes[0].cipher === 'aes-256-gcm' && nodes[0].password === 'password123', JSON.stringify(nodes[0]));
check('SS 名称解码', nodes[0].name === '香港 01', nodes[0].name);
check('VMess', nodes[1].type === 'vmess' && nodes[1].network === 'ws' && nodes[1].wsHeaders?.Host === 'cdn.example.com');
check('VLESS Reality', nodes[2].type === 'vless' && !!nodes[2].realityPublicKey && nodes[2].flow === 'xtls-rprx-vision');
check('Trojan', nodes[3].type === 'trojan' && nodes[3].skipCertVerify === true);
check('Hysteria2', nodes[4].type === 'hysteria2' && nodes[4].obfsPassword === 'obfspass');
check('TUIC', nodes[5].type === 'tuic' && nodes[5].congestion === 'bbr');
check('SSR', nodes[6].type === 'shadowsocksr' && nodes[6].ssrProtocol === 'auth_aes128_md5' && nodes[6].name === 'SSR 测试节点', JSON.stringify({ name: nodes[6].name, proto: nodes[6].ssrProtocol }));
check('SOCKS', nodes[7].type === 'socks' && nodes[7].username === 'user');

// ---- mihomo 生成（旁路由场景）----
const mihomoOpts = {
  ...defaultOptions(),
  core: 'mihomo' as const,
  device: 'sidecar' as const,
  scenarios: ['daily', 'streaming', 'privacy', 'accel'],
  scenarioAnswers: {
    daily: {},
    streaming: { platforms: ['netflix', 'disney'], mode: ['manual'] },
    privacy: { level: ['basic'] },
    accel: { services: ['apple'] },
  },
  mirror: 'ghfast',
  blockQuic: true,
  customRules: [
    { id: 'r1', type: 'DOMAIN-SUFFIX' as const, value: 'baidu.com', target: 'direct' as const, enabled: true },
    { id: 'r2', type: 'DST-PORT' as const, value: '8443', target: 'reject' as const, enabled: true },
  ],
};
const mihomo = generateConfig(nodes, mihomoOpts);
check('场景数量扩充到 14', SCENARIOS.length === 14, `got ${SCENARIOS.length}`);
check('mihomo 包含 mixed-port', mihomo.content.includes('mixed-port: 7890'));
check('mihomo 旁路由监听 0.0.0.0', mihomo.content.includes('bind-address: "*"') || mihomo.content.includes("bind-address: '*'"));
check('mihomo 规则集为 mrs 格式', mihomo.content.includes('format: mrs'));
check('mihomo 镜像生效', mihomo.content.includes('ghfast.top'));
check('mihomo 有广告拦截规则', mihomo.content.includes('RULE-SET,ads-basic,REJECT'));
check('mihomo 有流媒体组', mihomo.content.includes('🎬 流媒体'));
check('mihomo 局域网直连', mihomo.content.includes('RULE-SET,geo-private,DIRECT,no-resolve'));
check('mihomo 拦截 QUIC', mihomo.content.includes('AND,((NETWORK,UDP),(DST-PORT,443)),REJECT'));
check('mihomo 自定义规则置顶', mihomo.content.indexOf('DOMAIN-SUFFIX,baidu.com,DIRECT') > -1);
check('mihomo 自定义端口拦截', mihomo.content.includes('DST-PORT,8443,REJECT'));
check('mihomo 直连加速生效', mihomo.content.includes('RULE-SET,accel-apple,DIRECT'));
check('mihomo MATCH 兜底', mihomo.content.includes('MATCH,🚀 节点选择'));
check('mihomo 无解析警告', mihomo.warnings.length === 0, mihomo.warnings.join(';'));
check('mihomo 有网关提示', mihomo.plan.tips.length >= 3, `got ${mihomo.plan.tips.length}`);

// ---- sing-box 生成（路由器场景）----
const singOpts = {
  ...defaultOptions(),
  core: 'singbox' as const,
  device: 'router' as const,
  strategy: 'blacklist' as const,
  scenarios: ['daily', 'game', 'accel'],
  scenarioAnswers: { daily: {}, game: { platforms: ['steam'], udp: ['on'] }, accel: { services: ['apple'] } },
  ruleSets: ['geo-gfw'],
  blockQuic: true,
  customRules: [
    { id: 'r1', type: 'DOMAIN-SUFFIX' as const, value: 'baidu.com', target: 'direct' as const, enabled: true },
  ],
};
const sing = generateConfig(nodes, singOpts);
const singJson = JSON.parse(sing.content);
check('sing-box log.warn（路由器）', singJson.log.level === 'warn');
check('sing-box 有 tun inbound', singJson.inbounds.some((i: any) => i.type === 'tun'));
check('sing-box 路由器 TUN MTU 1500', singJson.inbounds.find((i: any) => i.type === 'tun')?.mtu === 1500);
check('sing-box rule_set 二进制格式', singJson.route.rule_set.every((r: any) => r.format === 'binary'));
check('sing-box DNS 劫持规则置顶（网关模式必需）', (() => {
  const first = singJson.route.rules[0];
  return first?.port === 53 && first?.action === 'hijack-dns';
})());
check('sing-box 拦截 QUIC', singJson.route.rules.some((r: any) => r.network === 'udp' && r.port === 443 && r.action === 'reject'));
check('sing-box 黑名单走 GFWList', singJson.route.rules.some((r: any) => r.rule_set?.includes('geo-gfw')));
check('sing-box 自定义规则', singJson.route.rules.some((r: any) => r.domain_suffix?.[0] === 'baidu.com' && r.outbound === 'direct'));
check('sing-box 直连加速直连', singJson.route.rules.some((r: any) => r.rule_set?.includes('accel-apple') && r.outbound === 'direct'));
check('sing-box SSR 被跳过', sing.skipped.length === 1, JSON.stringify(sing.skipped));
check('sing-box 有游戏组', singJson.outbounds.some((o: any) => o.tag === '🎮 游戏加速'));
check('sing-box fakeip', singJson.dns.fakeip?.enabled === true);
check('sing-box 默认域名解析器', singJson.route.default_domain_resolver?.server === 'dns-direct');
check('sing-box 路由器有功耗提示', sing.plan.tips.some((t: string) => t.includes('功耗')));

// ---- RouterOS 配置生成（引导表单版）----
const rosBase = { ...defaultOptions(), device: 'sidecar' as const, gatewayIp: '192.168.1.2' };
const rosProfile = {
  ...defaultRouterOsProfile(),
  lanSubnet: '192.168.1.0/24',
  routerIp: '192.168.1.1',
  dhcpPool: '192.168.1.100-192.168.1.200',
};
const rosMihomo = buildRouterOsScript(rosBase, 'incremental', rosProfile);
check('ROS mihomo 增量：53->1053 重定向', rosMihomo.content.includes('to-addresses=192.168.1.2 to-ports=1053'));
check('ROS 增量：代理设备自身豁免', rosMihomo.content.includes('add list=proxyforge-bypass address=192.168.1.2'));
check('ROS 增量：Fake-IP 网段豁免', rosMihomo.content.includes('198.18.0.0/15'));
check('ROS 增量：劫持规则排除自身 dst-address', rosMihomo.content.includes('dst-address=!192.168.1.2'));
check('ROS 增量：劫持模式不改 DHCP', (() => {
  const seg = rosMihomo.content.split('/ip dhcp-server network')[1] || '';
  return seg.includes('无需改动');
})());
check('ROS 增量：参数校验通过', validateProfile(rosBase, rosProfile, 'incremental').every((i) => i.level !== 'error'));
check('ROS 增量：无示例 IP 警告', rosMihomo.warnings.length === 0, rosMihomo.warnings.join(';'));

// dhcpOnly 策略
const rosDhcpOnly = buildRouterOsScript(rosBase, 'incremental', { ...rosProfile, dnsStrategy: 'dhcpOnly' });
check('ROS dhcpOnly：不劫持 53', !rosDhcpOnly.content.includes('chain=dstnat'));
check('ROS dhcpOnly：DHCP 按网段精确匹配', rosDhcpOnly.content.includes('find address="192.168.1.0/24"'));
check('ROS dhcpOnly：DHCP 下发代理 DNS', rosDhcpOnly.content.includes('set [find address="192.168.1.0/24"] dns-server=192.168.1.2'));

// 校验器：代理设备不在网段 / IP 相同 / 池冲突
const badSameSubnet = validateProfile({ ...rosBase, gatewayIp: '10.9.9.9' }, rosProfile, 'incremental');
check('校验器：代理设备不在网段报错', badSameSubnet.some((i) => i.field === 'proxyIp' && i.level === 'error'), JSON.stringify(badSameSubnet));
const badSameIp = validateProfile({ ...rosBase, gatewayIp: '192.168.1.1' }, rosProfile, 'incremental');
check('校验器：与主路由同 IP 报错', badSameIp.some((i) => i.message.includes('相同')));
const badPool = validateProfile(rosBase, { ...rosProfile, dhcpPool: '192.168.1.1-192.168.1.200' }, 'full');
check('校验器：代理 IP 落在地址池告警', badPool.some((i) => i.field === 'dhcpPool' && i.level === 'warn'), JSON.stringify(badPool));

// sing-box：强制网关模式
const rosSingNoTun = buildRouterOsScript(
  { ...defaultOptions(), core: 'singbox', device: 'sidecar', enableTun: false, gatewayIp: '' },
  'incremental',
);
check('ROS sing-box 无 TUN 给出警告', rosSingNoTun.warnings.some((w) => w.includes('TUN')), rosSingNoTun.warnings.join(';'));
check('ROS sing-box 网关模式（示例 IP 兜底）', rosSingNoTun.content.includes('gateway=192.168.88.2 dns-server=192.168.88.2'));

// 网关模式看护提示
const rosGateway = buildRouterOsScript(rosBase, 'incremental', { ...rosProfile, fullTakeover: true });
check('ROS 网关模式：DHCP 同时改网关与 DNS', rosGateway.content.includes('gateway=192.168.1.2 dns-server=192.168.1.2'));
check('ROS 网关模式：离线风险说明', rosGateway.content.includes('全网上不了外网'));
check('ROS 非网关模式：netwatch 看护', rosMihomo.content.includes('netwatch'));

const rosFull = buildRouterOsScript(
  { ...rosBase, device: 'router' },
  'full',
  { ...rosProfile, pppoeUser: 'myuser', pppoePass: 'mypass' },
);
check('ROS 全量：含 PPPoE 账号与 NAT', rosFull.content.includes('user="myuser"') && rosFull.content.includes('masquerade'));
check('ROS 全量：LAN 参数来自表单', rosFull.content.includes('192.168.1.1/24') && rosFull.content.includes('ranges=192.168.1.100-192.168.1.200'));
check('ROS 全量：关闭 RouterOS DNS 服务', rosFull.content.includes('allow-remote-requests=no'));
check('ROS 全量：Safe Mode 提示', rosFull.content.includes('Safe Mode'));

// ---- RouterOS 本机容器拓扑 ----
const onRouterProfile = { ...rosProfile, topology: 'onRouter' as const, lanInterface: 'bridge' };
const rosOnRouter = buildRouterOsScript(rosBase, 'incremental', onRouterProfile);
check('ROS 本机：53 劫持到主路由自身 1053', rosOnRouter.content.includes('to-addresses=192.168.1.1 to-ports=1053'));
check('ROS 本机：in-interface 限定 LAN 桥防容器回环', rosOnRouter.content.includes('chain=dstnat in-interface=bridge protocol=udp'));
check('ROS 本机：不做代理设备豁免（无独立设备）', !rosOnRouter.content.includes('proxy device self bypass'));
check('ROS 本机：DHCP 不改动', (() => {
  const seg = rosOnRouter.content.split('/ip dhcp-server network')[1] || '';
  return seg.includes('无需改动');
})());
check('ROS 本机：容器环境说明', rosOnRouter.content.includes('veth'));
check('ROS 本机：参数校验通过', validateProfile(rosBase, onRouterProfile, 'incremental').every((i) => i.level !== 'error'));
check('ROS 本机：缺 LAN 桥名报错', validateProfile(rosBase, { ...onRouterProfile, lanInterface: '' }, 'incremental').some((i) => i.field === 'lanInterface' && i.level === 'error'));

const rosSingOnRouter = buildRouterOsScript(
  { ...defaultOptions(), core: 'singbox', device: 'router', gatewayIp: '192.168.1.2' },
  'incremental',
  onRouterProfile,
);
check('ROS 本机 + sing-box：给出不可靠警告', rosSingOnRouter.warnings.some((w) => w.includes('容器')), rosSingOnRouter.warnings.join(';'));

console.log('\n— 样例 mihomo 配置（前 40 行）—');
console.log(mihomo.content.split('\n').slice(0, 40).join('\n'));
console.log('\n冒烟测试完成');
