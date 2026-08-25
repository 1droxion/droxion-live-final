#!/usr/bin/env bash
set -euo pipefail

npm run build
if [[ ! -d android ]]; then
  npx cap add android
fi
npx cap sync android
node scripts/configure-android-release.mjs
