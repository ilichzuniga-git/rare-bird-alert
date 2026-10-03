# Mac Setup: the iOS version

The Mac is used to build and test the **iOS version** of Birder's Best Friend. Android development stays on Windows (see `README.MD`). Both platforms build from the same `mobile/` code on `main`, so every change must keep working on Android too.

**Where this runs:** every command below runs in a terminal on the Mac, inside `~/Documents/rba-app-mac/mobile`. The repo root has no `package.json`.

The app talks to the **production backend**, so the Mac needs no Postgres, local backend, `adb` or `google-services.json` (that file is Android-only; iOS push goes through Apple's APNs).

---

## 1. One-time setup

| Tool | Why | Install |
|---|---|---|
| Xcode | iOS Simulator; needed for any iOS testing on the Mac | Mac App Store (large download), open it once to finish installing components, then `sudo xcode-select -s /Applications/Xcode.app` |
| iOS Simulator runtime | the simulated iPhone | Xcode → Settings → Components → install the latest iOS |
| Node.js 22 LTS | Expo tooling | `brew install node@22` (Node 26 currently on this Mac works for bundling, but Expo only supports LTS releases) |
| eas-cli 24.5.0 | cloud builds, TestFlight | `npm install -g eas-cli@24.5.0`, then `eas login`. Versions before 24.4.1 can't log in to Apple ("iTunes service key is empty"); see the README |
| GitHub CLI login | `git push` | `gh auth login`, then `gh auth setup-git` |
| Expo Go | testing on a real iPhone | App Store on the iPhone |

`npm install` in `mobile/` has already been run on this Mac.

Check Xcode is set up: `xcrun simctl list devices available` should list iPhones.

---

## 2. Everyday: run the app in the iOS Simulator

```bash
cd ~/Documents/rba-app-mac/mobile
npx expo start
```

Press **`i`** in the Metro terminal. Expo installs Expo Go into the Simulator and opens the app.

**Xcode 27 renamed the Simulator app to DeviceHub** (`/Applications/Xcode.app/Contents/Applications/DeviceHub.app`). If no phone window appears, open DeviceHub from there or Spotlight. The `xcrun simctl` commands are unchanged. Saving a file reloads it; press `r` to force a reload, `Ctrl+C` to stop.

Simulator tips:
- **Location:** the Simulator has no GPS. Set one from the terminal with `xcrun simctl location booted set 34.0522,-118.2437` (downtown LA) to test "Near me" and the Refound/Dipped distance check.
- **iPad:** boot one with `xcrun simctl boot "iPad Pro 13-inch (M5)"` (names: `xcrun simctl list devices available`), then open the app on it the same way. Layouts wider than 700pt use the iPad variants (e.g. the split hero card).
- **Keyboard:** the Simulator treats the Mac keyboard as a hardware keyboard, so iPad hides the on-screen one; type on the Mac, or press ⌘K to show it.
- **iPad rotates:** Apple requires iPad apps to support every orientation, so the iPad build rotates even though iPhone is portrait-only. Check layouts in landscape too (⌘← / ⌘→).
- The blue ⚙️ floating button is Expo Go's developer menu, not part of the app; drag it aside if it covers something.
- **Push notifications** don't work in Expo Go, so test them in a TestFlight build (section 4).

## 3. Everyday: run the app on a real iPhone (Expo Go)

There's no `adb reverse` on iOS, so the phone reaches Metro over the network.

- **Same Wi-Fi, no client isolation (home):** `npx expo start`, then scan the QR code with the iPhone's Camera app.
- **Work Wi-Fi or any network that blocks device-to-device traffic:** `npx expo start --tunnel` and scan that QR code. The first time, if it asks for `@expo/ngrok`, run `npm install --no-save @expo/ngrok@4.1.3` and retry.

**Testing on someone else's iPhone** (no Apple Developer account needed): they install Expo Go from the App Store, you run `npx expo start --tunnel` on the Mac, and send them the `exp://….exp.direct` address (or a screenshot of the QR code). It only works while Metro is running on the Mac. Installing a standalone build on their phone, through TestFlight or otherwise, needs the Apple Developer account.

Expo Go only runs the one SDK it ships with (currently 57). If it says "Project is incompatible with this version of Expo Go", see the README.

---

## 4. Builds (EAS, in the cloud)

| Profile | Command | Output | Needs Apple Developer account? |
|---|---|---|---|
| `ios-simulator` | `eas build -p ios --profile ios-simulator` | `.app` for the Simulator | No |
| `production` | `eas build -p ios --profile production` | `.ipa` for TestFlight / App Store | Yes ($99/yr) |

- **Simulator build:** a real standalone build (not Expo Go). Install it with `eas build:run -p ios --latest`.
- **Production build:** the first run asks you to log in to Apple. Let EAS create and manage the distribution certificate, provisioning profile and **push notification (APNs) key**, the iOS counterparts of the Android keystore and Firebase file. Build numbers increment automatically, as on Android (`appVersionSource: remote`).
- **TestFlight:** `eas submit -p ios --latest` uploads the build to App Store Connect. Testers install it via the TestFlight app. Push notifications work there.

The bundle identifier is `com.ilichzuniga.rarebirdalert`, the same as the Android package name.

---

## 5. iOS port checklist

- [x] Bundle identifier, export-compliance flag (`usesNonExemptEncryption: false`), simulator build profile
- [x] Location permission: only the "while using" prompt (no "Always" prompts, which App Review rejects for apps that don't use them)
- [x] About screen header clears the status bar / Dynamic Island
- [x] Install Xcode and run the app in the Simulator; iPhone and iPad (portrait + landscape) passes done 2026-10-03
- [x] iPad: hero card split into text + photo panel (the full-bleed photo cropped to a thin strip)
- [x] Trip directions on iOS offer Apple Maps or Google Maps
- [ ] Test on a real iPhone via Expo Go (no iPhone on hand; possibly a family member's, see section 3)
- [ ] Apple Developer Program membership
- [ ] App Store Connect app record, first TestFlight build, push notifications tested
- [x] iPad: decided to keep iPad support (`supportsTablet: true`). Test iPad layouts in an iPad Simulator; the App Store listing needs iPad screenshots (13" iPad) too
- [ ] App Store listing: screenshots (6.9" iPhone), privacy policy URL (`https://rba-backend.cloudedapps.org/privacy`), App Privacy answers matching the Play Data safety form

## 6. Troubleshooting

| Problem | Fix |
|---|---|
| Pressing `i` says Xcode / simctl not found | Xcode isn't installed or selected: `sudo xcode-select -s /Applications/Xcode.app` |
| `ConfigError: … package.json does not exist` | You're in the repo root. `cd mobile` first |
| iPhone can't load the app from the QR code | Network blocks device-to-device traffic: use `npx expo start --tunnel` |
| Port 8081 already in use | An old Metro is still running: `npx kill-port 8081` |
| `git push` asks for a password | Run `gh auth login` then `gh auth setup-git` |
