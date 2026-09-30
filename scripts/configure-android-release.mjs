import fs from "node:fs";

const versionName = process.env.ANDROID_VERSION_NAME || "1.7";
const versionCodeBase = Number(process.env.ANDROID_VERSION_CODE_BASE || 170000);
const buildNumber = Math.max(1, Number(process.env.BUILD_NUMBER || 1));
const withSigning = process.argv.includes("--signing");

const capacitor = JSON.parse(fs.readFileSync("capacitor.config.json", "utf8"));
if (capacitor.appId !== "com.droxion.live") throw new Error("Unexpected Android package: " + capacitor.appId);

const variablesPath = "android/variables.gradle";
let variables = fs.readFileSync(variablesPath, "utf8");
variables = variables
  .replace(/minSdkVersion\s*=\s*\d+/, "minSdkVersion = 24")
  .replace(/compileSdkVersion\s*=\s*\d+/, "compileSdkVersion = 36")
  .replace(/targetSdkVersion\s*=\s*\d+/, "targetSdkVersion = 36");
if (!variables.includes("minSdkVersion = 24") || !variables.includes("compileSdkVersion = 36") || !variables.includes("targetSdkVersion = 36")) {
  throw new Error("Could not configure Android SDK versions.");
}
fs.writeFileSync(variablesPath, variables);

const buildPath = "android/app/build.gradle";
let build = fs.readFileSync(buildPath, "utf8");
build = build
  .replace(/versionCode\s*=?\s*\d+/, "versionCode = " + (versionCodeBase + buildNumber))
  .replace(/versionName\s*=?\s*"[^"]+"/, "versionName = \"" + versionName + "\"");

if (withSigning && !build.includes("CM_KEYSTORE_PATH")) {
  const marker = "    buildTypes {";
  if (!build.includes(marker)) throw new Error("Could not find Android buildTypes block.");
  const signing = [
    "    signingConfigs {",
    "        release {",
    "            storeFile = file(System.getenv(\"CM_KEYSTORE_PATH\"))",
    "            storePassword = System.getenv(\"CM_KEYSTORE_PASSWORD\")",
    "            keyAlias = System.getenv(\"CM_KEY_ALIAS\")",
    "            keyPassword = System.getenv(\"CM_KEY_PASSWORD\")",
    "        }",
    "    }",
    "",
    ""
  ].join("\n");
  build = build.replace(marker, signing + marker);
  build = build.replace("    buildTypes {\n        release {", "    buildTypes {\n        release {\n            signingConfig = signingConfigs.release");
}
fs.writeFileSync(buildPath, build);

const manifestPath = "android/app/src/main/AndroidManifest.xml";
let manifest = fs.readFileSync(manifestPath, "utf8");
const requiredPermissions = ["CAMERA", "com.android.vending.BILLING"];
for (const permission of requiredPermissions) {
  const full = permission.includes(".") ? permission : "android.permission." + permission;
  if (!manifest.includes(full)) {
    manifest = manifest.replace("    <application", "    <uses-permission android:name=\"" + full + "\" />\n\n    <application");
  }
}

manifest = manifest
  .replace(/\s*<uses-permission android:name="android\.permission\.RECORD_AUDIO"\s*\/?>/g, "")
  .replace(/\s*<uses-permission android:name="android\.permission\.MODIFY_AUDIO_SETTINGS"\s*\/?>/g, "")
  .replace(/\s*<uses-permission android:name="android\.permission\.ACCESS_FINE_LOCATION"\s*\/?>/g, "")
  .replace(/\s*<uses-permission android:name="android\.permission\.ACCESS_COARSE_LOCATION"\s*\/?>/g, "");

fs.writeFileSync(manifestPath, manifest);
console.log("Droxion Fit Android configured: package=" + capacitor.appId + " version=" + versionName + " code=" + (versionCodeBase + buildNumber));
