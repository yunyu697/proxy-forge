// 把发布签名配置注入 Tauri 生成的 Android gradle 项目。
// Tauri v2 的 app/build.gradle.kts 默认不读取 keystore.properties，必须手动加 signingConfigs，
// 否则 APK/AAB 会以 debug 密钥签名，导致已装用户无法增量更新（签名不一致）。
// 幂等：已注入则跳过。
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const androidDir = resolve(process.argv[2] || '.');
const gradlePath = resolve(androidDir, 'app', 'build.gradle.kts');

const src = readFileSync(gradlePath, 'utf8');

const SIGNING_CONFIGS_BLOCK = `
signingConfigs {
    create("release") {
        val keystorePropertiesFile = rootProject.file("keystore.properties")
        val keystoreProperties = java.util.Properties()
        if (keystorePropertiesFile.exists()) {
            keystoreProperties.load(java.io.FileInputStream(keystorePropertiesFile))
        }
        keyAlias = keystoreProperties["keyAlias"] as String
        keyPassword = keystoreProperties["password"] as String
        storeFile = file(keystoreProperties["storeFile"] as String)
        storePassword = keystoreProperties["password"] as String
    }
}
`;

let out = src;

// 1) 在 buildTypes { 之前插入 signingConfigs 块
if (!out.includes('signingConfigs')) {
  out = out.replace(/(buildTypes\s*\{)/, `${SIGNING_CONFIGS_BLOCK}\n$1`);
}

// 2) 在 release buildType 内引用该 signingConfig
const alreadyWired = out.includes('signingConfig = signingConfigs.getByName("release")');
if (!alreadyWired) {
  const re =
    /(buildTypes\s*\{[\s\S]*?)(\n\s*)(getByName\("release"\)|release)(\s*\{)/;
  if (re.test(out)) {
    out = out.replace(
      re,
      `$1$2$3$4\n        signingConfig = signingConfigs.getByName("release")`,
    );
  } else {
    console.error('[inject-android-signing] 未找到 release buildType，无法注入 signingConfig');
    process.exit(1);
  }
}

if (out !== src) {
  writeFileSync(gradlePath, out);
}
const ok =
  out.includes('signingConfigs') &&
  out.includes('signingConfig = signingConfigs.getByName("release")');
console.log(`[inject-android-signing] androidDir=${androidDir} signingWired=${ok}`);
if (!ok) process.exit(1);
