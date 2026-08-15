# dsh-desktop

DeepSeek Harness Web GUI packaged as a macOS app: an Electron shell that spawns the
`dsh web` backend on Electron's own bundled Node (`ELECTRON_RUN_AS_NODE`) and loads
the served GUI over loopback. No standalone Node runtime is bundled.

## Commands

```sh
npm install          # electron + electron-builder
npm run icon         # generate the placeholder icon (build/icon.icns)
npm run backend:deploy   # pnpm deploy @deepseek-ai/dsh → ./backend (needs built harness repo; set DSH_REPO to override)
npm start            # run the shell against ./backend (dev)
npm run dist         # electron-builder --dir → dist/mac-arm64/DeepSeek Harness.app
npm run dist:dmg     # additionally build a DMG
```

## How it works

- `src/main.js` spawns `backend/node_modules/@deepseek-ai/dsh/lib/bin.js web --port 0`
  with `ELECTRON_RUN_AS_NODE=1` and `--expose-internals` (Electron's Node 24 satisfies the harness engines
  `^22.19 || >=24`), parses the stdout readiness line `dsh web: http://…`, and loads
  that URL in a `BrowserWindow`. External links open in the system browser.
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
