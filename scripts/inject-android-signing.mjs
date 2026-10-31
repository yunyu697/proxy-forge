// 把发布签名配置注入 Tauri 生成的 Android gradle 项目。
// Tauri v2 的 app/build.gradle.kts 默认不读取 keystore.properties，必须手动加 signingConfigs，
// 否则 APK/AAB 会以 debug 密钥签名，导致已装用户无法增量更新（签名不一致）。
// 幂等：已注入则跳过。
//
// 踩过的坑（AGP 9.x + Kotlin DSL）：
// 1. 不能在脚本里写 `java.util.Properties()` —— Kotlin DSL 中 `java` 会解析成 JavaPluginExtension
//    扩展而不是包名，报 "Unresolved reference 'util'"。必须用文件顶部的 import + `Properties()`。
// 2. 同理 `java.io.FileInputStream(...)` 要改成 import 后的 `FileInputStream(...)`。
// 3. AGP 9 把旧 DSL 的 `android {}` 访问器标记为 DEPRECATION_ERROR，脚本里出现其它编译错误时
//    会连带报错，这里用文件级 @file:Suppress("DEPRECATION_ERROR") 兜底。
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const androidDir = resolve(process.argv[2] || '.');
const gradlePath = resolve(androidDir, 'app', 'build.gradle.kts');

let out = readFileSync(gradlePath, 'utf8');
const src = out;

// 0) 文件级抑制：AGP 9 旧 DSL 访问器的 DEPRECATION_ERROR
const SUPPRESS = '@file:Suppress("DEPRECATION_ERROR")';
if (!out.includes(SUPPRESS)) {
  out = `${SUPPRESS}\n\n${out}`;
}

// 1) 补齐签名需要的 import（必须位于所有非 import 语句之前）
for (const imp of ['java.util.Properties', 'java.io.FileInputStream']) {
  if (!new RegExp(`^import\\s+${imp.replace(/\./g, '\\.')}\\s*$`, 'm').test(out)) {
    const lines = out.split('\n');
    let lastImport = -1;
    for (let i = 0; i < lines.length; i += 1) {
      if (/^import\s/.test(lines[i])) lastImport = i;
    }
    if (lastImport >= 0) {
      lines.splice(lastImport + 1, 0, `import ${imp}`);
      out = lines.join('\n');
    } else {
      // 没有 import 段落：插到 plugins { 之前
      out = out.replace(/(^|\n)(plugins\s*\{)/, `$1import ${imp}\n$2`);
    }
  }
}

const SIGNING_CONFIGS_BLOCK = `
signingConfigs {
    create("release") {
        val keystorePropertiesFile = rootProject.file("keystore.properties")
        val keystoreProperties = Properties()
        if (keystorePropertiesFile.exists()) {
            keystorePropertiesFile.inputStream().use { keystoreProperties.load(it) }
        }
        keyAlias = keystoreProperties.getProperty("keyAlias")
        keyPassword = keystoreProperties.getProperty("keyPassword")
        storeFile = file(keystoreProperties.getProperty("storeFile"))
        storePassword = keystoreProperties.getProperty("storePassword")
    }
}
`;

// 2) 在 buildTypes { 之前插入 signingConfigs 块
if (!out.includes('signingConfigs {')) {
  out = out.replace(/(buildTypes\s*\{)/, `${SIGNING_CONFIGS_BLOCK}\n$1`);
}

// 3) 在 release buildType 内引用该 signingConfig
const alreadyWired = out.includes('signingConfig = signingConfigs.getByName("release")');
if (!alreadyWired) {
  const re = /(buildTypes\s*\{[\s\S]*?)(\n\s*)(getByName\("release"\)|release)(\s*\{)/;
  if (re.test(out)) {
    out = out.replace(re, `$1$2$3$4\n        signingConfig = signingConfigs.getByName("release")`);
  } else {
    console.error('[inject-android-signing] 未找到 release buildType，无法注入 signingConfig');
    process.exit(1);
  }
}

if (out !== src) {
  writeFileSync(gradlePath, out);
}
const ok =
  out.includes('signingConfigs {') &&
  out.includes('signingConfig = signingConfigs.getByName("release")') &&
  out.includes('import java.util.Properties') &&
  out.includes('import java.io.FileInputStream');
console.log(`[inject-android-signing] androidDir=${androidDir} signingWired=${ok}`);
if (!ok) process.exit(1);
