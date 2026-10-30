# Release Notes

## v1.0.0（2026-10-31）—— 首个正式版

从 0.1.0 起经历七轮迭代后的第一个正式版本。一套引导式向导，覆盖「导入节点 → 选择设备 → 场景规则 → 生成配置 → 部署上线」全流程。

### 亮点

- **12 种协议链接解析**：ss / ssr / vmess / vless（含 REALITY）/ trojan / hysteria / hysteria2 / tuic / anytls / wireguard / http / socks，支持订阅 URL、批量粘贴、base64 订阅，自动去重，节点可反向导出分享链接
- **引导式手动添加**：选协议后表单只显示该协议需要的字段，按「基础 / 认证加密 / 传输层 / TLS」分组并带中文说明
- **三种设备形态差异化调优**：客户端（TUN + Fake-IP）、旁路由（Allow-LAN、DNS 劫持、内网豁免）、主路由（省内存策略、黑名单模式）
- **14 个使用场景 + 70+ 规则集**：日常 / 流媒体 / AI / 新闻 / 金融 / 云盘 / 开发 / 游戏 / 社交 / 办公 / 学术 / 创作素材 / 广告拦截 / 直连加速；每个场景生成独立策略组，可单独指定节点
- **双内核输出**：mihomo（`.mrs` 规则集 + 头部注释）与 sing-box（`.srs` + hijack-dns），一套配置两份产物
- **部署与 DNS 指南**：按当前配置生成 DNS 拓扑说明，OpenWrt / iStoreOS / 梅林 / 通用 DHCP 设置步骤
- **RouterOS 配置生成**：引导式表单（拓扑 / DNS 策略 / WAN-LAN 参数）+ 实时校验，生成增量或全量 `.rsc` 脚本；支持「独立旁路由」与「RouterOS v7 容器」两种拓扑，防回环、防断网、附回滚命令
- **网关风险内置缓解**：终端功耗（keepalive 放宽）、个别站点打不开（MTU 1500、QUIC 拦截、DoH 绕过提醒）、国内站点慢（直连加速场景 + 缺失规则警告）
- **自定义规则**：规则集之外的单条规则，6 种类型引导填写，生成时优先级最高
- **跨平台**：Web 应用 + Tauri 2 桌面端（macOS / Windows / Linux），本地配置库持久化

### 全平台安装包

| 平台 | 格式 |
| --- | --- |
| macOS (Apple Silicon / Intel) | `.app` / `.dmg` |
| Windows | NSIS 安装包（`.exe`）/ `.msi` |
| Linux | AppImage / `.deb` |

> Windows 与 Linux 包由 GitHub Actions 在对应系统 runner 上构建（Tauri 不支持跨平台交叉编译）。

### 升级与校验

- 版本号 1.0.0（package.json / tauri.conf.json / Cargo.toml 三处同步）
- 构建号见应用侧边栏 `v1.0.0 · build N`
- 已知限制：本机（macOS 27）dmg 打包脚本与新版 hdiutil 不兼容，本地产物为 `.app`；CI runner 上 dmg 正常。sing-box 不支持 SSR，生成时自动跳过

---

## v0.1.0 — v0.2.x（2026-10-31，开发迭代）

- 0.1.0：工程骨架、解析引擎、双内核生成器、六步向导、Tauri 配置
- 0.2.0：场景扩充至 14 个、自定义规则、部署与 DNS 步骤、RouterOS 引导式生成、UI 统一重构、版本号/构建号体系、git + CI
