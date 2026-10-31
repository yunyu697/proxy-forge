/**
 * 规则集清单
 *
 * 默认来源：MetaCubeX/meta-rules-dat
 *  - mihomo   -> meta 分支的 .mrs（Meta Rule Set，mihomo 原生支持，体积小、加载快）
 *  - sing-box -> sing 分支的 .srs（sing-box 原生 remote rule_set）
 * 两者由同一份 domain-list-community / geoip 数据编译而来，语义一致。
 *
 * 所有 URL 均可在界面中切换镜像源或直接改写，也支持添加自己的规则集。
 */

export type RuleSetGroup =
  | 'geo'
  | 'ads'
  | 'stream'
  | 'ai'
  | 'dev'
  | 'game'
  | 'social'
  | 'work'
  | 'academic'
  | 'news'
  | 'finance'
  | 'cloud'
  | 'creative'
  | 'accel';

export const RULESET_GROUPS: { id: RuleSetGroup; name: string; desc: string }[] = [
  { id: 'geo', name: '地理与基础', desc: '国内/境外/局域网/GFW 等分流基石' },
  { id: 'ads', name: '广告与隐私', desc: '拦截广告、追踪与统计域名' },
  { id: 'stream', name: '流媒体', desc: 'Netflix、Disney+、Spotify 等解锁' },
  { id: 'ai', name: 'AI 服务', desc: 'OpenAI、Claude、Gemini 等大模型服务' },
  { id: 'dev', name: '开发资源', desc: 'GitHub、Docker、包管理器、搜索引擎' },
  { id: 'game', name: '游戏联机', desc: 'Steam、主机平台、游戏 CDN' },
  { id: 'social', name: '社交通讯', desc: 'Telegram、X、Discord 等' },
  { id: 'work', name: '办公协同', desc: 'Notion、Slack、Figma 等 SaaS' },
  { id: 'academic', name: '学术资源', desc: '维基百科、学术站点' },
  { id: 'news', name: '新闻资讯', desc: 'BBC、纽约时报等国际媒体' },
  { id: 'finance', name: '金融交易', desc: '支付、交易所与行情服务' },
  { id: 'cloud', name: '云盘同步', desc: 'OneDrive、Dropbox 等同步盘' },
  { id: 'creative', name: '创作素材', desc: 'Pixiv、Pinterest 等灵感来源' },
  { id: 'accel', name: '直连加速', desc: 'Apple/微软/Steam 等国内 CDN 快的服务强制直连' },
];

export interface RuleSetDef {
  id: string;
  name: string;
  desc: string;
  group: RuleSetGroup;
  /** domain 走域名匹配，ipcidr 走 IP 匹配 */
  kind: 'domain' | 'ipcidr';
  /** 相对 meta-rules-dat 仓库根的路径（不含分支与扩展名），如 geo/geosite/cn */
  path: string;
  /** 规则体量：路由器等弱设备会提示慎用 large */
  size: 'small' | 'medium' | 'large';
  /** 命中后的建议动作 */
  action: 'proxy' | 'direct' | 'reject';
  /** 是否为核心规则（几乎所有场景都需要） */
  core?: boolean;
}

export const RULESET_REPO = 'MetaCubeX/meta-rules-dat';
export const MIHOMO_BRANCH = 'meta';
export const SINGBOX_BRANCH = 'sing';

export const SIZE_LABELS: Record<RuleSetDef['size'], string> = {
  small: '轻量',
  medium: '中等',
  large: '较大',
};

export const RULESETS: RuleSetDef[] = [
  /* ------------------------------ 地理与基础 ------------------------------ */
  {
    id: 'geo-cn-domain',
    name: '中国大陆域名',
    desc: '主流中文站点、国内服务域名，通常直连',
    group: 'geo',
    kind: 'domain',
    path: 'geo/geosite/cn',
    size: 'large',
    action: 'direct',
    core: true,
  },
  {
    id: 'geo-cn-ip',
    name: '中国大陆 IP 段',
    desc: '补齐纯 IP 访问的国内服务，避免解析不出域名时误走代理',
    group: 'geo',
    kind: 'ipcidr',
    path: 'geo/geoip/cn',
    size: 'large',
    action: 'direct',
    core: true,
  },
  {
    id: 'geo-private',
    name: '局域网 / 私有地址',
    desc: '192.168、10.x 等内网地址，旁路由与路由器必须直连',
    group: 'geo',
    kind: 'ipcidr',
    path: 'geo/geoip/private',
    size: 'small',
    action: 'direct',
    core: true,
  },
  {
    id: 'geo-notcn-domain',
    name: '境外域名',
    desc: '非中国大陆站点，配合白名单模式做「国外走代理」',
    group: 'geo',
    kind: 'domain',
    path: 'geo/geosite/geolocation-!cn',
    size: 'large',
    action: 'proxy',
  },
  {
    id: 'geo-gfw',
    name: 'GFWList',
    desc: '经典被墙域名清单，黑名单模式下用它做最小代理集合',
    group: 'geo',
    kind: 'domain',
    path: 'geo/geosite/gfw',
    size: 'medium',
    action: 'proxy',
  },
  {
    id: 'geo-hk',
    name: '中国香港',
    desc: '香港站点，适合港服流媒体与游戏',
    group: 'geo',
    kind: 'domain',
    path: 'geo/geosite/hk',
    size: 'small',
    action: 'proxy',
  },
  {
    id: 'geo-jp',
    name: '日本',
    desc: '日本站点，适合日服流媒体与游戏',
    group: 'geo',
    kind: 'domain',
    path: 'geo/geosite/jp',
    size: 'small',
    action: 'proxy',
  },
  {
    id: 'geo-us',
    name: '美国',
    desc: '美国站点，多数海外服务的落地区域',
    group: 'geo',
    kind: 'domain',
    path: 'geo/geosite/us',
    size: 'medium',
    action: 'proxy',
  },

  /* ------------------------------ 广告与隐私 ------------------------------ */
  {
    id: 'ads-all',
    name: '广告拦截（激进）',
    desc: '汇总全部广告分类，拦截最彻底，可能误伤少量统计脚本',
    group: 'ads',
    kind: 'domain',
    path: 'geo/geosite/category-ads-all',
    size: 'large',
    action: 'reject',
  },
  {
    id: 'ads-basic',
    name: '广告拦截（保守）',
    desc: '仅主流广告域名，误伤率低',
    group: 'ads',
    kind: 'domain',
    path: 'geo/geosite/category-ads',
    size: 'medium',
    action: 'reject',
  },

  /* -------------------------------- 流媒体 -------------------------------- */
  {
    id: 'stream-netflix',
    name: 'Netflix',
    desc: '含 Netflix 主站与 CDN 域名',
    group: 'stream',
    kind: 'domain',
    path: 'geo/geosite/netflix',
    size: 'medium',
    action: 'proxy',
  },
  {
    id: 'stream-disney',
    name: 'Disney+',
    desc: '迪士尼流媒体',
    group: 'stream',
    kind: 'domain',
    path: 'geo/geosite/disney',
    size: 'small',
    action: 'proxy',
  },
  {
    id: 'stream-hbo',
    name: 'HBO Max',
    desc: 'HBO 流媒体',
    group: 'stream',
    kind: 'domain',
    path: 'geo/geosite/hbo',
    size: 'small',
    action: 'proxy',
  },
  {
    id: 'stream-prime',
    name: 'Prime Video',
    desc: '亚马逊 Prime Video',
    group: 'stream',
    kind: 'domain',
    path: 'geo/geosite/amazon',
    size: 'small',
    action: 'proxy',
  },
  {
    id: 'stream-youtube',
    name: 'YouTube',
    desc: '含 YouTube 与部分 Google Video CDN',
    group: 'stream',
    kind: 'domain',
    path: 'geo/geosite/youtube',
    size: 'small',
    action: 'proxy',
  },
  {
    id: 'stream-spotify',
    name: 'Spotify',
    desc: 'Spotify 客户端与网页播放器',
    group: 'stream',
    kind: 'domain',
    path: 'geo/geosite/spotify',
    size: 'small',
    action: 'proxy',
  },
  {
    id: 'stream-tiktok',
    name: 'TikTok',
    desc: 'TikTok 与相关 CDN',
    group: 'stream',
    kind: 'domain',
    path: 'geo/geosite/tiktok',
    size: 'medium',
    action: 'proxy',
  },
  {
    id: 'stream-hulu',
    name: 'Hulu',
    desc: 'Hulu 流媒体',
    group: 'stream',
    kind: 'domain',
    path: 'geo/geosite/hulu',
    size: 'small',
    action: 'proxy',
  },
  {
    id: 'stream-twitch',
    name: 'Twitch',
    desc: 'Twitch 直播与 CDN',
    group: 'stream',
    kind: 'domain',
    path: 'geo/geosite/twitch',
    size: 'small',
    action: 'proxy',
  },
  {
    id: 'stream-bilibili',
    name: '哔哩哔哩',
    desc: '国内站点，通常直连；解锁港澳台独播时可单独指定代理',
    group: 'stream',
    kind: 'domain',
    path: 'geo/geosite/bilibili',
    size: 'small',
    action: 'direct',
  },

  /* ------------------------------- AI 服务 -------------------------------- */
  {
    id: 'ai-openai',
    name: 'OpenAI',
    desc: 'ChatGPT、API、Sora 相关域名',
    group: 'ai',
    kind: 'domain',
    path: 'geo/geosite/openai',
    size: 'small',
    action: 'proxy',
  },
  {
    id: 'ai-anthropic',
    name: 'Anthropic Claude',
    desc: 'Claude 网页与 API',
    group: 'ai',
    kind: 'domain',
    path: 'geo/geosite/anthropic',
    size: 'small',
    action: 'proxy',
  },
  {
    id: 'ai-google',
    name: 'Google AI',
    desc: 'Gemini、Bard 与 Google 全家桶',
    group: 'ai',
    kind: 'domain',
    path: 'geo/geosite/google',
    size: 'medium',
    action: 'proxy',
  },
  {
    id: 'ai-huggingface',
    name: 'Hugging Face',
    desc: '模型与数据集托管',
    group: 'ai',
    kind: 'domain',
    path: 'geo/geosite/huggingface',
    size: 'small',
    action: 'proxy',
  },
  {
    id: 'ai-midjourney',
    name: 'Midjourney',
    desc: 'Midjourney 与 Discord 相关入口',
    group: 'ai',
    kind: 'domain',
    path: 'geo/geosite/midjourney',
    size: 'small',
    action: 'proxy',
  },

  /* ------------------------------- 开发资源 ------------------------------- */
  {
    id: 'dev-github',
    name: 'GitHub',
    desc: '含 githubusercontent、raw、API',
    group: 'dev',
    kind: 'domain',
    path: 'geo/geosite/github',
    size: 'small',
    action: 'proxy',
  },
  {
    id: 'dev-gitlab',
    name: 'GitLab',
    desc: 'GitLab 与自托管相关域名',
    group: 'dev',
    kind: 'domain',
    path: 'geo/geosite/gitlab',
    size: 'small',
    action: 'proxy',
  },
  {
    id: 'dev-docker',
    name: 'Docker',
    desc: 'Docker Hub 与 Registry',
    group: 'dev',
    kind: 'domain',
    path: 'geo/geosite/docker',
    size: 'small',
    action: 'proxy',
  },
  {
    id: 'dev-stackoverflow',
    name: 'StackOverflow',
    desc: 'StackOverflow 与 StackExchange',
    group: 'dev',
    kind: 'domain',
    path: 'geo/geosite/stackoverflow',
    size: 'small',
    action: 'proxy',
  },
  {
    id: 'dev-cloudflare',
    name: 'Cloudflare',
    desc: 'Cloudflare 相关服务与 CDN',
    group: 'dev',
    kind: 'domain',
    path: 'geo/geosite/cloudflare',
    size: 'small',
    action: 'proxy',
  },
  {
    id: 'dev-microsoft',
    name: 'Microsoft',
    desc: '微软服务与 Azure CDN',
    group: 'dev',
    kind: 'domain',
    path: 'geo/geosite/microsoft',
    size: 'medium',
    action: 'proxy',
  },
  {
    id: 'dev-apple',
    name: 'Apple',
    desc: 'Apple 服务与 App Store CDN',
    group: 'dev',
    kind: 'domain',
    path: 'geo/geosite/apple',
    size: 'small',
    action: 'proxy',
  },

  /* -------------------------------- 游戏 ---------------------------------- */
  {
    id: 'game-category',
    name: '游戏聚合',
    desc: '游戏分类汇总：Steam、主机平台、游戏 CDN',
    group: 'game',
    kind: 'domain',
    path: 'geo/geosite/category-games',
    size: 'medium',
    action: 'proxy',
  },
  {
    id: 'game-steam',
    name: 'Steam',
    desc: 'Steam 商店、社区与下载 CDN',
    group: 'game',
    kind: 'domain',
    path: 'geo/geosite/steam',
    size: 'small',
    action: 'proxy',
  },
  {
    id: 'game-playstation',
    name: 'PlayStation',
    desc: 'PSN 商店与联机服务',
    group: 'game',
    kind: 'domain',
    path: 'geo/geosite/playstation',
    size: 'small',
    action: 'proxy',
  },
  {
    id: 'game-xbox',
    name: 'Xbox',
    desc: 'Xbox Live 与商店',
    group: 'game',
    kind: 'domain',
    path: 'geo/geosite/xbox',
    size: 'small',
    action: 'proxy',
  },
  {
    id: 'game-nintendo',
    name: 'Nintendo',
    desc: '任天堂 eShop 与联机',
    group: 'game',
    kind: 'domain',
    path: 'geo/geosite/nintendo',
    size: 'small',
    action: 'proxy',
  },

  /* ------------------------------- 社交通讯 ------------------------------- */
  {
    id: 'social-telegram',
    name: 'Telegram',
    desc: 'Telegram 网页与客户端',
    group: 'social',
    kind: 'domain',
    path: 'geo/geosite/telegram',
    size: 'small',
    action: 'proxy',
  },
  {
    id: 'social-twitter',
    name: 'X / Twitter',
    desc: 'X 与 twimg 等 CDN',
    group: 'social',
    kind: 'domain',
    path: 'geo/geosite/twitter',
    size: 'small',
    action: 'proxy',
  },
  {
    id: 'social-instagram',
    name: 'Instagram',
    desc: 'Instagram 与 Facebook CDN',
    group: 'social',
    kind: 'domain',
    path: 'geo/geosite/instagram',
    size: 'small',
    action: 'proxy',
  },
  {
    id: 'social-facebook',
    name: 'Facebook',
    desc: 'Facebook 与 Messenger',
    group: 'social',
    kind: 'domain',
    path: 'geo/geosite/facebook',
    size: 'small',
    action: 'proxy',
  },
  {
    id: 'social-discord',
    name: 'Discord',
    desc: 'Discord 客户端与语音',
    group: 'social',
    kind: 'domain',
    path: 'geo/geosite/discord',
    size: 'small',
    action: 'proxy',
  },
  {
    id: 'social-whatsapp',
    name: 'WhatsApp',
    desc: 'WhatsApp 与 Meta CDN',
    group: 'social',
    kind: 'domain',
    path: 'geo/geosite/whatsapp',
    size: 'small',
    action: 'proxy',
  },
  {
    id: 'social-reddit',
    name: 'Reddit',
    desc: 'Reddit 与媒体 CDN',
    group: 'social',
    kind: 'domain',
    path: 'geo/geosite/reddit',
    size: 'small',
    action: 'proxy',
  },
  {
    id: 'social-line',
    name: 'LINE',
    desc: 'LINE 通讯',
    group: 'social',
    kind: 'domain',
    path: 'geo/geosite/line',
    size: 'small',
    action: 'proxy',
  },

  /* ------------------------------- 办公协同 ------------------------------- */
  {
    id: 'work-notion',
    name: 'Notion',
    desc: 'Notion 与资源 CDN',
    group: 'work',
    kind: 'domain',
    path: 'geo/geosite/notion',
    size: 'small',
    action: 'proxy',
  },
  {
    id: 'work-slack',
    name: 'Slack',
    desc: 'Slack 客户端与文件 CDN',
    group: 'work',
    kind: 'domain',
    path: 'geo/geosite/slack',
    size: 'small',
    action: 'proxy',
  },
  {
    id: 'work-zoom',
    name: 'Zoom',
    desc: 'Zoom 会议服务',
    group: 'work',
    kind: 'domain',
    path: 'geo/geosite/zoom',
    size: 'small',
    action: 'proxy',
  },
  {
    id: 'work-figma',
    name: 'Figma',
    desc: 'Figma 设计与 CDN',
    group: 'work',
    kind: 'domain',
    path: 'geo/geosite/figma',
    size: 'small',
    action: 'proxy',
  },
  {
    id: 'work-dropbox',
    name: 'Dropbox',
    desc: 'Dropbox 同步',
    group: 'work',
    kind: 'domain',
    path: 'geo/geosite/dropbox',
    size: 'small',
    action: 'proxy',
  },

  /* ------------------------------- 学术资源 ------------------------------- */
  {
    id: 'aca-wikipedia',
    name: '维基百科',
    desc: 'Wikipedia 全语言',
    group: 'academic',
    kind: 'domain',
    path: 'geo/geosite/wikipedia',
    size: 'small',
    action: 'proxy',
  },
  {
    id: 'aca-google-scholar',
    name: 'Google 学术',
    desc: 'Google Scholar 相关',
    group: 'academic',
    kind: 'domain',
    path: 'geo/geosite/scholar',
    size: 'small',
    action: 'proxy',
  },

  /* ------------------------------- 新闻资讯 ------------------------------- */
  {
    id: 'news-bbc',
    name: 'BBC',
    desc: 'BBC 新闻与 iPlayer',
    group: 'news',
    kind: 'domain',
    path: 'geo/geosite/bbc',
    size: 'small',
    action: 'proxy',
  },
  {
    id: 'news-nytimes',
    name: '纽约时报',
    desc: 'The New York Times',
    group: 'news',
    kind: 'domain',
    path: 'geo/geosite/nytimes',
    size: 'small',
    action: 'proxy',
  },
  {
    id: 'news-bloomberg',
    name: '彭博社',
    desc: 'Bloomberg 新闻与终端',
    group: 'news',
    kind: 'domain',
    path: 'geo/geosite/bloomberg',
    size: 'small',
    action: 'proxy',
  },
  {
    id: 'news-economist',
    name: '经济学人',
    desc: 'The Economist',
    group: 'news',
    kind: 'domain',
    path: 'geo/geosite/economist',
    size: 'small',
    action: 'proxy',
  },
  {
    id: 'news-reuters',
    name: '路透社',
    desc: 'Reuters 新闻',
    group: 'news',
    kind: 'domain',
    path: 'geo/geosite/reuters',
    size: 'small',
    action: 'proxy',
  },

  /* ------------------------------- 金融交易 ------------------------------- */
  {
    id: 'fin-paypal',
    name: 'PayPal',
    desc: 'PayPal 支付与商户',
    group: 'finance',
    kind: 'domain',
    path: 'geo/geosite/paypal',
    size: 'small',
    action: 'proxy',
  },
  {
    id: 'fin-binance',
    name: '币安 Binance',
    desc: '币安交易所',
    group: 'finance',
    kind: 'domain',
    path: 'geo/geosite/binance',
    size: 'small',
    action: 'proxy',
  },
  {
    id: 'fin-okx',
    name: 'OKX',
    desc: 'OKX 交易所',
    group: 'finance',
    kind: 'domain',
    path: 'geo/geosite/okx',
    size: 'small',
    action: 'proxy',
  },
  {
    id: 'fin-visa',
    name: 'Visa / 万事达',
    desc: '卡组织与支付网络',
    group: 'finance',
    kind: 'domain',
    path: 'geo/geosite/category-financial',
    size: 'medium',
    action: 'proxy',
  },

  /* ------------------------------- 云盘同步 ------------------------------- */
  {
    id: 'cloud-onedrive',
    name: 'OneDrive',
    desc: '微软 OneDrive 同步',
    group: 'cloud',
    kind: 'domain',
    path: 'geo/geosite/onedrive',
    size: 'small',
    action: 'proxy',
  },
  {
    id: 'cloud-dropbox',
    name: 'Dropbox',
    desc: 'Dropbox 同步',
    group: 'cloud',
    kind: 'domain',
    path: 'geo/geosite/dropbox',
    size: 'small',
    action: 'proxy',
  },
  {
    id: 'cloud-icloud',
    name: 'iCloud',
    desc: 'iCloud 与 Apple 同步服务',
    group: 'cloud',
    kind: 'domain',
    path: 'geo/geosite/icloud',
    size: 'small',
    action: 'proxy',
  },
  {
    id: 'cloud-mega',
    name: 'MEGA',
    desc: 'MEGA 网盘',
    group: 'cloud',
    kind: 'domain',
    path: 'geo/geosite/mega',
    size: 'small',
    action: 'proxy',
  },

  /* ------------------------------- 创作素材 ------------------------------- */
  {
    id: 'creative-pixiv',
    name: 'Pixiv',
    desc: 'Pixiv 插画社区',
    group: 'creative',
    kind: 'domain',
    path: 'geo/geosite/pixiv',
    size: 'small',
    action: 'proxy',
  },
  {
    id: 'creative-pinterest',
    name: 'Pinterest',
    desc: 'Pinterest 图片灵感',
    group: 'creative',
    kind: 'domain',
    path: 'geo/geosite/pinterest',
    size: 'small',
    action: 'proxy',
  },
  {
    id: 'creative-deviantart',
    name: 'DeviantArt',
    desc: 'DeviantArt 艺术社区',
    group: 'creative',
    kind: 'domain',
    path: 'geo/geosite/deviantart',
    size: 'small',
    action: 'proxy',
  },
  {
    id: 'creative-behance',
    name: 'Behance',
    desc: 'Behance 作品集',
    group: 'creative',
    kind: 'domain',
    path: 'geo/geosite/behance',
    size: 'small',
    action: 'proxy',
  },

  /* ------------------------------- 直连加速 ------------------------------- */
  {
    id: 'accel-apple',
    name: 'Apple 强制直连',
    desc: 'Apple 更新与 App Store 国内 CDN 速度快，直连避免变慢',
    group: 'accel',
    kind: 'domain',
    path: 'geo/geosite/apple',
    size: 'small',
    action: 'direct',
  },
  {
    id: 'accel-microsoft',
    name: 'Microsoft 强制直连',
    desc: '微软更新、Office CDN 国内直连更快',
    group: 'accel',
    kind: 'domain',
    path: 'geo/geosite/microsoft',
    size: 'medium',
    action: 'direct',
  },
  {
    id: 'accel-steam-cn',
    name: 'Steam 国内 CDN',
    desc: 'Steam 商店/下载走国内 CDN，直连更快',
    group: 'accel',
    kind: 'domain',
    path: 'geo/geosite/steam',
    size: 'small',
    action: 'direct',
  },
  {
    id: 'accel-xbox-cn',
    name: 'Xbox 国内 CDN',
    desc: 'Xbox 下载走国内 CDN，直连更快',
    group: 'accel',
    kind: 'domain',
    path: 'geo/geosite/xbox',
    size: 'small',
    action: 'direct',
  },
];

export const RULESET_MAP: Record<string, RuleSetDef> = Object.fromEntries(RULESETS.map((r) => [r.id, r]));

/* ============================ 镜像源 ============================ */

export interface MirrorDef {
  id: string;
  label: string;
  desc: string;
  build: (repo: string, branch: string, filePath: string) => string;
}

export const MIRRORS: MirrorDef[] = [
  {
    id: 'raw',
    label: 'GitHub 官方源',
    desc: 'raw.githubusercontent.com，海外网络直连最快',
    build: (repo, branch, p) => `https://raw.githubusercontent.com/${repo}/${branch}/${p}`,
  },
  {
    id: 'ghproxy',
    label: 'gh-proxy 加速',
    desc: '国内常用的 GitHub 文件代理',
    build: (repo, branch, p) => `https://gh-proxy.com/https://raw.githubusercontent.com/${repo}/${branch}/${p}`,
  },
  {
    id: 'ghfast',
    label: 'ghfast 加速',
    desc: '国内 CDN 加速，稳定性较好',
    build: (repo, branch, p) => `https://ghfast.top/https://raw.githubusercontent.com/${repo}/${branch}/${p}`,
  },
  {
    id: 'jsdelivr',
    label: 'jsDelivr CDN',
    desc: '全球 CDN，国内可直连',
    build: (repo, branch, p) => {
      const [owner, name] = repo.split('/');
      return `https://fastly.jsdelivr.net/gh/${owner}/${name}@${branch}/${p}`;
    },
  },
  {
    id: 'ghgo',
    label: 'ghgo 加速',
    desc: '备用加速节点',
    build: (repo, branch, p) => `https://ghgo.xyz/https://raw.githubusercontent.com/${repo}/${branch}/${p}`,
  },
];

export const MIRROR_MAP: Record<string, MirrorDef> = Object.fromEntries(MIRRORS.map((m) => [m.id, m]));

/** 解析规则集在指定内核 + 镜像下的真实 URL */
export function resolveRuleSetUrl(def: RuleSetDef, core: 'mihomo' | 'singbox', mirrorId: string): string {
  const mirror = MIRROR_MAP[mirrorId] || MIRRORS[0];
  const branch = core === 'mihomo' ? MIHOMO_BRANCH : SINGBOX_BRANCH;
  const ext = core === 'mihomo' ? 'mrs' : 'srs';
  return mirror.build(RULESET_REPO, branch, `${def.path}.${ext}`);
}
