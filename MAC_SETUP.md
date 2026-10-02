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
| eas-cli 23.2.0 | cloud builds, TestFlight | `npm install -g eas-cli@23.2.0`, then `eas login` |
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

Press **`i`** in the Metro terminal. Expo installs Expo Go into the Simulator and opens the app. Saving a file reloads it; press `r` to force a reload, `Ctrl+C` to stop.

Simulator tips:
- **Location:** the Simulator has no GPS. Use Features → Location → Custom Location (e.g. `34.0522`, `-118.2437` for LA) to test "Near me" and the Refound/Dipped distance check.
- **Push notifications** don't work in Expo Go, so test them in a TestFlight build (section 4).

## 3. Everyday: run the app on a real iPhone (Expo Go)

There's no `adb reverse` on iOS, so the phone reaches Metro over the network.

- **Same Wi-Fi, no client isolation (home):** `npx expo start`, then scan the QR code with the iPhone's Camera app.
- **Work Wi-Fi or any network that blocks device-to-device traffic:** `npx expo start --tunnel` and scan that QR code. The first time, if it asks for `@expo/ngrok`, run `npm install --no-save @expo/ngrok@4.1.3` and retry.

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
- [ ] Install Xcode and run the app in the Simulator; check every screen
- [ ] Test on a real iPhone via Expo Go
- [ ] Apple Developer Program membership
- [ ] App Store Connect app record, first TestFlight build, push notifications tested
- [ ] iPad: `supportsTablet` is `true`, which means App Store review on iPad and iPad screenshots. Set it to `false` for iPhone-only
- [ ] App Store listing: screenshots (6.9" iPhone), privacy policy URL (`https://rba-backend.cloudedapps.org/privacy`), App Privacy answers matching the Play Data safety form

## 6. Troubleshooting

| Problem | Fix |
|---|---|
| Pressing `i` says Xcode / simctl not found | Xcode isn't installed or selected: `sudo xcode-select -s /Applications/Xcode.app` |
| `ConfigError: … package.json does not exist` | You're in the repo root. `cd mobile` first |
| iPhone can't load the app from the QR code | Network blocks device-to-device traffic: use `npx expo start --tunnel` |
| Port 8081 already in use | An old Metro is still running: `npx kill-port 8081` |
| `git push` asks for a password | Run `gh auth login` then `gh auth setup-git` |
