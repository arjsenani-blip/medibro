#!/usr/bin/env bash
# Creates (or updates) the ReadRx Xcode project and opens it in Xcode.
# Run from the readrx folder:  npm run ios
set -euo pipefail

if [[ "$(uname)" != "Darwin" ]]; then
  echo "This needs a Mac with Xcode." >&2; exit 1
fi
# Use the regular Xcode from the App Store (not a beta)
XCODE_APP="/Applications/Xcode.app"
if [[ ! -d "$XCODE_APP" ]]; then
  echo "The regular Xcode isn't installed. Get it free from the Mac App Store, open it once, then run this again." >&2; exit 1
fi
if [[ "$(xcode-select -p)" != "$XCODE_APP"* ]]; then
  echo "Your Mac is set to use $(xcode-select -p | sed 's#/Contents/Developer##'). Switch to the regular Xcode with:" >&2
  echo "  sudo xcode-select -s $XCODE_APP" >&2; exit 1
fi
if ! xcrun --sdk iphoneos --show-sdk-path >/dev/null 2>&1; then
  echo "Command-line tools aren't pointing at $XCODE_APP. Run this once, then try again:" >&2
  echo "  sudo xcode-select -s \"$XCODE_APP\"" >&2; exit 1
fi
NODE_MAJOR=$(node -p 'process.versions.node.split(".")[0]')
if (( NODE_MAJOR < 20 )); then
  echo "Capacitor needs Node.js 20 or newer (you have $(node -v)). Install the LTS from nodejs.org." >&2; exit 1
fi

if ! command -v pod >/dev/null 2>&1; then
  echo "CocoaPods isn't installed (Capacitor needs it). Install it, then run this again:" >&2
  if command -v brew >/dev/null 2>&1; then
    echo "  brew install cocoapods" >&2
  else
    echo "  1) Install Homebrew: /bin/bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\"" >&2
    echo "  2) brew install cocoapods" >&2
  fi
  exit 1
fi

# A failed earlier run can leave a half-made ios folder; start that part over
if [[ -d ios && ( ! -d ios/App/App.xcodeproj || ! -f ios/App/Podfile ) ]]; then
  echo "› Removing an incomplete iOS project from an earlier run…"
  rm -rf ios
fi

echo "› Building the app…"
npx vite build

if [[ ! -d ios ]]; then
  echo "› Creating the iOS project…"
  npx cap add ios
fi

# Current Xcode only supports iOS 15.0+ deployment targets; Capacitor's template uses 14.0
MIN_IOS="15.0"
echo "› Setting the minimum iOS version to ${MIN_IOS}…"
sed -i '' -E "s/IPHONEOS_DEPLOYMENT_TARGET = 1[0-4]\.[0-9]+;/IPHONEOS_DEPLOYMENT_TARGET = $MIN_IOS;/g" ios/App/App.xcodeproj/project.pbxproj
sed -i '' -E "s/^platform :ios, '[0-9.]+'/platform :ios, '$MIN_IOS'/" ios/App/Podfile
if ! grep -q "readrx-min-ios" ios/App/Podfile; then
  sed -i '' -E "s/^([[:space:]]*)assertDeploymentTarget\(installer\)/\1assertDeploymentTarget(installer)\\
\1# readrx-min-ios: raise Pod targets to $MIN_IOS for current Xcode\\
\1installer.pods_project.targets.each do |t|\\
\1  t.build_configurations.each { |c| c.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '$MIN_IOS' }\\
\1end/" ios/App/Podfile
fi

npx cap sync ios

PLIST="ios/App/App/Info.plist"
set_key () {
  /usr/libexec/PlistBuddy -c "Set :$1 $2" "$PLIST" 2>/dev/null || /usr/libexec/PlistBuddy -c "Add :$1 string $2" "$PLIST"
}
echo "› Adding camera, photo, microphone and speech permission messages…"
set_key NSCameraUsageDescription "ReadRx uses the camera to read prescription labels and check pills. Photos stay on this phone."
set_key NSPhotoLibraryUsageDescription "ReadRx can read a label or pill from a photo you already took. Photos stay on this phone."
set_key NSMicrophoneUsageDescription "ReadRx listens when you tap the microphone to ask about a symptom. What you say stays on this phone."
set_key NSSpeechRecognitionUsageDescription "ReadRx turns your spoken question into text on this phone. It is never sent anywhere."
set_key CFBundleDisplayName "ReadRx"

# iOS 27 won't launch apps built with the current SDK unless they use the UIScene lifecycle,
# which Capacitor 7's template doesn't. Add a scene manifest and a SceneDelegate.
if ! /usr/libexec/PlistBuddy -c "Print :UIApplicationSceneManifest" "$PLIST" >/dev/null 2>&1; then
  echo "› Adding scene support (required on iOS 27)…"
  /usr/libexec/PlistBuddy \
    -c "Add :UIApplicationSceneManifest dict" \
    -c "Add :UIApplicationSceneManifest:UIApplicationSupportsMultipleScenes bool false" \
    -c "Add :UIApplicationSceneManifest:UISceneConfigurations dict" \
    -c "Add :UIApplicationSceneManifest:UISceneConfigurations:UIWindowSceneSessionRoleApplication array" \
    -c "Add :UIApplicationSceneManifest:UISceneConfigurations:UIWindowSceneSessionRoleApplication:0 dict" \
    -c "Add :UIApplicationSceneManifest:UISceneConfigurations:UIWindowSceneSessionRoleApplication:0:UISceneConfigurationName string Default Configuration" \
    -c "Add :UIApplicationSceneManifest:UISceneConfigurations:UIWindowSceneSessionRoleApplication:0:UISceneDelegateClassName string \$(PRODUCT_MODULE_NAME).SceneDelegate" \
    -c "Add :UIApplicationSceneManifest:UISceneConfigurations:UIWindowSceneSessionRoleApplication:0:UISceneStoryboardFile string Main" \
    "$PLIST"
fi
APPDELEGATE="ios/App/App/AppDelegate.swift"
if ! grep -q "class SceneDelegate" "$APPDELEGATE"; then
  cat >> "$APPDELEGATE" <<'SWIFT'

// Scene lifecycle (required on iOS 27). Forwards URL opens to Capacitor like AppDelegate does.
class SceneDelegate: UIResponder, UIWindowSceneDelegate {

    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        if let url = connectionOptions.urlContexts.first?.url {
            _ = ApplicationDelegateProxy.shared.application(UIApplication.shared, open: url, options: [:])
        }
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        for context in URLContexts {
            _ = ApplicationDelegateProxy.shared.application(UIApplication.shared, open: context.url, options: [:])
        }
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        _ = ApplicationDelegateProxy.shared.application(UIApplication.shared, continue: userActivity, restorationHandler: { _ in })
    }
}
SWIFT
fi

# ReadRx's native label reader (Apple Vision + the on-device model), kept in native/ios
echo "› Adding the on-device label reader, read-aloud and app icon…"
NATIVE_FILES=(LabelReader.swift LabelReaderPlugin.swift SpeechPlugin.swift ListenPlugin.swift ReadRxViewController.swift)
for f in "${NATIVE_FILES[@]}"; do cp -f "native/ios/$f" "ios/App/App/$f"; done
# xcodeproj comes with CocoaPods; Homebrew's CocoaPods keeps it in its own gem folder
pod_ruby () {
  if ruby -e 'require "xcodeproj"' 2>/dev/null; then ruby "$@"; return; fi
  local gem_home; gem_home="$(sed -n 's/.*GEM_HOME="\([^"]*\)".*/\1/p' "$(command -v pod)")"
  GEM_HOME="$gem_home" "$(head -1 "$gem_home/bin/pod" | sed 's/^#!//')" "$@"
}
cp -f native/ios/AppIcon-1024.png ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png
pod_ruby scripts/add-native-files.rb ios/App/App.xcodeproj "${NATIVE_FILES[@]}"
sed -i '' 's/customClass="CAPBridgeViewController" customModule="Capacitor"/customClass="ReadRxViewController" customModule="App" customModuleProvider="target"/' ios/App/App/Base.lproj/Main.storyboard

echo "› Opening the regular Xcode. Next: pick your iPhone at the top, set your Team under Signing & Capabilities, press Run."
if [[ -d ios/App/App.xcworkspace ]]; then open -a "$XCODE_APP" ios/App/App.xcworkspace; else open -a "$XCODE_APP" ios/App/App.xcodeproj; fi
