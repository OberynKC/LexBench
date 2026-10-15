/** 只为当前平台已通过检查的安装包生成校验和与来源记录。 */
const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const { execFileSync } = require('node:child_process')
const pkg = require('../package.json')
const isMac = process.platform === 'darwin'
if (!isMac && process.platform !== 'win32') throw new Error('不支持的发布平台')
const platform = isMac ? 'macos' : 'windows'
const arch = isMac ? 'arm64' : 'x64'
const filename = `LexBench-${pkg.version}-${platform}-${arch}.${isMac ? 'dmg' : 'exe'}`
const directory = path.resolve(__dirname, '../release')
const file = path.join(directory, filename)
const hash = crypto.createHash('sha256')
const input = fs.createReadStream(file)
input.on('error', (error) => { console.error(error); process.exitCode = 1 })
input.on('data', (chunk) => hash.update(chunk))
input.on('end', () => {
  const sha256 = hash.digest('hex')
  const git = (...args) => execFileSync('git', args, { cwd: path.resolve(__dirname, '..'), encoding: 'utf8' }).trim()
  const information = {
    version: pkg.version, artifact: filename, platform, arch, sha256,
    bytes: fs.statSync(file).size, commit: git('rev-parse', 'HEAD'),
    dirty: git('status', '--porcelain').length > 0,
    builtAt: new Date().toISOString(), node: process.version,
    electron: require('electron/package.json').version,
    electronBuilder: require('electron-builder/package.json').version,
    betterSqlite3: require('better-sqlite3/package.json').version,
    signing: isMac ? 'ad-hoc; not notarized' : 'unsigned',
    acceptance: 'candidate; manual acceptance required',
    workflowRun: process.env.GITHUB_RUN_ID || null,
  }
  fs.writeFileSync(`${file}.sha256`, `${sha256}  ${filename}\n`)
  fs.writeFileSync(path.join(directory, `build-info-${platform}-${arch}.json`), `${JSON.stringify(information, null, 2)}\n`)
  console.log(`已生成 ${filename}.sha256 和构建信息`)
})
