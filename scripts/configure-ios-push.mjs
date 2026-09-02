import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const iosRoot = path.join(root, 'ios', 'App');
const appDir = path.join(iosRoot, 'App');
const projectFile = path.join(iosRoot, 'App.xcodeproj', 'project.pbxproj');
const infoPlist = path.join(appDir, 'Info.plist');
const entitlementsFile = path.join(appDir, 'App.entitlements');

if (!fs.existsSync(projectFile) || !fs.existsSync(infoPlist)) {
  console.log('iOS project is not present; skipping push capability configuration.');
  process.exit(0);
}

fs.mkdirSync(appDir, { recursive: true });

const entitlements = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>aps-environment</key>
  <string>production</string>
</dict>
</plist>
`;
fs.writeFileSync(entitlementsFile, entitlements, 'utf8');

let project = fs.readFileSync(projectFile, 'utf8');
const entitlementSetting = 'CODE_SIGN_ENTITLEMENTS = App/App.entitlements;';
if (!project.includes(entitlementSetting)) {
  let replacements = 0;
  project = project.replace(/buildSettings = \{\n/g, match => {
    replacements += 1;
    return `${match}\t\t\t\t${entitlementSetting}\n`;
  });

  if (replacements === 0) {
    throw new Error('Could not attach App.entitlements to the generated Xcode project.');
  }

  fs.writeFileSync(projectFile, project, 'utf8');
}

let plist = fs.readFileSync(infoPlist, 'utf8');
const backgroundKey = '<key>UIBackgroundModes</key>';
const remoteMode = '<string>remote-notification</string>';

if (!plist.includes(backgroundKey)) {
  const closingDict = plist.lastIndexOf('</dict>');
  if (closingDict < 0) throw new Error('Info.plist is missing its closing dict.');
  const addition = `\t<key>UIBackgroundModes</key>\n\t<array>\n\t\t<string>remote-notification</string>\n\t</array>\n`;
  plist = `${plist.slice(0, closingDict)}${addition}${plist.slice(closingDict)}`;
  fs.writeFileSync(infoPlist, plist, 'utf8');
} else if (!plist.includes(remoteMode)) {
  const pattern = /(<key>UIBackgroundModes<\/key>\s*<array>)([\s\S]*?)(<\/array>)/;
  if (!pattern.test(plist)) throw new Error('Could not update UIBackgroundModes in Info.plist.');
  plist = plist.replace(pattern, `$1$2\n\t\t<string>remote-notification</string>\n\t$3`);
  fs.writeFileSync(infoPlist, plist, 'utf8');
}

console.log('Configured iOS Push Notifications entitlement and Remote notifications background mode.');
