#!/usr/bin/env bash
set -euo pipefail

npm run build
find dist -type f -name '*20250520*.mp4' -print -delete
test -z "$(find dist -type f -name '*20250520*.mp4' -print -quit)"
if [[ ! -d android ]]; then
  npx cap add android
fi
npx cap sync android
test -z "$(find android/app/src/main/assets -type f -name '*20250520*.mp4' -print -quit)"
node scripts/configure-android-release.mjs
