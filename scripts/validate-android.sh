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
