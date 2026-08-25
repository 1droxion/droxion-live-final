#!/usr/bin/env bash
set -euo pipefail

npm run android:prepare
grep -q 'compileSdkVersion = 36' android/variables.gradle
grep -q 'targetSdkVersion = 36' android/variables.gradle
grep -q 'package="com.droxion.live"\|namespace "com.droxion.live"\|namespace = "com.droxion.live"' android/app/src/main/AndroidManifest.xml android/app/build.gradle
(
  cd android
  chmod +x gradlew
  ./gradlew assembleDebug --stacktrace
)
test -n "$(find android/app/build/outputs/apk/debug -name '*.apk' -print -quit)"
APK="$(find android/app/build/outputs/apk/debug -name '*.apk' -print -quit)"
if unzip -Z1 "$APK" | grep -qi '20250520'; then
  echo 'Legacy 20250520 demo video found in Android APK.' >&2
  exit 1
fi
