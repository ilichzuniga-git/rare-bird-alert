---
name: update-docs
description: Bring the RBA docs up to date after a round of changes - the guide site, every README, ROADMAP.md, docs/SOURCES.MD - and sync the same facts into the mem0 MCP. Use whenever the user asks to update the readmes, the docs, the guide or the memories, or says to "write it all down" at the end of a session.
---

# Update docs and mem0

The user works on this repo from two machines (Windows for Android, a Mac for iOS). The docs in git and the
mem0 MCP memory are what carry context between them. Local Claude memory files stay on one machine. So
updating the docs always includes mem0: never finish one without the other.

## 1. Find what changed

- `git log --oneline` since the last docs commit (look for "Docs:" or "Roadmap:" subjects), and `git diff --stat` for uncommitted work.
- Read the commit messages and the code they touched. Write down each user-visible change, each backend change, each decision the user made, and each gotcha you learned this session.

## 2. Update every doc that the changes touch

Read each file before editing it. Change only what is out of date, and keep each file's voice and format.

| File | What belongs there |
|---|---|
| `backend/src/site/index.html` | The guide. **Tour** steps describe how the app works now. **What's new** has one entry per release (date, iPhone build, Android version code). Pushing `backend/` deploys it to production, so hold release notes until the release is built |
| `mobile/src/guide.ts` | `WHATS_NEW`: the in-app card for the current `expo.version` (3 short highlights). It must match the guide's entry |
| `backend/src/site/README.md` | How the guide site works, and which screenshots need retaking |
| `README.MD` | Windows/Android setup, and **How it works** (poller, data sources, map, bird page) |
| `MAC_SETUP.md` | Mac/iOS workflow, simulator tips, troubleshooting |
| `ROADMAP.md` | The canonical to-do list for both apps: tick finished items, add new ones with dates and commits |
| `docs/SOURCES.MD` | Every external data source or link, with its license. The About screen must match it |
| `This is the Rare Bird Alert (RBA) projec.md` | Project overview and current release status |
| `docs/APP_REVIEW.md` | Only if App Review answers or the review video change |

Check that the guide's Privacy tab still matches if data handling changed (location, device ids, what's sent to the server).

## 3. Sync mem0

1. Load the tools in one call: `ToolSearch` with `select:mcp__mem0-mcp__search_memories,mcp__mem0-mcp__add_memory,mcp__mem0-mcp__update_memory`.
2. Search for RBA memories (`"Birder's Best Friend rare bird alert"`, plus a search per topic you touched, `top_k` 20) and read what's there.
3. **Update** a memory that the changes make wrong or stale (release status, open work items, how a feature works). Don't add a near-duplicate.
4. **Add** a memory for each new durable fact: a decision the user made, a root cause, a how-to or gotcha, a release milestone. Leave out anything git or the docs already say in full, unless the next session needs it to get started.
5. Conventions: plain sentences that make sense without this conversation. Absolute dates (`2026-10-16`, never "today"). Metadata `{"type": "project" | "feedback" | "user" | "reference", "project": "rba-app", "as_of": "<date>"}`. Pass `infer: false` on `add_memory` so the text is stored as written. Never store secrets, tokens or keys.

## 4. Local memory

Update the local memory note for the next session (`project-next-session.md` in this project's memory folder) with what was done and what's next.

## 5. Commit and report

- One commit, `Docs: <what>`, ending with the attribution line from the system reminder. Push to `main`. Say so when the commit touches `backend/`, because that deploys.
- If the guide changed, check it's live once the deploy finishes: `curl -s https://rba-backend.cloudedapps.org/guide/ | grep -c "<new phrase>"`.
- Tell the user which files and mem0 entries changed (updated vs added), and remind them to pull on the other machine.
