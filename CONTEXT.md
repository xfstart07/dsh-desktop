# dsh-desktop Context

The macOS desktop distribution of DeepSeek Harness: an Electron shell that runs the
`dsh web` backend and shows the GUI it serves. The shell owns the backend's
lifecycle; the backend owns all user data.

## Language

**App**:
The deliverable macOS application "DeepSeek Harness" — the Electron shell plus the
embedded backend and the GUI it serves, as one double-clickable unit.
_Avoid_: 桌面版, wrapper

**Shell**:
The Electron main process: spawns the backend, watches its readiness line, hosts
the GUI window, and terminates the backend on quit.
_Avoid_: launcher, 壳

**Backend**:
The `dsh web` server process (the Cordis plugin tree) that serves the GUI over
loopback and executes agent work.
_Avoid_: server, 服务端, 后端进程

**Backend Runtime**:
Electron's bundled Node binary running in plain-Node mode
(`ELECTRON_RUN_AS_NODE`), version 24.x — the runtime the Backend executes on. No
standalone Node is shipped.
_Avoid_: 独立 Node, 运行时

**Profile Data**:
Everything under `~/.dsh` (`DSH_HOME`): sessions, settings, credentials, and the
per-profile module farm. Shared with the CLI; the App never writes elsewhere.
_Avoid_: 数据目录, 配置

**Readiness Line**:
The Backend's stdout line `dsh web: http://127.0.0.1:<port>` — the contract the
Shell waits for before opening the window.
_Avoid_: 就绪信号, URL 行

**Peer Repair**:
The deploy step that links workspace peerDependencies (and their dependencies)
that `pnpm deploy --legacy` leaves out, so the Backend's module graph resolves
entirely from the App's own virtual store.
_Avoid_: 补包, peer 修复 (keep English — it is a deploy detail, but a recurring one)
