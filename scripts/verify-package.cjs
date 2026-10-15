/** 检查实际安装包目录；使用包内 Electron 和生产依赖，不读取用户数据库。 */
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { spawnSync } = require('node:child_process')
const asar = require('@electron/asar')
const root = path.resolve(__dirname, '..')
const isMac = process.platform === 'darwin'
assert.ok(isMac || process.platform === 'win32', '仅支持 Mac ARM64 / Windows x64')
const expectedArch = isMac ? 'arm64' : 'x64'
const base = path.join(root, 'release', isMac ? 'mac-arm64/律衡.app/Contents' : 'win-unpacked')
const resources = path.join(base, isMac ? 'Resources' : 'resources')
const executable = path.join(base, isMac ? 'MacOS/律衡' : 'LexBench.exe')
const archive = path.join(resources, 'app.asar')
for (const [source, target] of [['LICENSE', 'LICENSE'], ['THIRD_PARTY_NOTICES.md', 'THIRD_PARTY_NOTICES.txt']]) {
  assert.deepEqual(fs.readFileSync(path.join(resources, target)), fs.readFileSync(path.join(root, source)), `包内许可不一致：${target}`)
}
const entries = asar.listPackage(archive).map((entry) => entry.replaceAll('\\', '/').replace(/^\//, ''))
const allowed = new Set(['dist', 'dist-electron', 'node_modules', 'package.json'])
for (const entry of entries) {
  assert.ok(allowed.has(entry.split('/')[0]), `不允许的包内文件：${entry}`)
  assert.ok(!/(^|\/)(\.env(?:\.[^/]*)?|attachments)(\/|$)|\.(db|db-wal|db-shm|p12|pfx|key|bundle|map)$/i.test(entry), `敏感或开发文件：${entry}`)
}
assert.ok(entries.includes('dist/index.html'))
assert.ok(entries.includes('dist-electron/main.cjs'))
assert.ok(entries.includes('dist-electron/preload.cjs'))
assert.deepEqual(entries.filter((entry) => entry.startsWith('dist-electron/')).sort(), [
  'dist-electron/main.cjs', 'dist-electron/preload.cjs',
])
const nativeEntries = entries.filter((entry) => entry.endsWith('.node'))
const expectedNative = `node_modules/better-sqlite3/prebuilds/${isMac ? 'darwin-arm64' : 'win32-x64'}.node`
assert.deepEqual(nativeEntries, [expectedNative], `原生模块应仅有目标架构：${nativeEntries.join(', ')}`)
for (const entry of nativeEntries) assert.ok(fs.existsSync(path.join(`${archive}.unpacked`, entry)), `原生模块未解包：${entry}`)
const manifest = JSON.parse(asar.extractFile(archive, 'package.json').toString())
assert.equal(manifest.version, require('../package.json').version)
assert.equal(manifest.productName, '律衡')

const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'lexbench-package-check-'))
try {
  const probe = path.join(temporary, 'probe.cjs')
  fs.writeFileSync(probe, `
    const assert = require('node:assert/strict');
    const load = require('node:module').createRequire(${JSON.stringify(path.join(archive, 'package.json'))});
    (async () => {
      assert.equal(process.arch, ${JSON.stringify(expectedArch)});
      assert.equal(process.versions.electron, ${JSON.stringify(require('electron/package.json').version)});
      const db = new (load('better-sqlite3'))(':memory:');
      assert.equal(db.prepare('SELECT 42 AS answer').get().answer, 42); db.close();
      const ExcelJS = load('exceljs');
      const workbook = new ExcelJS.Workbook(); workbook.addWorksheet('测试').addRow(['中文', 42]);
      assert.ok((await workbook.xlsx.writeBuffer()).length > 0);
      const JSZip = load('jszip');
      const backupZip = new JSZip(); backupZip.file('测试.txt', '测试内容');
      const restored = await JSZip.loadAsync(await backupZip.generateAsync({ type: 'nodebuffer' }));
      assert.equal(await restored.file('测试.txt').async('string'), '测试内容');
      // archiver 8 为 ESM，与生产导出逻辑一致使用动态 import。
      const archiver = await import(require('node:url').pathToFileURL(load.resolve('archiver')).href);
      const zip = new archiver.ZipArchive({ zlib: { level: 1 } });
      let bytes = 0;
      const completed = new Promise((resolve, reject) => {
        zip.on('data', chunk => { bytes += chunk.length; });
        zip.on('end', resolve); zip.on('error', reject);
      });
      zip.append('测试内容', { name: '测试.txt' });
      await zip.finalize(); await completed; assert.ok(bytes > 0);
      console.log('包内 Electron、架构、SQLite、Excel 与 ZIP 检查通过');
    })().catch(error => { console.error(error); process.exitCode = 1; });
  `)
  const result = spawnSync(executable, [probe], {
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }, encoding: 'utf8', timeout: 60000,
  })
  if (result.stdout) process.stdout.write(result.stdout)
  if (result.stderr) process.stderr.write(result.stderr)
  assert.ifError(result.error)
  assert.equal(result.status, 0, '包内生产依赖执行失败')
  if (isMac) {
    const signed = spawnSync('codesign', ['--verify', '--deep', '--strict', path.dirname(base)], { encoding: 'utf8' })
    assert.equal(signed.status, 0, signed.stderr || 'Mac 签名验证失败')
  }
  console.log(`安装包结构检查通过：${process.platform}/${expectedArch}，${entries.length} 个条目`)
} finally {
  fs.rmSync(temporary, { recursive: true, force: true })
}
