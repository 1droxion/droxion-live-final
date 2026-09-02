import fs from 'node:fs';

const capacitor = JSON.parse(fs.readFileSync('capacitor.config.json', 'utf8'));
const codemagic = fs.readFileSync('codemagic.yaml', 'utf8');
const workflow = fs.readFileSync('.github/workflows/quality-gate.yml', 'utf8');

if (capacitor.appId !== 'com.droxion.live') throw new Error('Android package must remain com.droxion.live.');
if (!codemagic.includes('ANDROID_VERSION_NAME: "1.3"')) throw new Error('Android release version is not aligned to 1.3.');
if (!codemagic.includes('targetSdkVersion = 36') && !codemagic.includes('Verify Android 16 target')) throw new Error('Android target SDK 36 verification is missing.');
if (!workflow.includes('npm run android:validate')) throw new Error('Quality Gate is missing Android build validation.');
console.log('Release configuration verified: com.droxion.live, Android 1.3, target SDK 36.');
