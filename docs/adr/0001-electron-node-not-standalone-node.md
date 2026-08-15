# 0001 — Backend runs on Electron's bundled Node, not a bundled standalone Node

The `dsh` CLI requires Node `^22.19 || >=24`. Latest stable Electron (43) ships
Node 24, satisfying the engines range, so the App spawns the Backend with
Electron's own binary in plain-Node mode (`ELECTRON_RUN_AS_NODE=1` plus
`--expose-internals`, which the HMR service needs because the
`node-addon-require-builtin` prebuilt addon does not load under Electron's ABI and
the loader falls back to its non-internal path). We deliberately do NOT bundle a
standalone Node runtime.

**Why**: bundling a second Node (~40 MB, custom afterPack logic, PATH management
for spawned children) buys process isolation and a pinned runtime, but the web
profile never spawns Node children (subagents run in-process, sandboxing uses
seatbelt, workers use `worker_threads`), and the degraded-loader path was proven
in a smoke test before packaging. One child process with clean argv and natural
SIGTERM shutdown keeps the backend's own `process-shutdown` machinery intact.

**Trade-off accepted**: an Electron upgrade that changes the bundled Node could
break the Backend's engines contract or the loader fallback; the smoke gates
(`scripts/smoke.mjs`) exist to catch that. If it ever bites, the fallback is a
bundled standalone Node — a decision to revisit, not a mystery.
