/**
 * 使用场景定义
 *
 * 每个场景 = 一组默认规则集 + 若干引导问题。
 * 用户回答问题后，答案会把对应规则集追加进启用列表，
 * 生成器再按规则集所属的场景自动创建对应的策略组（如「流媒体」「AI 服务」），
 * 这样用户可以给不同类型流量单独指定节点。
 */
import type { DeviceProfile } from '../types';

export interface ScenarioOption {
  label: string;
  value: string;
  desc?: string;
  ruleSets?: string[];
}

export interface ScenarioQuestion {
  id: string;
  title: string;
  desc?: string;
  type: 'multi' | 'single';
  options: ScenarioOption[];
}

export interface ScenarioDef {
  id: string;
  name: string;
  emoji: string;
  summary: string;
  desc: string;
  /** 场景默认启用的规则集 */
  baseRuleSets: string[];
  /** 这些规则集命中后指向的策略组名 */
  groupName: string;
  groupIcon: string;
  /** 该组默认策略类型：select 让用户手选，urltest 自动选最快，reject 直接拦截 */
  groupType: 'select' | 'urltest' | 'reject';
  questions: ScenarioQuestion[];
  deviceTips: Partial<Record<DeviceProfile, string>>;
  /** 生成配置时会写入注释的提示 */
  notes?: string[];
}

export const SCENARIOS: ScenarioDef[] = [
  {
    id: 'daily',
    name: '日常上网',
    emoji: '🌐',
    summary: '国内直连、国外走代理，覆盖绝大多数需求',
    desc: '最通用的分流骨架：国内域名与 IP 直连、局域网直连、其余按你选择的分流策略处理。建议始终保持开启。',
    baseRuleSets: ['geo-cn-domain', 'geo-cn-ip', 'geo-private'],
    groupName: '国外流量',
    groupIcon: '🌐',
    groupType: 'urltest',
    questions: [],
    deviceTips: {
      client: '客户端建议开启 TUN + Fake-IP，浏览器无需额外插件即可接管全部流量。',
      sidecar: '旁路由必须保留「局域网直连」规则，否则同网段设备互访会被绕进代理。',
      router: '主路由若内存吃紧，可改用黑名单模式（仅 GFW 走代理），能省下大量内存。',
    },
    notes: ['分流策略在「规则集」步骤中选择：白名单=国外全代理，黑名单=仅 GFW 代理。'],
  },
  {
    id: 'streaming',
    name: '流媒体解锁',
    emoji: '🎬',
    summary: 'Netflix / Disney+ / Spotify 等分区内容',
    desc: '为流媒体单独建组，方便指定「解锁能力最强」的那个节点，而不影响其他流量的选路。',
    baseRuleSets: [],
    groupName: '流媒体',
    groupIcon: '🎬',
    groupType: 'select',
    questions: [
      {
        id: 'platforms',
        title: '你需要解锁哪些平台？',
        desc: '勾选后会加入对应规则集，并把这些域名指向「流媒体」策略组。',
        type: 'multi',
        options: [
          { label: 'Netflix', value: 'netflix', ruleSets: ['stream-netflix'] },
          { label: 'Disney+', value: 'disney', ruleSets: ['stream-disney'] },
          { label: 'HBO Max', value: 'hbo', ruleSets: ['stream-hbo'] },
          { label: 'Prime Video', value: 'prime', ruleSets: ['stream-prime'] },
          { label: 'YouTube', value: 'youtube', ruleSets: ['stream-youtube'] },
          { label: 'Spotify', value: 'spotify', ruleSets: ['stream-spotify'] },
          { label: 'TikTok', value: 'tiktok', ruleSets: ['stream-tiktok'] },
          { label: 'Hulu', value: 'hulu', ruleSets: ['stream-hulu'] },
          { label: 'Twitch', value: 'twitch', ruleSets: ['stream-twitch'] },
          {
            label: '哔哩哔哩（港澳台独播）',
            value: 'bili',
            ruleSets: ['stream-bilibili'],
            desc: '常规情况直连即可，仅解锁限区番剧时需要走代理',
          },
        ],
      },
      {
        id: 'mode',
        title: '解锁节点怎么安排？',
        type: 'single',
        options: [
          { label: '手动指定节点（推荐）', value: 'manual', desc: '生成 select 组，你在客户端里固定选一个解锁节点' },
          { label: '自动选最快', value: 'auto', desc: '生成 urltest 组，按延迟自动挑（可能选到不解锁的节点）' },
        ],
      },
    ],
    deviceTips: {
      client: '手机上的 Netflix App 无法走 HTTP 代理，必须开 TUN 才能生效。',
      sidecar: '电视盒子、Apple TV 这类设备走旁路由时，DNS 需要被劫持到代理端，否则域名解析会绕过规则。',
      router: '路由器上建议只保留你实际在看的 1~3 个平台规则集，减少内存占用。',
    },
    notes: ['流媒体解锁依赖节点本身的出口地区，规则只负责「把流量送到指定节点」。'],
  },
  {
    id: 'ai',
    name: 'AI 服务',
    emoji: '🤖',
    summary: 'ChatGPT、Claude、Gemini 等大模型',
    desc: 'AI 服务对出口 IP 地区敏感，单独分组可以避免因为自动测速切换到不支持的地区。',
    baseRuleSets: [],
    groupName: 'AI 服务',
    groupIcon: '🤖',
    groupType: 'select',
    questions: [
      {
        id: 'services',
        title: '你主要用哪些 AI 服务？',
        type: 'multi',
        options: [
          { label: 'OpenAI / ChatGPT', value: 'openai', ruleSets: ['ai-openai'] },
          { label: 'Anthropic Claude', value: 'anthropic', ruleSets: ['ai-anthropic'] },
          { label: 'Google Gemini', value: 'gemini', ruleSets: ['ai-google'] },
          { label: 'Hugging Face', value: 'hf', ruleSets: ['ai-huggingface'] },
          { label: 'Midjourney', value: 'mj', ruleSets: ['ai-midjourney'] },
        ],
      },
    ],
    deviceTips: {
      client: '浏览器插件类 AI 工具走系统代理即可，不需要额外配置。',
      sidecar: '如果有家庭成员不需要用 AI，可在客户端侧单独指定，不必在网关层拆规则。',
      router: 'AI 类规则集体量都很小，路由器上放心开启。',
    },
  },
  {
    id: 'dev',
    name: '开发资源',
    emoji: '🛠',
    summary: 'GitHub、Docker、包管理器、搜索',
    desc: '解决 clone 慢、镜像拉不动、npm / pip 超时等问题，同时避免整个开发环境都走代理拖慢国内源。',
    baseRuleSets: [],
    groupName: '开发资源',
    groupIcon: '🛠',
    groupType: 'select',
    questions: [
      {
        id: 'services',
        title: '哪些开发服务需要走代理？',
        type: 'multi',
        options: [
          { label: 'GitHub', value: 'github', ruleSets: ['dev-github'], desc: '含 raw.githubusercontent 与 API' },
          { label: 'GitLab', value: 'gitlab', ruleSets: ['dev-gitlab'] },
          { label: 'Docker Hub', value: 'docker', ruleSets: ['dev-docker'] },
          { label: 'StackOverflow', value: 'so', ruleSets: ['dev-stackoverflow'] },
          { label: 'Cloudflare', value: 'cf', ruleSets: ['dev-cloudflare'] },
          { label: 'Microsoft / Azure', value: 'ms', ruleSets: ['dev-microsoft'] },
          { label: 'Apple 开发者', value: 'apple', ruleSets: ['dev-apple'] },
        ],
      },
    ],
    deviceTips: {
      client: '终端里记得单独设置 http_proxy 环境变量，或用 TUN 全局接管。',
      sidecar: 'CI 机器、NAS 走旁路由拉取镜像时，Docker 的 daemon 需要单独配置代理。',
      router: '开发类规则集都很小，对路由器几乎无压力。',
    },
  },
  {
    id: 'game',
    name: '游戏加速',
    emoji: '🎮',
    summary: 'Steam、主机平台、联机 CDN',
    desc: '游戏流量以 UDP 为主，且对延迟敏感。应优先选择延迟低、支持 UDP 的节点。',
    baseRuleSets: [],
    groupName: '游戏加速',
    groupIcon: '🎮',
    groupType: 'urltest',
    questions: [
      {
        id: 'platforms',
        title: '主要玩哪个平台？',
        type: 'multi',
        options: [
          { label: 'Steam', value: 'steam', ruleSets: ['game-steam'] },
          { label: 'PlayStation', value: 'ps', ruleSets: ['game-playstation'] },
          { label: 'Xbox', value: 'xbox', ruleSets: ['game-xbox'] },
          { label: 'Nintendo', value: 'ns', ruleSets: ['game-nintendo'] },
          {
            label: '全部游戏（聚合）',
            value: 'all',
            ruleSets: ['game-category'],
            desc: '一个规则集覆盖主流游戏，体量中等',
          },
        ],
      },
      {
        id: 'udp',
        title: 'UDP 处理方式',
        type: 'single',
        options: [
          { label: '开启 UDP 转发（推荐）', value: 'on', desc: '联机、语音、QUIC 类游戏必需' },
          { label: '关闭', value: 'off', desc: '节点不支持 UDP 时关闭，避免连接失败' },
        ],
      },
    ],
    deviceTips: {
      client: '游戏机（PS5 / Switch）无法设置代理，需要通过 TUN 或旁路由接入。',
      sidecar: '主机走旁路由时网关和 DNS 都要指向旁路由，且需要开启 UDP 转发。',
      router: '路由器上建议开启 UDP 并关闭「IPv6」，很多联机问题源于 IPv6 走不通。',
    },
    notes: ['Hysteria2 / TUIC 这类基于 QUIC 的协议对游戏延迟更友好。'],
  },
  {
    id: 'social',
    name: '社交通讯',
    emoji: '💬',
    summary: 'Telegram、X、Discord 等',
    desc: '社交通讯往往需要稳定的长连接，单独分组可避免自动测速来回切换导致消息重连。',
    baseRuleSets: [],
    groupName: '社交通讯',
    groupIcon: '💬',
    groupType: 'select',
    questions: [
      {
        id: 'services',
        title: '需要代理哪些平台？',
        type: 'multi',
        options: [
          { label: 'Telegram', value: 'tg', ruleSets: ['social-telegram'] },
          { label: 'X / Twitter', value: 'x', ruleSets: ['social-twitter'] },
          { label: 'Instagram', value: 'ig', ruleSets: ['social-instagram'] },
          { label: 'Facebook', value: 'fb', ruleSets: ['social-facebook'] },
          { label: 'Discord', value: 'dc', ruleSets: ['social-discord'] },
          { label: 'WhatsApp', value: 'wa', ruleSets: ['social-whatsapp'] },
          { label: 'Reddit', value: 'reddit', ruleSets: ['social-reddit'] },
          { label: 'LINE', value: 'line', ruleSets: ['social-line'] },
        ],
      },
    ],
    deviceTips: {
      client: 'Discord 语音走 UDP，节点不支持 UDP 时会连不上语音频道。',
      sidecar: '无特殊要求，常规配置即可。',
      router: '无特殊要求。',
    },
  },
  {
    id: 'work',
    name: '办公协同',
    emoji: '📎',
    summary: 'Notion、Slack、Figma 等 SaaS',
    desc: '办公工具全天在线，单独分组可以固定一个稳定节点，避免频繁切换。',
    baseRuleSets: [],
    groupName: '办公协同',
    groupIcon: '📎',
    groupType: 'select',
    questions: [
      {
        id: 'services',
        title: '常用哪些办公工具？',
        type: 'multi',
        options: [
          { label: 'Notion', value: 'notion', ruleSets: ['work-notion'] },
          { label: 'Slack', value: 'slack', ruleSets: ['work-slack'] },
          { label: 'Zoom', value: 'zoom', ruleSets: ['work-zoom'] },
          { label: 'Figma', value: 'figma', ruleSets: ['work-figma'] },
          { label: 'Dropbox', value: 'db', ruleSets: ['work-dropbox'] },
        ],
      },
    ],
    deviceTips: {
      client: 'Zoom 会议对丢包敏感，建议固定节点而不是自动测速。',
      sidecar: '无特殊要求。',
      router: '无特殊要求。',
    },
  },
  {
    id: 'privacy',
    name: '广告拦截',
    emoji: '🛡',
    summary: '拦截广告、追踪与统计',
    desc: '在 DNS 与路由层拦截广告域名，对所有接入设备生效，比浏览器插件更彻底。',
    baseRuleSets: [],
    groupName: '广告拦截',
    groupIcon: '🛡',
    groupType: 'reject',
    questions: [
      {
        id: 'level',
        title: '拦截强度',
        type: 'single',
        options: [
          { label: '保守（推荐）', value: 'basic', ruleSets: ['ads-basic'], desc: '只拦主流广告，误伤少' },
          { label: '激进', value: 'all', ruleSets: ['ads-all'], desc: '拦截最彻底，可能误伤部分网站的统计与登录' },
        ],
      },
    ],
    deviceTips: {
      client: '拦截后若某个网站异常，可在面板的「绕过」里临时放行。',
      sidecar: '全屋设备生效，家里老人小孩的设备也能受益。',
      router: '激进模式规则集较大，低内存路由器建议用保守模式。',
    },
  },
  {
    id: 'academic',
    name: '学术资源',
    emoji: '📚',
    summary: '维基百科、Google 学术',
    desc: '学术类站点通常需要稳定访问，单独分组便于指定到适合的节点。',
    baseRuleSets: [],
    groupName: '学术资源',
    groupIcon: '📚',
    groupType: 'select',
    questions: [
      {
        id: 'services',
        title: '需要哪些资源？',
        type: 'multi',
        options: [
          { label: '维基百科', value: 'wiki', ruleSets: ['aca-wikipedia'] },
          { label: 'Google 学术', value: 'scholar', ruleSets: ['aca-google-scholar'] },
        ],
      },
    ],
    deviceTips: {
      client: '无特殊要求。',
      sidecar: '无特殊要求。',
      router: '无特殊要求。',
    },
  },
  {
    id: 'news',
    name: '新闻资讯',
    emoji: '📰',
    summary: 'BBC、纽约时报、彭博社等国际媒体',
    desc: '国际媒体站点单独分组，固定一个出口稳定的节点，避免刷新闻时 IP 频繁变化触发风控。',
    baseRuleSets: [],
    groupName: '新闻资讯',
    groupIcon: '📰',
    groupType: 'select',
    questions: [
      {
        id: 'sources',
        title: '常看哪些媒体？',
        type: 'multi',
        options: [
          { label: 'BBC', value: 'bbc', ruleSets: ['news-bbc'] },
          { label: '纽约时报', value: 'nytimes', ruleSets: ['news-nytimes'] },
          { label: '彭博社', value: 'bloomberg', ruleSets: ['news-bloomberg'] },
          { label: '经济学人', value: 'economist', ruleSets: ['news-economist'] },
          { label: '路透社', value: 'reuters', ruleSets: ['news-reuters'] },
        ],
      },
    ],
    deviceTips: {
      client: '无特殊要求。',
      sidecar: '无特殊要求。',
      router: '新闻类规则集体量小，路由器可放心开启。',
    },
  },
  {
    id: 'finance',
    name: '金融交易',
    emoji: '💰',
    summary: 'PayPal、交易所、支付网络',
    desc: '交易类服务对 IP 一致性极其敏感：下单途中换节点可能触发风控甚至冻结账户，务必固定节点。',
    baseRuleSets: [],
    groupName: '金融交易',
    groupIcon: '💰',
    groupType: 'select',
    questions: [
      {
        id: 'services',
        title: '使用哪些金融服务？',
        type: 'multi',
        options: [
          { label: 'PayPal', value: 'paypal', ruleSets: ['fin-paypal'] },
          { label: '币安 Binance', value: 'binance', ruleSets: ['fin-binance'] },
          { label: 'OKX', value: 'okx', ruleSets: ['fin-okx'] },
          { label: 'Visa / 万事达', value: 'cards', ruleSets: ['fin-visa'] },
        ],
      },
    ],
    deviceTips: {
      client: '交易期间建议手动锁定一个节点，不要用自动测速组。',
      sidecar: '交易设备可单独用「来源 IP」自定义规则指定走金融组。',
      router: '全屋生效时注意：家人设备访问支付网站也会走这个组。',
    },
    notes: ['金融类流量务必固定节点；若账户风控严格，建议直接直连或用独立设备。'],
  },
  {
    id: 'cloud',
    name: '云盘同步',
    emoji: '☁️',
    summary: 'OneDrive、Dropbox、iCloud 等',
    desc: '同步盘常年后台跑流量，单独分组可以指定到大带宽节点，也可设为直连走国内中转。',
    baseRuleSets: [],
    groupName: '云盘同步',
    groupIcon: '☁️',
    groupType: 'select',
    questions: [
      {
        id: 'services',
        title: '使用哪些云盘？',
        type: 'multi',
        options: [
          { label: 'OneDrive', value: 'onedrive', ruleSets: ['cloud-onedrive'] },
          { label: 'Dropbox', value: 'dropbox', ruleSets: ['cloud-dropbox'] },
          { label: 'iCloud', value: 'icloud', ruleSets: ['cloud-icloud'], desc: '国内访问 iCloud 一般直连更快' },
          { label: 'MEGA', value: 'mega', ruleSets: ['cloud-mega'] },
        ],
      },
    ],
    deviceTips: {
      client: 'iCloud 照片同步走直连通常更快，可通过自定义规则单独指定。',
      sidecar: 'NAS 上的同步工具建议用「来源 IP」规则单独指定出口。',
      router: '同步盘上传会持续占用带宽，路由器上建议限制到实际使用的云盘。',
    },
  },
  {
    id: 'creative',
    name: '创作素材',
    emoji: '🎨',
    summary: 'Pixiv、Pinterest、DeviantArt 等',
    desc: '图站对图片 CDN 依赖大，单独分组可选图片加载快的节点。',
    baseRuleSets: [],
    groupName: '创作素材',
    groupIcon: '🎨',
    groupType: 'select',
    questions: [
      {
        id: 'sites',
        title: '常逛哪些站点？',
        type: 'multi',
        options: [
          { label: 'Pixiv', value: 'pixiv', ruleSets: ['creative-pixiv'] },
          { label: 'Pinterest', value: 'pinterest', ruleSets: ['creative-pinterest'] },
          { label: 'DeviantArt', value: 'deviantart', ruleSets: ['creative-deviantart'] },
          { label: 'Behance', value: 'behance', ruleSets: ['creative-behance'] },
        ],
      },
    ],
    deviceTips: {
      client: '无特殊要求。',
      sidecar: '无特殊要求。',
      router: '图站流量以图片为主，建议选择下载带宽大的节点。',
    },
  },
  {
    id: 'accel',
    name: '直连加速',
    emoji: '🚄',
    summary: 'Apple / 微软 / Steam 国内 CDN 强制直连',
    desc: 'Apple、微软、Steam 等在国内有 CDN，走代理反而慢。勾选后这些域名强制直连，是「国内网站打开慢」最常见的原因之一。',
    baseRuleSets: [],
    groupName: '直连加速',
    groupIcon: '🚄',
    groupType: 'select',
    questions: [
      {
        id: 'services',
        title: '哪些服务强制直连？',
        type: 'multi',
        options: [
          { label: 'Apple（更新/App Store）', value: 'apple', ruleSets: ['accel-apple'] },
          { label: 'Microsoft（更新/Office）', value: 'microsoft', ruleSets: ['accel-microsoft'] },
          {
            label: 'Steam 国内 CDN',
            value: 'steam',
            ruleSets: ['accel-steam-cn'],
            desc: '仅在需要从国内 CDN 下载时勾选，海外独占游戏下载仍可走代理',
          },
          { label: 'Xbox 国内 CDN', value: 'xbox', ruleSets: ['accel-xbox-cn'] },
        ],
      },
    ],
    deviceTips: {
      client: '如果你需要访问 Apple/微软的境外服务（如美区 App Store），请勿勾选对应项。',
      sidecar: '全屋直连 Apple/微软更新，能明显减轻网关带宽压力。',
      router: '强烈建议路由器开启：大文件更新走直连，既快又省代理流量。',
    },
    notes: ['直连加速的规则优先级高于场景策略组，命中后不再走代理。'],
  },
];

export const SCENARIO_MAP: Record<string, ScenarioDef> = Object.fromEntries(SCENARIOS.map((s) => [s.id, s]));

/** 规则集 id -> 所属场景 */
export const RULESET_TO_SCENARIO: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  for (const s of SCENARIOS) {
    for (const rs of s.baseRuleSets) map[rs] = s.id;
    for (const q of s.questions) {
      for (const o of q.options) {
        for (const rs of o.ruleSets || []) map[rs] = s.id;
      }
    }
  }
  return map;
})();
