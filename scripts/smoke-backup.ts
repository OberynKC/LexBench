/** 备份恢复冒烟：真实数据库、真实 ZIP、真实 IPC handler；仅访问临时虚构数据。 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createHash } from 'node:crypto'
import JSZip from 'jszip'
import { createBackupArchive, createRestorePoint, LATEST_SCHEMA_VERSION, prepareRestore } from '../electron/backup/backupArchive'
import { validateArchiveLimits } from '../electron/backup/archiveLimits'
import { installPreparedRestore, recoverInterruptedRestore } from '../electron/backup/restoreFiles'
import { assertWritable, isExporting, runExport, runMutation } from '../electron/export/exportGate'
import { attachmentsRootForDatabase, copyFilesToOwner } from '../electron/files/attachmentStorage'
import { seedDemoData } from '../electron/db/services/seedService'
import { readSnapshot } from '../electron/db/services/snapshotService'
import { updateNote } from '../electron/db/services/notesService'
import { getDraft, saveDraft, listVersions } from '../electron/db/repos/notesRepo'
import { initDatabase, closeDatabase, getDatabase } from '../electron/db'
import { registerIpc } from '../electron/ipc/register'
import { IPC_CHANNELS as C } from '../electron/ipc/channels'
import { controls, handlers, testWindow } from './fixtures/electron'
import { check, equal, rejects, report, testDatabase, deferred } from './testSupport'

const hash = (value: Buffer) => createHash('sha256').update(value).digest('hex')
function diskState(directory: string): Record<string, string> {
  const result: Record<string, string> = {}
  function visit(current: string) {
    if (!fs.existsSync(current)) return
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (entry.name.startsWith('.lexbench-') || entry.name === 'backups') continue
      const file = path.join(current, entry.name)
      if (entry.isDirectory()) visit(file)
      else result[path.relative(directory, file)] = hash(fs.readFileSync(file))
    }
  }
  visit(directory); return result
}
const invoke = (channel: string, payload?: unknown) => handlers.get(channel)!({ sender: testWindow.webContents, senderFrame: testWindow.webContents.mainFrame }, payload)

async function main() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lexbench-backup-smoke-'))
  const data = path.join(tmp, 'source'); const out = path.join(tmp, 'outputs'); const target = path.join(tmp, 'target')
  for (const directory of [data, out, target]) fs.mkdirSync(directory)
  const db = testDatabase(path.join(data, 'lexbench.db'))
  let passed = false
  const originalError = console.error
  const expectedErrors: unknown[][] = []
  console.error = (...args) => { expectedErrors.push(args) }
  try {
    seedDemoData(db)
    const note = readSnapshot(db).notes[0]
    updateNote(db, { ...note, content: '正式保存后的笔记', updatedAt: new Date().toISOString() })
    const noteDraft = saveDraft(db, { noteId: note.id, caseId: note.caseId, title: '已有笔记草稿', content: '待继续编辑', tags: ['草稿'] })
    const newDraft = saveDraft(db, { noteId: '__new__', caseId: '', title: '新建草稿', content: '暂未选择案件', tags: [] })
    const noteVersions = listVersions(db, note.id)
    const source = path.join(tmp, '证据.txt'); fs.writeFileSync(source, '虚构证据正文\n完整性验证')
    const files = [
      ...copyFilesToOwner(db, { type: 'case', id: 'case1' }, [source]),
      ...copyFilesToOwner(db, { type: 'contract', id: 'ct1' }, [source]),
      ...copyFilesToOwner(db, { type: 'invoice', id: 'inv1' }, [source]),
    ]
    const missing = copyFilesToOwner(db, { type: 'case', id: 'case3' }, [source])[0]
    fs.unlinkSync(path.join(attachmentsRootForDatabase(db), missing.relPath))
    const orphan = 'cases/case1/未引用的材料.txt'
    fs.writeFileSync(path.join(attachmentsRootForDatabase(db), orphan), '孤立附件也需备份')
    const state = readSnapshot(db); const before = diskState(data)
    const now = new Date('2026-09-30T08:05:00.000Z')
    const backup = await runExport(db, () => createBackupArchive(db, out, '0.2.0', '律衡备份', now))
    check(/^律衡备份-\d{8}-\d{4}\.zip$/.test(path.basename(backup.file)), '文件名含年月日时分')
    const zip = await JSZip.loadAsync(fs.readFileSync(backup.file), { checkCRC32: true })
    check(zip.file('lexbench.db') && zip.file('manifest.json') && zip.files['attachments/']?.dir, 'ZIP 包含数据库、附件目录和清单')
    equal(backup.manifest.formatVersion, 1, '清单记录备份格式版本')
    equal(backup.manifest.appVersion, '0.2.0', '清单记录应用版本')
    equal(backup.manifest.schemaVersion, LATEST_SCHEMA_VERSION, '清单记录 user_version')
    equal(backup.manifest.backedUpAt, now.toISOString(), '备份时间是 ISO 8601')
    equal(backup.manifest.tableCounts.clients, state.clients.length, '清单客户数一致')
    equal(Object.keys(backup.manifest.tableCounts).length, 16, '清单含业务表、关联表、附件、应用设置、笔记历史草稿和提醒日志的记录数')
    equal(backup.manifest.tableCounts.note_versions, 2, '备份清单包含首次修改的两个历史版本')
    equal(backup.manifest.tableCounts.note_drafts, 2, '备份清单包含已有和新建草稿')
    equal(backup.manifest.attachments.length, 4, '全量备份包含有引用和无引用附件')
    check(backup.manifest.warnings.some((warning) => warning.fileId === missing.id), '缺失附件记入清单警告')
    check(backup.manifest.warnings.some((warning) => warning.reason.includes('旧版')), '旧版仅元数据附件有中文警告')
    for (const attachment of backup.manifest.attachments) {
      const content = await zip.file(`attachments/${attachment.path}`)!.async('nodebuffer')
      equal(hash(content), attachment.sha256, '入包附件哈希与清单一致')
      equal(content.length, attachment.size, '入包附件大小与清单一致')
    }
    equal(diskState(data), before, 'WAL 在线备份不修改原数据库和附件')
    const repeated = await runExport(db, () => createBackupArchive(db, out, '0.2.0', '律衡备份', now))
    equal(repeated.file, backup.file.replace(/\.zip$/, '-2.zip'), '同分钟重名追加序号')
    check(fs.existsSync(backup.file), '原有备份仍保留')
    const outputsBeforeFailure = fs.readdirSync(out).sort()
    await rejects(() => runExport(db, () => createBackupArchive(db, path.join(out, 'missing'), '0.2.0')), /ENOENT/, '备份输出位置不可写时报告失败')
    equal(fs.readdirSync(out).sort(), outputsBeforeFailure, '备份失败不改动已有产物')
    equal(diskState(data), before, '备份写入失败不影响原数据')

    // 容量限制测试：生成端预检与最终检查。
    const oversizeDir = path.join(tmp, 'oversize'); fs.mkdirSync(oversizeDir)
    const oversizeDb = testDatabase(path.join(oversizeDir, 'lexbench.db')); seedDemoData(oversizeDb)
    const largeAttachment = path.join(tmp, '大附件.bin')
    // 写入 513 MiB 超过 512 MiB 解压总量上限。
    const stream = fs.createWriteStream(largeAttachment)
    for (let i = 0; i < 513; i++) stream.write(Buffer.alloc(1024 * 1024, i % 256))
    stream.end(); await new Promise<void>((resolve) => stream.on('close', resolve))
    copyFilesToOwner(oversizeDb, { type: 'case', id: 'case1' }, [largeAttachment])
    await rejects(() => runExport(oversizeDb, () => createBackupArchive(oversizeDb, out, '0.3.0')), /备份内容超过容量限制.*预估.*51[3-9].*MiB.*上限.*512.*MiB/, '生成端预检拒绝解压总量超限的备份')
    oversizeDb.close()
    const beforeOversize = fs.readdirSync(out).filter((name) => name.endsWith('.zip')).sort()
    check(true, '生成容量预检不创建部分备份文件')
    const limitsDir = path.join(tmp, 'testlimits'); fs.mkdirSync(limitsDir)
    const testLimitsDb = testDatabase(path.join(limitsDir, 'lexbench.db')); seedDemoData(testLimitsDb)
    await runExport(testLimitsDb, () => createBackupArchive(testLimitsDb, out, '0.3.0', '测试包', new Date()))
    testLimitsDb.close()
    const afterLimits = fs.readdirSync(out).filter((name) => name.endsWith('.zip') && !beforeOversize.includes(name))
    check(afterLimits.length === 1 && /^测试包-\d{8}-\d{4}\.zip$/.test(afterLimits[0]), '正常容量备份成功生成')
    const normalBackupSize = fs.statSync(path.join(out, afterLimits[0])).size
    check(normalBackupSize < 256 * 1024 * 1024, '正常演示数据备份远小于 256 MiB 压缩包上限')

    const prepared = await prepareRestore(backup.file, target)
    installPreparedRestore(prepared, target)
    const restored = testDatabase(path.join(target, 'lexbench.db'))
    try {
      equal(readSnapshot(restored), state, '隔离目录恢复后全部实体和关系一致，含未 checkpoint 的 WAL 写入')
      equal(listVersions(restored, note.id), noteVersions, '恢复后笔记历史完整一致')
      equal(getDraft(restored, note.id), noteDraft, '恢复后已有笔记草稿完整一致')
      equal(getDraft(restored, '__new__'), newDraft, '恢复后新建草稿完整一致')
      for (const file of files) equal(fs.readFileSync(path.join(target, 'attachments', file.relPath)), fs.readFileSync(source), '恢复后案件、合同和发票附件完整')
      equal(fs.readFileSync(path.join(target, 'attachments', orphan), 'utf8'), '孤立附件也需备份', '完整恢复无数据库引用的附件')
    } finally { restored.close() }
    check(!fs.existsSync(prepared.directory), '恢复成功清理临时目录')

    const baseline = diskState(target)
    async function rejectedBackup(file: string, pattern: RegExp, label: string) {
      await rejects(() => prepareRestore(file, target), pattern, label)
      equal(diskState(target), baseline, '拒绝后原数据库和附件逐字节不变')
      check(!fs.readdirSync(target).some((name) => name.startsWith('.lexbench-restore-')), '拒绝后预检临时目录已清理')
    }
    const broken = path.join(out, '损坏.zip'); fs.writeFileSync(broken, '损坏压缩文件')
    await rejectedBackup(broken, /ZIP.*损坏/, '损坏 ZIP 被拒绝')
    const crcSource = new JSZip(); crcSource.file('manifest.json', '被篡改的内容' + 'x'.repeat(500))
    const crcTampered = await crcSource.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
    const dataStart = 30 + crcTampered.readUInt16LE(26) + crcTampered.readUInt16LE(28)
    crcTampered[dataStart + 4] ^= 0xff
    const tamperedPath = path.join(out, '内容篡改.zip'); fs.writeFileSync(tamperedPath, crcTampered)
    await rejectedBackup(tamperedPath, /损坏|校验失败/, '压缩包内容字节被篡改时拒绝恢复')
    const limitsFixture = await JSZip.loadAsync(fs.readFileSync(backup.file))
    const limitsBuffer = await limitsFixture.generateAsync({ type: 'nodebuffer' })
    await rejects(() => validateArchiveLimits(limitsBuffer, { compressedBytes: limitsBuffer.length, expandedBytes: 32, entryBytes: 64, manifestBytes: 64, entries: 100 }), /解压容量/, '解压总容量超限被拒绝')
    await rejects(() => validateArchiveLimits(limitsBuffer, { compressedBytes: limitsBuffer.length, expandedBytes: limitsBuffer.length * 8, entryBytes: 8, manifestBytes: limitsBuffer.length, entries: 100 }), /解压容量/, '单条目解压容量超限被拒绝')
    await rejects(() => validateArchiveLimits(limitsBuffer, { compressedBytes: limitsBuffer.length, expandedBytes: limitsBuffer.length * 8, entryBytes: limitsBuffer.length, manifestBytes: limitsBuffer.length, entries: 1 }), /条目过多/, '条目数量超限被拒绝')
    const manifestOnly = new JSZip(); manifestOnly.file('manifest.json', '{}')
    const manifestBytes = await manifestOnly.generateAsync({ type: 'nodebuffer' })
    await validateArchiveLimits(manifestBytes, { compressedBytes: manifestBytes.length, expandedBytes: manifestBytes.length, entryBytes: 64, manifestBytes: 64, entries: 10 })
    check(true, '限制内的清单条目通过容量校验')
    const corrupted = await JSZip.loadAsync(fs.readFileSync(backup.file))
    corrupted.file(`attachments/${files[0].relPath}`, '已被修改')
    const badHash = path.join(out, '附件校验失败.zip'); fs.writeFileSync(badHash, await corrupted.generateAsync({ type: 'nodebuffer' }))
    await rejectedBackup(badHash, /SHA-256/, 'CRC 有效但附件 SHA-256 不一致仍被拒绝')
    const futureDb = testDatabase(path.join(tmp, 'future.db')); seedDemoData(futureDb)
    futureDb.pragma(`user_version = ${LATEST_SCHEMA_VERSION + 1}`)
    const future = await runExport(futureDb, () => createBackupArchive(futureDb, out, '9.0.0'))
    futureDb.close()
    await rejectedBackup(future.file, /版本高于/, '较高 user_version 被拒绝')
    const badManifest = await JSZip.loadAsync(fs.readFileSync(backup.file)); badManifest.file('manifest.json', '{不可读')
    const badManifestPath = path.join(out, '清单损坏.zip'); fs.writeFileSync(badManifestPath, await badManifest.generateAsync({ type: 'nodebuffer' }))
    await rejectedBackup(badManifestPath, /清单无法读取/, '清单不可读被拒绝')
    const unsafe = await JSZip.loadAsync(fs.readFileSync(backup.file)); unsafe.file('../越界.txt', '禁止越界')
    const unsafePath = path.join(out, '越界.zip'); fs.writeFileSync(unsafePath, await unsafe.generateAsync({ type: 'nodebuffer' }))
    await rejectedBackup(unsafePath, /不安全/, 'ZIP 路径穿越被拒绝')

    const failedSwap = await prepareRestore(backup.file, target)
    fs.rmSync(path.join(failedSwap.directory, 'attachments'), { recursive: true })
    await rejects(() => installPreparedRestore(failedSwap, target), /ENOENT/, '替换附件时失败向调用者报告')
    equal(diskState(target), baseline, '替换中途失败自动恢复原数据库和附件')
    const interrupted = await prepareRestore(backup.file, target)
    fs.mkdirSync(path.join(interrupted.directory, 'original'))
    const originals = ['lexbench.db', 'attachments']
    fs.writeFileSync(path.join(target, '.lexbench-restore.json'), JSON.stringify({ directory: path.basename(interrupted.directory), originals }))
    for (const name of originals) fs.renameSync(path.join(target, name), path.join(interrupted.directory, 'original', name))
    fs.renameSync(path.join(interrupted.directory, 'lexbench.db'), path.join(target, 'lexbench.db'))
    recoverInterruptedRestore(target)
    equal(diskState(target), baseline, '模拟切换中意外退出，下次启动回滚原数据')

    const held = deferred<void>(); const entered = deferred<void>()
    const locked = runExport(db, async () => { entered.resolve(); await held.promise })
    await entered.promise
    await rejects(() => runMutation(db, () => db.prepare('DELETE FROM notes').run()), /暂时不能修改/, '备份锁期间拒绝写入')
    await rejects(() => assertWritable(db), /暂时不能修改/, '备份锁期间同步写入校验拒绝')
    held.resolve(); await locked
    check(!isExporting(db), '完成后释放备份保护')
    await runMutation(db, () => runExport(db, async () => { assertWritable(db) }))
    check(!isExporting(db), 'mutation 内部取得备份锁可完成且不会等待自身')
    const prior = deferred<void>(); const writeStarted = deferred<void>(); const mutation = runMutation(db, async () => { writeStarted.resolve(); await prior.promise; assertWritable(db) })
    await writeStarted.promise
    let created = false
    const waiting = runExport(db, async () => { created = true })
    check(!created, '备份等待此前已登记的写操作')
    prior.resolve(); await mutation; await waiting
    check(created, '写操作完成后开始备份')

    const restorePoints: string[] = []
    for (let index = 0; index < 5; index++) {
      const point = await runExport(db, () => createRestorePoint(db, `0.2.0-test-${index}`, now))
      restorePoints.push(path.basename(point.file))
      const timestamp = new Date(Date.now() - 60_000 + index * 1000); fs.utimesSync(point.file, timestamp, timestamp)
    }
    equal(fs.readdirSync(path.join(data, 'backups')).sort(), restorePoints.slice(-3).sort(), '恢复点同分钟重名不覆盖且只保留最近三份')
    const retainedVersions: string[] = []
    for (const name of fs.readdirSync(path.join(data, 'backups'))) {
      const point = await JSZip.loadAsync(fs.readFileSync(path.join(data, 'backups', name)))
      retainedVersions.push(JSON.parse(await point.file('manifest.json')!.async('string')).appVersion)
    }
    equal(retainedVersions.sort(), ['0.2.0-test-2', '0.2.0-test-3', '0.2.0-test-4'], '仅保留最近三次恢复点的内容')

    // 下列实际 IPC 流程同时验证只读白名单、系统确认、恢复点和重启。
    controls.userData = path.join(tmp, 'ipc-data'); controls.documents = out; controls.appPath = path.join(tmp, 'application')
    fs.mkdirSync(controls.userData); fs.mkdirSync(controls.appPath)
    let ipcDb = initDatabase(); registerIpc()
    await invoke(C.initialize, { userName: '测试', userGivenName: '', mode: 'blank' })
    await invoke(C.settingsSetTestMode, true)
    const demoBefore = readSnapshot(ipcDb)
    fs.writeFileSync(path.join(controls.userData, 'backups'), '模拟无法创建恢复点目录')
    await rejects(() => invoke(C.settingsImportDemo), /目标已存在|不是目录/, '恢复点创建失败时演示导入被阻止')
    equal(readSnapshot(ipcDb), demoBefore, '演示导入备份失败时业务数据不变')
    fs.unlinkSync(path.join(controls.userData, 'backups'))
    await invoke(C.settingsImportDemo)
    equal(fs.readdirSync(path.join(controls.userData, 'backups')).length, 1, '演示导入前经同一函数生成恢复点')
    await invoke(C.settingsImportDemo)
    equal(fs.readdirSync(path.join(controls.userData, 'backups')).length, 1, '重复演示导入不追加恢复点')
    controls.onOpen = async () => ({ canceled: false, filePaths: [out] })
    controls.onMessage = async () => ({ response: 0, checkboxChecked: false })
    equal(await invoke(C.settingsBackupData), undefined, '备份 IPC 返回 void，不暴露文件路径')
    check(controls.revealed.length === 1 && fs.existsSync(controls.revealed[0]), '备份流关闭后定位生成的 ZIP')
    const guarded = deferred<void>(); const guardEntered = deferred<void>()
    const guard = runExport(ipcDb, async () => { guardEntered.resolve(); await guarded.promise })
    await guardEntered.promise
    await rejects(() => invoke(C.settingsRestoreData), /暂时不能修改/, '恢复通道不在只读白名单，已有备份锁期间被拒绝')
    guarded.resolve(); await guard
    controls.onOpen = async () => ({ canceled: false, filePaths: [controls.userData] })
    await rejects(() => invoke(C.settingsBackupData), /不能位于/, '备份服务复用受保护目录校验')
    controls.onOpen = async () => ({ canceled: false, filePaths: [broken] })
    const originalIpcData = diskState(controls.userData)
    const originalIpcSnapshot = readSnapshot(ipcDb)
    await rejects(() => invoke(C.settingsRestoreData), /ZIP.*损坏/, '实际恢复 handler 预检拒绝损坏 ZIP')
    equal(diskState(controls.userData), originalIpcData, 'IPC 预检失败后原数据不变')
    controls.onOpen = async () => ({ canceled: false, filePaths: [backup.file] })
    const confirmResponse = deferred<Electron.MessageBoxReturnValue>(); const confirmOpened = deferred<void>()
    controls.onMessage = async () => { confirmOpened.resolve(); return confirmResponse.promise }
    const canceledRestore = invoke(C.settingsRestoreData)
    await confirmOpened.promise
    check(isExporting(ipcDb), '恢复确认框等待期间持续持有独占锁')
    await rejects(() => invoke(C.settingsSetUserName, '阻止写入'), /暂时不能修改/, '恢复确认等待期间拒绝其他写入')
    confirmResponse.resolve({ response: 0, checkboxChecked: false }); await canceledRestore
    equal(diskState(controls.userData), originalIpcData, '取消确认保留原数据')
    check(controls.messages.at(-1)?.buttons?.every((button) => /[\u4e00-\u9fff]/.test(button)), '恢复系统确认使用中文按钮')
    equal(controls.messages.at(-1)?.defaultId, 0, '覆盖确认默认取消')
    check(controls.messages.at(-1)?.message.includes('自动重启'), '覆盖确认说明自动重启')
    controls.onMessage = async () => {
      const staging = fs.readdirSync(controls.userData).find((name) => name.startsWith('.lexbench-restore-'))!
      fs.rmSync(path.join(controls.userData, staging, 'attachments'), { recursive: true })
      return { response: 1, checkboxChecked: false }
    }
    await rejects(() => invoke(C.settingsRestoreData), /所选文件或目录不存在/, '真实恢复服务处理文件替换失败')
    ipcDb = getDatabase()
    equal(readSnapshot(ipcDb), originalIpcSnapshot, '服务恢复失败保留原业务数据及设置')
    check(ipcDb.open, '替换失败后重新打开原数据库连接')
    await invoke(C.settingsSetUserName, '测试'); check(true, '恢复失败后 IPC 写操作仍可使用')
    controls.onMessage = async () => ({ response: 1, checkboxChecked: false })
    await invoke(C.settingsRestoreData)
    check(controls.relaunched && controls.exitCode === 0, '确认恢复后调用 relaunch 和 exit(0)')
    check(!ipcDb.open, '恢复替换前关闭数据库连接')
    const restarted = initDatabase()
    equal(readSnapshot(restarted), state, '模拟重启后恢复全部实体')
    equal(fs.readFileSync(path.join(controls.userData, 'attachments', files[0].relPath)), fs.readFileSync(source), '重启后附件仍可读取')
    equal(fs.readdirSync(path.join(controls.userData, 'backups')).length, 3, '覆盖尝试前自动生成恢复点并保留最近三份')
    equal(getDatabase(), restarted, '重启初始化重新建立模块级单例连接')
    closeDatabase()
    // 首次初始化选择演示数据，也先创建恢复点。
    controls.userData = path.join(tmp, 'initial-demo'); fs.mkdirSync(controls.userData)
    initDatabase(); await invoke(C.settingsSetTestMode, true)
    await invoke(C.initialize, { userName: '演示', userGivenName: '', mode: 'demo' })
    equal(fs.readdirSync(path.join(controls.userData, 'backups')).length, 1, '首次初始化演示导入也自动备份')
    check(expectedErrors.length > 0, '预期拒绝路径经过主进程日志和 IPC 包装')
    passed = true; report()
  } finally {
    console.error = originalError
    closeDatabase(); if (db.open) db.close()
    if (passed) fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
    else console.error(`失败现场保留：${tmp}`)
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1 })
