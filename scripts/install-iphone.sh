#!/usr/bin/env bash
# Builds MediBro and installs it on a connected, unlocked iPhone, from the command line.
# Works from any folder:  bash ~/Downloads/readrx/scripts/install-iphone.sh
set -euo pipefail
export LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8   # CocoaPods fails without a UTF-8 locale

# Always run in the project folder, with the project's own Vite and Capacitor
# (a bare `npx` from elsewhere downloads whatever version is newest).
cd "$(dirname "$0")/.."
[[ -x node_modules/.bin/vite ]] || npm install
./node_modules/.bin/vite build
./node_modules/.bin/cap sync ios

# the first iPhone devicectl lists (the plain UDID, not the CoreDevice identifier)
UDID="${UDID:-$(xcrun devicectl list devices 2>/dev/null | grep -i iphone | grep -oE '[0-9A-F]{8}-[0-9A-F]{16}' | head -1)}"
if [[ -z "$UDID" ]]; then echo "No iPhone found. Plug it in, unlock it and tap Trust." >&2; exit 1; fi

DD="${TMPDIR:-/tmp}/readrx-build"
rm -rf "$DD/Build/Products/Debug-iphoneos/App.app"   # so a failed build can't install an old app
xcodebuild -workspace ios/App/App.xcworkspace -scheme App -configuration Debug \
  -destination 'generic/platform=iOS' -derivedDataPath "$DD" -allowProvisioningUpdates build | grep -E "error|BUILD" || true
APP="$DD/Build/Products/Debug-iphoneos/App.app"
[[ -d "$APP" ]] || { echo "The build failed. Open ios/App/App.xcworkspace in Xcode and press Run to see why." >&2; exit 1; }

xcrun devicectl device install app --device "$UDID" "$APP"
xcrun devicectl device process launch --device "$UDID" com.arjunsenani.readrx
