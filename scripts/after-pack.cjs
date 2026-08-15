// electron-builder afterPack hook: extraResources excludes node_modules, so the
// backend's dependency tree (the deployed pnpm virtual store) is copied here.
// Relative store symlinks survive the copy and stay valid inside the .app.
const { cpSync } = require('node:fs')
const { join } = require('node:path')

module.exports = async function afterPack(context) {
  const appName = context.packager.appInfo.productFilename
  const dest = join(context.appOutDir, `${appName}.app`, 'Contents', 'Resources', 'backend', 'node_modules')
  cpSync(join(__dirname, '..', 'backend', 'node_modules'), dest, { recursive: true })
}
