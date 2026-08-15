**English** | [简体中文](./README.zh.md)

# dsh-desktop

DeepSeek Harness Web GUI packaged as a macOS app: an Electron shell that spawns the
`dsh web` backend on Electron's own bundled Node (`ELECTRON_RUN_AS_NODE`) and loads
the served GUI over loopback. No standalone Node runtime is bundled.

## Install

Download the DMG from the [Releases](https://github.com/xfstart07/dsh-desktop/releases)
page, mount it, and drag `DeepSeek Harness.app` into `/Applications`. The app is
ad-hoc signed (personal use): on other machines Gatekeeper may ask to open it via
right-click → Open.

## Commands

```sh
npm install          # electron + electron-builder
npm run icon         # build/icon.icns from the official DeepSeek app icon
                     # (assets/official-icon-1024.png, whitened; whale.svg is the
                     # vector path extracted from the harness BrandWordmark)
npm run backend:deploy   # pnpm deploy @deepseek-ai/dsh → ./backend (needs built harness repo; set DSH_REPO to override)
npm start            # run the shell against ./backend (dev)
npm run dist         # electron-builder --dir → dist/mac-arm64/DeepSeek Harness.app
npm run dist:dmg     # additionally build a DMG
```

## Releases

Pushing a `v*` tag triggers the [release workflow](.github/workflows/release.yml):
it checks out and builds the public
[deepseek-ai/deepseek-harness](https://github.com/deepseek-ai/deepseek-harness),
deploys the backend bundle into `./backend`, builds the DMG on `macos-14`, and
publishes a GitHub Release with the DMG attached. No secrets are stored in this
repository; the workflow only uses the built-in `github.token`.

```sh
git tag v1.0.0 && git push origin v1.0.0
```

## How it works

- `src/main.js` spawns `backend/lib/bin.js web --port 0` with
  `ELECTRON_RUN_AS_NODE=1` and `--expose-internals` (Electron's Node 24 satisfies
  the harness engines `^22.19 || >=24`), parses the stdout readiness line
  `dsh web: http://…`, and loads that URL in a `BrowserWindow`. External links
  open in the system browser.
- Data and credentials are reused from `~/.dsh` (`DSH_HOME`); nothing is written
  outside the harness's own directories except the log at
  `~/Library/Logs/DeepSeek Harness/backend.log`.
- The backend runs as a child process on purpose: clean argv, natural SIGTERM
  graceful shutdown (5s grace, then SIGKILL). See `docs/adr/0001-*.md`.

## Known limitations

- Ad-hoc signed only (personal use); Gatekeeper will warn other machines.
- The existing `~/.dsh/profiles` module farm was created by the repo checkout; user
  plugins added to a profile resolve through it. The packaged backend's own
  dependency tree (the standard bundles) resolves entirely from `./backend`.
- arm64 only.
