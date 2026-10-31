# Release Notes

## v1.2.8（2026-10-31）—— 内置更新检查（不依赖签名密钥）

### 新增：启动后自动检查新版本

Tauri 官方的 updater 插件强制校验更新包签名（`Config.pubkey` 是必填字段，`Update::install()` 内部无条件调用 `verify()`，没有任何开关能跳过），启用它必须长期维护一对 minisign 密钥。这一版改为**只检查、不安装**：

- 启动 1.5 秒后请求 `api.github.com/repos/yunyu697/proxy-forge/releases/latest`，按语义化版本比较（`1.10.0 > 1.9.9`，不是字符串比较）
- 有新版本时在页面顶部显示提示条，自动按当前平台挑好安装包（macOS → `.dmg`，Windows → `-setup.exe`，Linux → `.AppImage`，Android → `.apk`），点「去下载」用系统浏览器打开直链
- 支持「忽略此版本」（记在 localStorage，直到出现更新的版本才再提示）和「本次关闭」
- 结果缓存 6 小时，避免频繁打 GitHub API（未认证限流 60 次/小时/IP）
- 断网、限流、JSON 异常一律静默失败，绝不影响主流程

### 配套改动

- `src-tauri`：新增 `open_url` 命令（内部走 `tauri-plugin-opener`，桌面与 Android 通用），只放行 `http/https`，挡住 `file://` 之类协议
- 删除已失效的更新器清单链路：`scripts/gen-updater-manifest.mjs`、`scripts/merge-updater-manifest.mjs` 以及 CI 里的 `publish-updater` job。之前产出的 `latest.json` 因为没开 `createUpdaterArtifacts` 不生成 `.sig`，`platforms` 一直是空对象，属于误导性产物
- 测试：`src/core/update.test.ts` 覆盖版本比较、平台识别、资产挑选、API 响应整理、异常降级（18 项）

## v1.2.7（2026-10-31）—— 只差 Android：补齐 tauri npm script

v1.2.6 里 macOS / Windows / Linux 三个桌面端全部成功（dmg、exe、msi、便携 zip、AppImage、deb、rpm、latest.json 齐全），Android 仍失败。

### Android —— `npm error Missing script: "tauri"`

- 根因：Tauri 的 Android Gradle 插件（`buildSrc/.../BuildTask.kt`）编译原生库时执行的是 `npm run -- tauri android android-studio-script --release --target <abi>`，它要求 `package.json` 里存在名为 `tauri` 的 script。本项目此前只有 `tauri:dev` / `tauri:build`，于是 gradle 的 `rustBuildArm64Release`、`rustBuildArmRelease` 两个任务都以 `Process 'command 'npm'' finished with non-zero exit value 1` 失败
- 修复：`package.json` 增加 `"tauri": "tauri"`（指向 node_modules/.bin 里的 Tauri CLI）
- 顺带修上传路径：AAB 输出在 `bundle/universalRelease/`（大写 R），原来的 `-path '*release*'` 匹配不到，改为 `-path '*/outputs/*'`

## v1.2.6（2026-10-31）—— 只差 Android：对齐 SDK Platform

v1.2.5 里 macOS / Windows / Linux 全部产物已经齐全（dmg、exe、msi、便携 zip、AppImage、deb、rpm、latest.json），只剩 Android。

### Android —— `Failed to find package 'platforms;android-37'`

- 根因：Tauri 2.12 模板的 `compileSdk = 37`，但 Google 仓库里 API 37 只发布了 `platforms;android-37.1` / `android-37.2`，**不存在** `platforms;android-37`，`sdkmanager` 直接报找不到包
- 修复：不再依赖远端仓库按名字装，改为在 `tauri android init` 之后读取模板的 `compileSdk`，与 runner 已安装的最高整数平台（`$ANDROID_HOME/platforms/android-XX`）比对，不一致就把 `compileSdk` / `targetSdk` 改写为该平台，AGP 会自动补齐对应 build-tools

### 安装包（打 `v*` 标签后由 CI 自动产出并挂到 GitHub Release）

| 平台 | 格式 |
| --- | --- |
| macOS (Apple Silicon / Intel) | `.dmg`（universal 合并包） |
| Windows | NSIS 安装包（`.exe`）/ `.msi`（WiX）/ 可移植 `.zip` |
| Linux | AppImage / `.deb` / `.rpm` |
| Android | 通用 `.apk`（直接安装）/ `.aab`（Play 商店上架） |

> 升级说明：应用功能与 v1.2.1 一致，本版只修发布链路。

---

## v1.2.5（2026-10-31）—— Android Gradle 脚本与 Release 上传修正

v1.2.4 已把 Android 推进到 Gradle 构建阶段、Windows 也成功产出安装包，但两处仍有问题。

### Android —— Gradle 脚本编译失败

`app/build.gradle.kts` 里注入的签名配置报三个错：

```
Line 17: android {  'fun Project.android(Action<BaseAppModuleExtension>)' is deprecated ...
Line 32: val keystoreProperties = java.util.Properties()   Unresolved reference 'util'
Line 34: keystoreProperties.load(java.io.FileInputStream(...))  Unresolved reference 'io'
```

- 根因：Kotlin DSL 里 `java` 是 `JavaPluginExtension` 扩展，不是包名，所以 `java.util.Properties()` / `java.io.FileInputStream()` 都无法解析
- 修复：`scripts/inject-android-signing.mjs` 改为自动补齐 `import java.util.Properties` 与 `import java.io.FileInputStream`，注入代码使用短类名；并加 `@file:Suppress("DEPRECATION_ERROR")` 兜底 AGP 9 旧 DSL 访问器的弃用升级
- 顺带修掉一个真 bug：原来读的是 `keystoreProperties["password"]`（不存在的键），现在正确读 `storePassword` / `keyPassword`
- 模板 `compileSdk` 从 36 变成 37，改为 `tauri android init` 之后按生成文件里的实际值安装对应 `platforms;android-XX`，不再写死

### Windows —— Release 上传失败

- 根因：上传步骤对整个 `src-tauri/target` 目录 `find *.exe`，把 `build-script-build.exe`、`build_script_build-*.exe` 这些构建脚本产物也传了上去，同名冲突后 `gh release upload` 返回 HTTP 404
- 修复：只从各平台 `bundle` 目录取安装包（新增 matrix 字段 `bundle_dir`）

### 安装包（打 `v*` 标签后由 CI 自动产出并挂到 GitHub Release）

| 平台 | 格式 |
| --- | --- |
| macOS (Apple Silicon / Intel) | `.dmg`（universal 合并包） |
| Windows | NSIS 安装包（`.exe`）/ `.msi`（WiX）/ 可移植 `.zip` |
| Linux | AppImage / `.deb` / `.rpm` |
| Android | 通用 `.apk`（直接安装）/ `.aab`（Play 商店上架） |

> 升级说明：应用功能与 v1.2.1 一致，本版只修发布链路。

---

## v1.2.4（2026-10-31）—— 补齐 Android 库目标 + Windows 便携包命名

v1.2.3 里 `latest.json` 已能正常合并，但 Android 与 Windows 仍各差最后一步。

### Android —— `error: no library targets found in package 'proxy-forge'`

- 根因：`tauri android build` 执行的是 `cargo build --lib`，而本项目的 Rust 代码此前全在 `src/main.rs` 里，Cargo 没有 lib 目标，Android 侧无从链接
- 修复：按 Tauri 移动端标准结构拆分
  - 新增 `src-tauri/src/lib.rs`，承载 `tcp_ping` / `save_text_file` 命令与 `run()` 入口，并加 `#[cfg_attr(mobile, tauri::mobile_entry_point)]`
  - `src/main.rs` 精简为调用 `proxy_forge_lib::run()`，保留 Windows 的 `windows_subsystem` 属性
  - `Cargo.toml` 增加 `[lib] crate-type = ["staticlib", "cdylib", "rlib"]` 与显式 `[[bin]]`
- 桌面端行为不变（macOS / Linux 产物结构一致，`cargo check` 通过）

### Windows —— 便携 zip 找不到可执行文件

- 根因：上一版把文件名写死成 `ProxyForge.exe`，但 Tauri 产出的可执行文件来自 Cargo 包名，实际是 `proxy-forge.exe`
- 修复：改为在 `target/release` 下按 `*.exe` 通配符查找并打印实际路径

### 安装包（打 `v*` 标签后由 CI 自动产出并挂到 GitHub Release）

| 平台 | 格式 |
| --- | --- |
| macOS (Apple Silicon / Intel) | `.dmg`（universal 合并包） |
| Windows | NSIS 安装包（`.exe`）/ `.msi`（WiX）/ 可移植 `.zip` |
| Linux | AppImage / `.deb` / `.rpm` |
| Android | 通用 `.apk`（直接安装）/ `.aab`（Play 商店上架） |

> 升级说明：功能与 v1.2.1 一致；Rust 侧仅调整了目标结构，未改动任何业务逻辑。

---

## v1.2.3（2026-10-31）—— Windows 便携包 + Android SDK 两处收尾修复

v1.2.2 已修好 Windows 的图标与 Android 的 setup-android，Windows 的 `.exe`/`.msi` 与 Android 的 SDK 安装都越过了原来的失败点，但又各暴露一个新问题，本次一并修掉。

### Windows —— `zip: command not found`

- 根因：打包本身已经成功，失败发生在最后生成便携 zip 的步骤。Windows runner 的 Git bash 里没有 `zip` 命令，`-e` 下直接 exit 127
- 修复：该步骤改用 PowerShell（`Compress-Archive`），并在 exe 不存在时显式报错，不再静默产出空包

### Android —— `yes: standard output: Broken pipe`

- 根因：Actions 的 bash 默认 `-e -o pipefail`。`yes | sdkmanager ...` 在 sdkmanager 正常结束后，`yes` 因 SIGPIPE 退出，整条管道被判为失败（exit 1），NDK 其实已经装完
- 修复：改用有限长度的 here-string（`<<< "$LICENSES"`）自动应答许可，不再使用 `yes |` 管道

### 顺带改进

- `publish-updater` 改为 `always() && !cancelled()`：单个平台打包失败时仍会合并 `latest.json`，缺失平台留空，避免更新器清单整体丢失

### 安装包（打 `v*` 标签后由 CI 自动产出并挂到 GitHub Release）

| 平台 | 格式 |
| --- | --- |
| macOS (Apple Silicon / Intel) | `.dmg`（universal 合并包） |
| Windows | NSIS 安装包（`.exe`）/ `.msi`（WiX）/ 可移植 `.zip` |
| Linux | AppImage / `.deb` / `.rpm` |
| Android | 通用 `.apk`（直接安装）/ `.aab`（Play 商店上架） |

> 升级说明：功能与 v1.2.1 / v1.2.2 完全一致，仅修复发布链路。

---

## v1.2.2（2026-10-31）—— 修复 Windows / Android 打包失败

v1.2.1 的 macOS 与 Linux 产物正常，但 Windows 与 Android 两个 job 在打包阶段失败，Release 因此缺少 Windows 安装包与 APK/AAB。本次只修发布链路，功能与 v1.2.1 完全一致。

### Windows —— `Couldn't find a .ico icon`

- 根因：`tauri.conf.json` 的 `bundle.icon` 只列了 `icons/icon.png`。Rust 编译已成功，但 NSIS/MSI 打包器要求在 icon 列表中出现 `.ico`，找不到即中止
- 修复：icon 数组补全为 `32x32.png` / `128x128.png` / `128x128@2x.png` / `icon.icns` / `icon.ico`

### Android —— `Failed to find package 'tools'`

- 根因：`android-actions/setup-android@v3` 内部调用 sdkmanager 安装 `tools` 包，而 runner 上的 cmdline-tools 16.0 已移除该包，action 直接以 exit 1 失败
- 修复：弃用该 action，直接复用 runner 预装的 `/usr/local/lib/android/sdk`，自动探测 `cmdline-tools/*/bin` 下的 `sdkmanager` 写入 `PATH`；NDK / platform / build-tools 安装改为 `yes |` 自动接受许可

### 安装包（打 `v*` 标签后由 CI 自动产出并挂到 GitHub Release）

| 平台 | 格式 |
| --- | --- |
| macOS (Apple Silicon / Intel) | `.dmg`（universal 合并包） |
| Windows | NSIS 安装包（`.exe`）/ `.msi`（WiX）/ 可移植 `.zip` |
| Linux | AppImage / `.deb` / `.rpm` |
| Android | 通用 `.apk`（直接安装）/ `.aab`（Play 商店上架） |

> 升级说明：与 v1.2.1 二进制行为一致，仅是发布产物补齐。

---

## v1.2.1（2026-10-31）—— 全平台安装包 + Android（修复发布）

修复 v1.2.0 首版发布中三个打包 job 失败的问题（macOS/Windows/Android），并补齐全部安装包。在 v1.1.0（12 项工程增强）基础上，发布渠道包括：

### 安装包（打 `v*` 标签后由 CI 自动产出并挂到 GitHub Release）

| 平台 | 格式 |
| --- | --- |
| macOS (Apple Silicon / Intel) | `.dmg`（universal 合并包） |
| Windows | NSIS 安装包（`.exe`）/ `.msi`（WiX）/ 可移植 `.zip` |
| Linux | AppImage / `.deb` / `.rpm` |
| Android | 通用 `.apk`（直接安装）/ `.aab`（Play 商店上架） |

### 发布链路修正

- 新增 `release` job：打标签时先建 GitHub Release，桌面端 / Android job 再往里挂产物（此前产物只留在 Artifacts、没挂到 Release）
- 桌面端 `publish-updater` 改从 Release 下载三平台 `updater-*.json` 合并为 `latest.json`（此前未上传为 Artifact 导致合并失败）
- Windows MSI 依赖 WiX Toolset，CI 在 Windows runner 上自动下载安装
- Linux 增加 `rpm`（需 `rpm` 工具，已加入 apt 依赖）

### Android 签名一致性

- 发布密钥库以 PKCS12 形式存于仓库 Secret（`ANDROID_KEYSTORE_BASE64` + 别名 / 密码），CI 每次解码同一份写入 `keystore.properties`
- 所有版本的 APK 用同一密钥签名，已安装应用可正常增量更新
- Android 工程脚手架（`src-tauri/gen/android`）不提交，CI 用 `tauri android init --ci` 现场生成

> 已知限制：本机（macOS 26+）dmg 打包脚本与新版 hdiutil 不兼容，本地产物为 `.app`；CI runner 上 dmg 正常。sing-box 不支持 SSR，生成时自动跳过。

---

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
