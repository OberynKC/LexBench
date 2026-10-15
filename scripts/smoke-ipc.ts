/** 真 handler + 临时数据库 + Electron 对话框替身；不访问真实窗口或用户数据。 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { AppState } from '../src/types/api'
import { controls, handlers, testWindow } from './fixtures/electron'
import { initDatabase, closeDatabase } from '../electron/db'
import { registerIpc } from '../electron/ipc/register'
import { IPC_CHANNELS as C } from '../electron/ipc/channels'
import { isExporting, runExport, runMutation } from '../electron/export/exportGate'
import { seedDemoData } from '../electron/db/services/seedService'
import { selectAndStoreFiles, confirmAndDeleteFile } from '../electron/db/services/fileService'
import { attachmentsRootForDatabase, copyFilesToOwner } from '../electron/files/attachmentStorage'
import { removeContract } from '../electron/db/services/contractService'
import { removeInvoice } from '../electron/db/services/invoiceService'
import { contractReturnPath } from '../src/lib/contractNavigation'
import { errorMessage } from '../src/lib/dialogs'
import { check, equal, rejects, report, deferred } from './testSupport'

const invoke = (channel: string, payload?: unknown) => handlers.get(channel)!({ sender: testWindow.webContents, senderFrame: testWindow.webContents.mainFrame }, payload)
async function main() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lexbench-ipc-smoke-'))
  controls.userData = path.join(tmp, 'data')
  controls.documents = path.join(tmp, 'exports')
  controls.appPath = path.join(tmp, 'application')
  for (const directory of [controls.userData, controls.documents, controls.appPath]) fs.mkdirSync(directory)
  const db = initDatabase()
  let passed = false
  const originalError = console.error
  const expectedErrors: unknown[][] = []
  console.error = (...args) => { expectedErrors.push(args) }
  try {
    registerIpc(); registerIpc()
    equal(handlers.size, 48, '48 个 handler 全部注册且重复调用幂等')
    await rejects(() => handlers.get(C.bootstrap)!({ sender: testWindow.webContents }, undefined), /来源未经授权/, 'IPC 拒绝缺少发送框架的请求')
    await rejects(() => handlers.get(C.bootstrap)!({ sender: testWindow.webContents, senderFrame: { ...testWindow.webContents.mainFrame } }, undefined), /来源未经授权/, 'IPC 拒绝子框架请求')
    const trustedUrl = testWindow.webContents.mainFrame.url
    testWindow.webContents.mainFrame.url = 'https://example.com/'
    await rejects(() => invoke(C.bootstrap), /来源未经授权/, 'IPC 拒绝远程页面请求')
    testWindow.webContents.mainFrame.url = trustedUrl
    await invoke(C.initialize, { userName: ' 王 ', userGivenName: '', mode: 'blank' })
    await invoke(C.settingsSetReminderSystem, false)
    await invoke(C.settingsSetReminderBadge, false)
    await invoke(C.markRemindersSeen, ['todo:ipc:2026-10-04:week'])
    const reminderState = (await invoke(C.bootstrap) as { state: AppState }).state
    equal([reminderState.reminderSystem, reminderState.reminderBadge, reminderState.reminderSeen],
      [false, false, ['todo:ipc:2026-10-04:week']], '提醒设置和已读通过真实 IPC 持久化')
    await rejects(() => invoke(C.settingsSetReminderSystem, 'false'), /布尔值/, '提醒开关 IPC 拒绝非布尔值')
    await rejects(() => invoke(C.markRemindersSeen, ['invalid']), /指纹格式无效/, '已读 IPC 校验指纹')
    await runExport(db, async () => {
      await rejects(() => invoke(C.markRemindersSeen, ['todo:ipc:2026-10-05:week']), /正在导出/, '导出锁保护提醒已读写入')
      await rejects(() => invoke(C.settingsSetReminderBadge, true), /正在导出/, '导出锁保护提醒设置')
    })
    await rejects(() => invoke(C.settingsSetUserName, ' \t'), /^Error: 保存姓名失败：姓不能为空或纯空白$/, '姓名错误只有一层中文前缀')
    await rejects(() => invoke(C.settingsImportDemo), /^Error: 导入演示数据失败：请先开启测试模式再导入演示数据$/, '导入开关由实际 handler 服务端校验')
    await rejects(() => invoke(C.todoDelete, 'missing'), /^Error: 删除待办失败：目标记录不存在或受影响行数异常$/, '不存在记录错误没有重复前缀')
    const todo = { id: 'ipc-todo', title: '测试期限', caseId: null, done: false, deadline: '2026-10-01', createdAt: '2026-09-01T00:00:00Z' }
    await invoke(C.todoCreate, todo)
    const snapshot = (await invoke(C.bootstrap) as { state: AppState }).state
    const linked = snapshot.events.find((event) => event.todoId === todo.id)!
    await rejects(() => invoke(C.eventDelete, linked.id), /^Error: 删除日程失败：该事件由待办事项自动同步，请在待办中修改$/, '联动事件错误不重复')
    const event = { id: 'manual', title: '手工', type: '其他', caseId: null, start: '2026-10-01T09:00:00', end: '2026-10-01T10:00:00', location: '', reminder: '' }
    await rejects(() => invoke(C.eventCreate, { ...event, todoId: todo.id }), /手工日程不能绑定待办/, '手工事件绑定待办被拒绝')
    await rejects(() => invoke(C.eventCreate, { ...event, end: '2026-10-01T08:00:00' }), /结束.*开始/, '结束早于开始被拒绝')
    equal(errorMessage(new Error("Error invoking remote method 'db:event:delete': Error: 删除日程失败：目标记录不存在")), '删除日程失败：目标记录不存在', '渲染层仅去除英文 IPC 包装')
    const confirm = { title: '确认删除', message: '确定删除吗？', confirmLabel: '删除' }
    equal(await invoke(C.dialogConfirm, confirm), false, '取消系统确认返回 false')
    equal(controls.messages.at(-1)?.buttons, ['取消', '删除'], '确认按钮全部中文')
    equal(controls.messages.at(-1)?.defaultId, 0, '删除默认选择取消')
    equal(controls.messages.at(-1)?.cancelId, 0, '关闭确认框视为取消')
    controls.onMessage = async () => ({ response: 1, checkboxChecked: false })
    equal(await invoke(C.dialogConfirm, { ...confirm, confirmLabel: '导入' }), true, '确认导入返回 true')
    controls.onMessage = async () => ({ response: 0, checkboxChecked: false })
    await invoke(C.dialogAlert, { title: '提示', message: '内容' })
    equal(controls.messages.at(-1)?.buttons, ['知道了'], '提示按钮为中文')
    await rejects(() => invoke(C.dialogConfirm, { ...confirm, confirmLabel: '执行任意命令' }), /确认按钮/, '拒绝非约定确认按钮')
    await rejects(() => invoke(C.dialogAlert, { title: '', message: '内容' }), /标题/, '提示参数边界校验')

    seedDemoData(db)
    const noteDraft = { noteId: 'n1', caseId: 'case1', title: '', content: 'IPC 草稿', tags: ['草稿'] }
    await invoke(C.saveNoteDraft, noteDraft)
    equal((await invoke(C.getNoteDraft, 'n1') as { content: string }).content, 'IPC 草稿', '真实 IPC 草稿存取')
    await rejects(() => invoke(C.saveNoteDraft, { ...noteDraft, tags: [1] }), /必须是字符串/, '真实 IPC 拒绝无效草稿')
    const note = (await invoke(C.bootstrap) as { state: AppState }).state.notes.find((item) => item.id === 'n1')!
    await invoke(C.noteUpdate, { ...note, title: 'IPC 正式笔记', updatedAt: new Date().toISOString() })
    const noteVersions = await invoke(C.listNoteVersions, 'n1') as { id: string }[]
    equal(noteVersions.length, 2, '真实更新 handler 生成首次历史')
    check(await invoke(C.getNoteVersion, noteVersions[0].id), '真实 IPC 读取指定版本')
    equal(await invoke(C.getNoteDraft, 'n1'), null, '真实正式保存清理草稿')
    await invoke(C.saveNoteDraft, noteDraft)
    const source = path.join(tmp, '虚构附件.txt'); fs.writeFileSync(source, 'IPC 回归附件')
    const file = copyFilesToOwner(db, { type: 'contract', id: 'ct1' }, [source])[0]
    equal(await invoke(C.fileDelete, file.id), false, '取消附件删除不执行操作')
    check(fs.existsSync(path.join(attachmentsRootForDatabase(db), file.relPath)), '取消后附件源文件存在')

    const lease = deferred<void>(); const acquired = deferred<void>()
    const exporting = runExport(db, async () => { acquired.resolve(); await lease.promise })
    await acquired.promise
    await rejects(() => invoke(C.saveNoteDraft, noteDraft), /正在导出数据/, '锁定期间拒绝自动草稿写入')
    await rejects(() => invoke(C.deleteNoteDraft, 'n1'), /正在导出数据/, '锁定期间拒绝丢弃草稿')
    check(await invoke(C.getNoteDraft, 'n1'), '锁定期间仍可读取草稿')
    equal((await invoke(C.listNoteVersions, 'n1') as unknown[]).length, 2, '锁定期间仍可读取历史列表')
    check(await invoke(C.getNoteVersion, noteVersions[0].id), '锁定期间仍可读取指定历史')
    equal(await invoke(C.settingsGetExportStatus), true, '导出状态查询反映主进程锁')
    check(controls.notifications.some((n) => n.channel === C.exportStatusChanged && n.value), '导出开始发送状态通知')
    for (const [channel, payload] of [[C.todoCreate, { ...todo, id: 'blocked' }], [C.settingsSetTestMode, true], [C.contractDelete, 'ct1'], [C.fileSelectAndStore, { type: 'case', id: 'case1' }], [C.fileDelete, file.id]] as const) {
      await rejects(() => invoke(channel, payload), /正在导出数据/, '导出期间拒绝新增修改、设置或附件操作')
    }
    await invoke(C.bootstrap); check(true, '导出期间仍可读取业务数据')
    await invoke(C.fileOpen, file.id); check(true, '导出期间仍可打开附件')
    await rejects(() => removeContract(db, 'ct1'), /正在导出数据/, '合同级联删除在实际写入前兜底')
    await rejects(() => removeInvoice(db, 'inv1'), /正在导出数据/, '发票级联删除在实际写入前兜底')
    await rejects(() => runExport(db, async () => undefined), /已有数据导出/, '阻止重复导出')
    lease.resolve(); await exporting
    equal(await invoke(C.settingsGetExportStatus), false, '完成后释放导出锁')
    await invoke(C.settingsSetUserName, '李'); check(true, '导出结束后恢复写入')
    await rejects(() => runExport(db, async () => { throw new Error('模拟压缩失败') }), /模拟压缩失败/, '导出异常向上传递')
    equal(isExporting(db), false, '失败后释放导出锁')
    const writeFailure = deferred<void>()
    const priorWrite = runMutation(db, () => writeFailure.promise)
    let startedArtifacts = false
    const abortExport = runExport(db, async () => { startedArtifacts = true })
    const expectedWriteFailure = rejects(() => priorWrite, /已有保存失败/, '已有写操作失败被保留')
    const expectedExportFailure = rejects(() => abortExport, /已有修改未能保存/, '已有写操作失败时终止导出')
    writeFailure.reject(new Error('已有保存失败'))
    await Promise.all([expectedWriteFailure, expectedExportFailure])
    check(!startedArtifacts && !isExporting(db), '未生成产物且解除导出保护')


    // 直接服务调用模拟已打开的原生对话框在锁定后返回：必须在实际写入前再次检查。
    const openResponse = deferred<Electron.OpenDialogReturnValue>()
    controls.onOpen = () => openResponse.promise
    const delayedUpload = selectAndStoreFiles(db, null, { type: 'case', id: 'case1' })
    const hold = deferred<void>(); const holdReady = deferred<void>()
    const heldExport = runExport(db, async () => { holdReady.resolve(); await hold.promise })
    await holdReady.promise
    const uploadRejected = rejects(() => delayedUpload, /正在导出数据/, '上传选择框延迟返回不能绕过导出锁')
    openResponse.resolve({ canceled: false, filePaths: [source] }); await uploadRejected
    hold.resolve(); await heldExport

    const deleteResponse = deferred<Electron.MessageBoxReturnValue>()
    const deleteOpened = deferred<void>()
    controls.onMessage = () => { deleteOpened.resolve(); return deleteResponse.promise }
    const delayedDelete = confirmAndDeleteFile(db, null, file.id)
    await deleteOpened.promise
    const holdDelete = deferred<void>(); const holdDeleteReady = deferred<void>()
    const lockedDelete = runExport(db, async () => { holdDeleteReady.resolve(); await holdDelete.promise })
    await holdDeleteReady.promise
    const deleteRejected = rejects(() => delayedDelete, /正在导出数据/, '删除确认框延迟返回不能绕过导出锁')
    deleteResponse.resolve({ response: 1, checkboxChecked: false }); await deleteRejected
    check(fs.existsSync(path.join(attachmentsRootForDatabase(db), file.relPath)), '拦截延迟删除后源文件完整')
    holdDelete.resolve(); await lockedDelete
    controls.onMessage = async () => ({ response: 0, checkboxChecked: false })

    // 正常 IPC 路径：导出准备阶段等待已经登记的上传完成，之后才固定快照。
    const pendingOpen = deferred<Electron.OpenDialogReturnValue>(); const uploadOpened = deferred<void>()
    controls.onOpen = async (options) => {
      if (options.properties?.includes('openFile')) { uploadOpened.resolve(); return pendingOpen.promise }
      return { canceled: false, filePaths: [controls.documents] }
    }
    const upload = invoke(C.fileSelectAndStore, { type: 'case', id: 'case1' })
    await uploadOpened.promise
    const exportRequest = invoke(C.settingsExportData)
    check(isExporting(db), '已有上传期间进入导出准备状态')
    equal(controls.revealed.length, 0, '上传未完成前没有提示导出成功')
    pendingOpen.resolve({ canceled: false, filePaths: [source] })
    await upload; await exportRequest
    check(controls.revealed.length === 1 && fs.existsSync(path.join(controls.revealed[0], '附件.zip')), '等待上传后真实导出完成')
    equal(isExporting(db), false, '正常导出服务完成后解除保护')
    controls.onOpen = async () => ({ canceled: true, filePaths: [] })
    await invoke(C.settingsExportData)
    equal(isExporting(db), false, '取消目录选择解除保护')
    const priorOutput = fs.readdirSync(controls.documents)
    for (const protectedDirectory of [controls.userData, controls.appPath, attachmentsRootForDatabase(db)]) {
      controls.onOpen = async () => ({ canceled: false, filePaths: [protectedDirectory] })
      await rejects(() => invoke(C.settingsExportData), /不能位于/, '实际导出服务拒绝应用受限目录')
      equal(isExporting(db), false, '路径不合法也解除保护')
    }
    equal(fs.readdirSync(controls.documents), priorOutput, '取消及拒绝路径不改变已有导出')

    const fakeState = { clients: [{ id: 'client1' }], cases: [{ id: 'case1' }] } as Pick<AppState, 'clients' | 'cases'>
    for (const sourcePath of ['/contracts', '/clients/client1', '/cases/case1']) equal(contractReturnPath(sourcePath, fakeState), sourcePath, '删除合同返回有效来源')
    for (const sourcePath of [undefined, '/clients/deleted', '/cases/deleted', '/contracts/deleted', 'https://example.com']) equal(contractReturnPath(sourcePath, fakeState), '/contracts', '删除合同无效来源回总表')
    check(expectedErrors.length > 0, '预期拒绝路径均由实际 IPC 错误包装执行')
    passed = true; report()
  } finally {
    console.error = originalError
    closeDatabase()
    if (passed) fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
    else console.error(`失败现场保留：${tmp}`)
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1 })
