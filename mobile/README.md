# Craft & Drop — Android test

This project packages the existing `test-photo.html` application with Capacitor 8.5.3.
It does not change the web application or its permanent GitHub Pages URL.

## Build

Install Node 22+, Android Studio 2025.2.1+ with Android SDK 36 and JDK 21.

```sh
cd mobile
npm ci
npm run android:init
# For subsequent builds: npm run android:sync
cd android
./gradlew assembleDebug
```

The APK is `mobile/android/app/build/outputs/apk/debug/app-debug.apk`.
Generated Android files and web assets are ignored by Git. The build packages
all current reference data, so the test APK is large. No APK is committed to Git.

## Emulator

Open `mobile/android` in Android Studio. In Device Manager, create an Android 16
(API 36) virtual device, start it and run the app. A recent Android System WebView
is required. You can also install with `adb install -r app-debug.apk`.

Check the four tabs, import a real card photo, confirm a candidate, add a card
with a purchase price, restart the app and verify persistence. Check permission
refusal and camera shutdown on navigation. An emulator camera does not measure
recognition quality on a physical phone. Use a real Android phone for that test.

## Data and updates

The APK uses `fr.craftdrop.tcgtest` and the fixed local origin `https://localhost`.
Its collection is separate from the browser's `tcgCards` collection. Building
or installing it does not erase the browser collection. Updates installed over
this APK preserve its own data if the application ID and signing key stay the same.
Uninstalling the app or clearing its data deletes the app's local collection.
Export/import between browser and APK is not implemented in this first version.

The APK bundles a snapshot of the web app. Web updates do not automatically update
an installed APK. Build a new APK to test a new snapshot. Keep the same debug
keystore for updates. The web URL remains:
https://seuitsei.github.io/tcg-portfolio/test-photo.html

This is a debug build for testing, not a Play Store release. It requests camera
permission for the existing live scanner; importing photos uses the system picker.
Network access remains needed for external services and images; full offline
operation is not claimed.

## CI

The `Android test APK` workflow on branch `android/test-apk` builds a debug APK
and attempts an emulator installation and launch. A running process and screenshot
are smoke checks only: they do not validate recognition or collection persistence.
The APK download is available in the workflow artifacts.
