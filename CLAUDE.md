# Claude notes for this repo

## Start of every session: sync first

This repo is worked on from two machines that both push to `main`: **Windows** (Android, the main machine) and a **Mac** (the iOS port). Before doing anything else in a session:

1. Run `git fetch` and `git status -sb`. If the branch is behind `origin/main`, pull before making changes.
2. Remind the user to **pull on the other machine** before they switch back to it.

## Platforms

One codebase builds both apps. Platform differences live in `Platform.OS` checks and the `ios` / `android` sections of `mobile/app.json`; every change to shared code must keep working on both. Mac/iOS workflow: `MAC_SETUP.md`. Windows/Android workflow: `README.MD`.

Pushing changes under `backend/` deploys to production automatically (Dokploy).
