[English](./README.md) | **简体中文**

# dsh-desktop

DeepSeek Harness Web GUI 的 macOS 桌面应用：一个 Electron 壳，在 Electron 自带的
Node（`ELECTRON_RUN_AS_NODE`）上启动 `dsh web` 后端，并通过回环地址加载其托管的
界面。不捆绑独立 Node 运行时。

## 安装

从 [Releases](https://github.com/xfstart07/dsh-desktop/releases) 页面下载 DMG，
挂载后把 `DeepSeek Harness.app` 拖入 `/Applications`。应用为 ad-hoc 签名（个人
使用）：在其他机器上 Gatekeeper 可能要求右键 → 打开。

## 命令

```sh
npm install          # electron + electron-builder
npm run icon         # 用 DeepSeek 官方应用图标生成 build/icon.icns
                     # （assets/official-icon-1024.png，已洗白边缘；whale.svg 是
                     # 从 harness 的 BrandWordmark 提取的矢量鲸鱼路径）
npm run backend:deploy   # pnpm deploy @deepseek-ai/dsh → ./backend（需要已构建的 harness 仓库；可用 DSH_REPO 覆盖路径）
npm start            # 针对 ./backend 运行壳（开发模式）
npm run dist         # electron-builder --dir → dist/mac-arm64/DeepSeek Harness.app
npm run dist:dmg     # 额外构建 DMG
```

## 发布

推送 `v*` tag 会触发 [release workflow](.github/workflows/release.yml)：检出并构建
公开的 [deepseek-ai/deepseek-harness](https://github.com/deepseek-ai/deepseek-harness)，
将后端依赖树部署到 `./backend`，在 `macos-14` 上构建 DMG，并发布带 DMG 附件的
GitHub Release。本仓库不存储任何密钥；workflow 只使用内置的 `github.token`。

```sh
git tag v1.0.0 && git push origin v1.0.0
```

## 工作原理

- `src/main.js` 以 `ELECTRON_RUN_AS_NODE=1` 和 `--expose-internals` 启动
  `backend/lib/bin.js web --port 0`（Electron 的 Node 24 满足 harness 的 engines
  `^22.19 || >=24`），解析 stdout 就绪行 `dsh web: http://…` 后，在
  `BrowserWindow` 中加载该 URL。外链在系统默认浏览器中打开。
- 数据与凭据复用 `~/.dsh`（`DSH_HOME`）；除
  `~/Library/Logs/DeepSeek Harness/backend.log` 日志外，不在 harness 自身目录外
  写入任何内容。
- 后端刻意作为子进程运行：argv 干净、SIGTERM 优雅退出（5 秒宽限，之后 SIGKILL）。
  参见 `docs/adr/0001-*.md`。

## 已知限制

- 仅 ad-hoc 签名（个人使用）；其他机器上 Gatekeeper 会警告。
- 现有的 `~/.dsh/profiles` 模块农场由仓库检出创建；用户在 profile 中自加的插件
  通过它解析。打包后端的标准 bundle 依赖树则完全从 `./backend` 解析。
- 仅 arm64。
