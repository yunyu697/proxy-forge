# 代理工坊 ProxyForge

跨平台的 mihomo (Clash.Meta) / sing-box 配置生成器。导入节点 → 选设备形态 → 按场景引导配置规则集 → 一键生成可直接使用的配置文件。

## 功能

- **多协议导入**：`ss` / `ssr` / `vmess` / `vless`（含 REALITY）/ `trojan` / `hysteria` / `hysteria2` / `tuic` / `anytls` / `wireguard` / `http` / `socks`，支持分享链接、整段 base64 订阅内容、订阅 URL 拉取，自动去重
- **引导式手动添加**：选协议后只显示需要填的字段，每个字段带说明
- **设备形态优化**：
  - **客户端** — TUN + Fake-IP，面板只监听 127.0.0.1
  - **旁路由** — Allow-LAN、DNS 劫持 53、自动排除内网网段
  - **主路由** — 日志降级、memconservative 加载、关闭进程探测、默认黑名单策略省内存
- **场景化规则集**：内置 70+ 常用规则集（来自 MetaCubeX/meta-rules-dat，mihomo 用 `.mrs`，sing-box 用 `.srs`），按 14 个场景引导勾选（日常上网 / 流媒体 / AI 服务 / 开发资源 / 游戏 / 社交 / 办公 / 广告拦截 / 学术 / 新闻 / 金融 / 云盘 / 创作素材 / 直连加速）；每个场景自动生成独立策略组（如 🎬 流媒体、🤖 AI 服务），可单独指定节点
- **自定义规则**：规则集之外可添加单条规则（域名后缀 / 完整域名 / 关键词 / IP 段 / 端口 / 来源 IP），引导式填写，优先级最高
- **网关模式风险缓解**（旁路由 / 主路由自动应用）：
  - 拦截 QUIC（UDP 443）强制回落 TCP，改善「部分网站打不开」「视频卡顿」「国内站点变慢」
  - 路由器 TUN MTU 降为 1500，避免 PPPoE 链路大包分片导致的站点打不开
  - 放宽 keepalive、关闭 UDP 会话保持（EIN），降低终端设备的额外功耗
  - 生成时附帶功耗 / 打不开网站 / 国内变慢三类问题的成因说明与排查建议
- **部署与 DNS 指南**（第 7 步，网关模式）：
  - 按当前配置展示 DNS 拓扑（监听地址、劫持机制、上游、Fake-IP 网段）与相容性注意事项
  - 内置 OpenWrt / iStoreOS / 华硕梅林 / 通用 DHCP 的逐步设置说明与命令
  - **RouterOS 引导式配置生成**：先填写网络参数表单（代理设备 IP、主路由 IP、LAN 网段、WAN 接入方式、DHCP 池等），内置校验（IP 合法性、同网段检查、地址池冲突、网关回环风险），再生成增量配置（在现有网络追加 DNS 劫持 + 代理接入，DHCP 按网段精确匹配、防回环、豁免 Fake-IP 网段、附 netwatch 离线看护）与全量配置模板；mihomo 可选「53 劫持 / 仅 DHCP 下发 / 网关模式」，sing-box 固定网关模式由 hijack-dns 接管，与代理配置严格相容
  - **上线前检查清单**：Safe Mode 应用、备份回滚、豁免列表、网关离线风险、静态 IP 客户端、IPv6 旁路、双重 NAT 等防断网要点
- **三种分流策略**：白名单（国外全代理）/ 黑名单（仅 GFWList，省资源）/ 全局
- **镜像源切换**：规则集支持 GitHub 官方源、gh-proxy、ghfast、jsDelivr 等，国内下载不卡
- **本地配置库**：保存 / 载入 / 导出历史配置，数据留在本机（localStorage）

## 快速开始（Web 版）

```bash
npm install        # 已配置 npmmirror 加速
npm run dev        # http://localhost:5173
```

## 桌面版（Tauri 2）

需要 Rust 工具链（`rustup` 安装，国内可设 `RUSTUP_DIST_SERVER=https://mirrors.ustc.edu.cn/rust-static` 加速）：

```bash
npm i -D @tauri-apps/cli
npm run tauri:dev      # 开发调试
npm run tauri:build    # 打包安装包（默认 --debug 产物在 src-tauri/target/debug/bundle/）
```

- crates.io 走 rsproxy 镜像（`src-tauri/.cargo/config.toml`，仅本项目生效）
- 应用图标用 `npx tauri icon <源图>` 生成，保证 RGBA 格式
- 已知问题：macOS 26+ 上 dmg 打包脚本（bundle_dmg.sh 的 hdiutil 旧语法）不兼容，因此 `targets` 配置为 `["app"]`，产物为 `.app`；如需 dmg 分发，可在旧系统打包或手工 `hdiutil create`

## 冒烟测试

```bash
npm run smoke    # esbuild 打包后 node 运行，26 项断言
```

## 目录结构

```
src/
  core/
    types.ts             # 统一节点模型 / 设备形态 / 生成选项
    utils.ts             # 宽容的 base64 与 URI 解析工具
    parsers/index.ts     # 12 种协议链接解析 + 分享链接反生成
    rulesets/catalog.ts  # 规则集清单 + 镜像源（mrs / srs 双格式）
    rulesets/scenarios.ts# 使用场景与引导问题
    builders/mihomo.ts   # mihomo YAML 生成（含设备差异化调优）
    builders/singbox.ts  # sing-box JSON 生成（1.11 / 1.12）
    generator.ts         # 编排：场景答案 -> 规则/策略组/路由计划
  components/            # 六步向导 UI
  store/useStore.ts      # zustand + localStorage 持久化
src-tauri/               # Tauri 2 桌面端配置
```

## 说明

- 规则集来自 [MetaCubeX/meta-rules-dat](https://github.com/MetaCubeX/meta-rules-dat)（domain-list-community / geoip 数据编译），URL 均可在界面中核对、修改
- sing-box 不支持 ShadowsocksR，生成时会自动跳过并在摘要中提示
- Web 版拉取订阅可能受浏览器 CORS 限制，桌面版无此问题
