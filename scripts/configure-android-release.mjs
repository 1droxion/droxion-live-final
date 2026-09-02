import fs from 'node:fs';

const versionName = process.env.ANDROID_VERSION_NAME || '1.3';
const versionCodeBase = Number(process.env.ANDROID_VERSION_CODE_BASE || 130000);
const buildNumber = Math.max(1, Number(process.env.BUILD_NUMBER || 1));
const withSigning = process.argv.includes('--signing');

const capacitor = JSON.parse(fs.readFileSync('capacitor.config.json', 'utf8'));
if (capacitor.appId !== 'com.droxion.live') throw new Error(`Unexpected Android package: ${capacitor.appId}`);

const variablesPath = 'android/variables.gradle';
let variables = fs.readFileSync(variablesPath, 'utf8');
variables = variables
  .replace(/compileSdkVersion\s*=\s*\d+/, 'compileSdkVersion = 36')
  .replace(/targetSdkVersion\s*=\s*\d+/, 'targetSdkVersion = 36');
if (!variables.includes('compileSdkVersion = 36') || !variables.includes('targetSdkVersion = 36')) {
  throw new Error('Could not configure Android compile/target SDK 36.');
}
fs.writeFileSync(variablesPath, variables);

const buildPath = 'android/app/build.gradle';
let build = fs.readFileSync(buildPath, 'utf8');
build = build
  .replace(/versionCode\s*=?\s*\d+/, `versionCode = ${versionCodeBase + buildNumber}`)
  .replace(/versionName\s*=?\s*"[^"]+"/, `versionName = "${versionName}"`);

if (withSigning && !build.includes('CM_KEYSTORE_PATH')) {
  const marker = '    buildTypes {';
  if (!build.includes(marker)) throw new Error('Could not find Android buildTypes block.');
  const signing = `    signingConfigs {
        release {
            storeFile = file(System.getenv("CM_KEYSTORE_PATH"))
            storePassword = System.getenv("CM_KEYSTORE_PASSWORD")
            keyAlias = System.getenv("CM_KEY_ALIAS")
            keyPassword = System.getenv("CM_KEY_PASSWORD")
        }
    }

`;
  build = build.replace(marker, signing + marker);
  build = build.replace('    buildTypes {\n        release {', '    buildTypes {\n        release {\n            signingConfig = signingConfigs.release');
}
fs.writeFileSync(buildPath, build);

const manifestPath = 'android/app/src/main/AndroidManifest.xml';
let manifest = fs.readFileSync(manifestPath, 'utf8');
const permissions = ['CAMERA', 'RECORD_AUDIO', 'MODIFY_AUDIO_SETTINGS'];
const missing = permissions.filter(permission => !manifest.includes(`android.permission.${permission}`));
if (missing.length) {
  manifest = manifest.replace(
    '    <application',
    `${missing.map(permission => `    <uses-permission android:name="android.permission.${permission}" />`).join('\n')}\n\n    <application`
  );
  fs.writeFileSync(manifestPath, manifest);
}

console.log(`Android package=${capacitor.appId} targetSdk=36 versionName=${versionName} versionCode=${versionCodeBase + buildNumber}`);
