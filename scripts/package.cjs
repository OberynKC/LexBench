/** 两个平台各自在本机打包；测试配置不使用环境中的签名凭据。
 * 打包前临时移出非目标架构的 better-sqlite3 预编译模块，结束后恢复。 */
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { spawnSync } = require('node:child_process')
const target = process.argv[2]
const targets = { mac: ['darwin', 'arm64', '--mac'], win: ['win32', 'x64', '--win'] }
const selected = targets[target]
if (!selected || process.platform !== selected[0] || process.arch !== selected[1]) {
  console.error('请在 Apple Silicon Mac 执行 dist:mac，或在 Windows x64 执行 dist:win。')
  process.exit(1)
}
const keep = `${selected[0]}-${selected[1]}.node`
const prebuilds = path.resolve(__dirname, '../node_modules/better-sqlite3/prebuilds')
const stash = fs.mkdtempSync(path.join(os.tmpdir(), 'lexbench-prebuilds-'))
const moved = []
function renameOrCopy(src, dst) {
  try {
    fs.renameSync(src, dst)
  } catch (err) {
    if (err.code === 'EXDEV') {
      // 跨设备链接：在 Windows 上工作目录和 %TEMP% 可能在不同分区
      fs.copyFileSync(src, dst); fs.unlinkSync(src)
    } else throw err
  }
}
for (const name of fs.readdirSync(prebuilds)) {
  if (name !== keep && name.endsWith('.node')) {
    renameOrCopy(path.join(prebuilds, name), path.join(stash, name)); moved.push(name)
  }
}
const env = { ...process.env }
for (const key of Object.keys(env)) {
  if (/^(?:CSC_|WIN_CSC_|APPLE_)/.test(key)) delete env[key]
}
// Mac identity 在配置中显式为 '-'；Windows 不自动寻找个人签名证书。
env.CSC_IDENTITY_AUTO_DISCOVERY = 'false'
let status = 1
try {
  const result = spawnSync(process.execPath, [
    require.resolve('electron-builder/cli.js'), selected[2], `--${selected[1]}`, '--publish', 'never',
  ], { stdio: 'inherit', env })
  if (result.error) console.error(result.error.message)
  status = result.status ?? 1
} finally {
  for (const name of moved) renameOrCopy(path.join(stash, name), path.join(prebuilds, name))
  fs.rmSync(stash, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
}
process.exit(status)
