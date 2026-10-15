/**
 * 数据库冒烟测试（不依赖 Electron GUI）：
 *   npm run smoke:db
 *
 * 覆盖：迁移与 schema、bootstrap / initialize 启动流、演示数据入库一致性、
 * 待办 ↔ 日程联动、删除合同级联清理、IPC payload 边界校验。
 *
 * 运行方式：esbuild 打包为 CJS 后用 `ELECTRON_RUN_AS_NODE=1 electron` 执行——
 * better-sqlite3 已按 Electron ABI 重建（npm run setup），系统 node 无法加载。
 * 本脚本不得导入 electron 模块（数据库单例依赖 app.getPath），各 service 均接收 db 参数。
 */
import Database from 'better-sqlite3'
import dayjs from 'dayjs'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { migrations, runMigrations } from '../electron/db/migrations'
import { findEventByTodoId, createEvent, deleteEvent, listEvents, updateEvent } from '../electron/db/repos/eventsRepo'
import { bootstrap, initialize } from '../electron/db/services/bootstrapService'
import { removeContract } from '../electron/db/services/contractService'
import {
  attachmentsRootForDatabase,
  copyFilesToOwner,
  deleteFileAndContent,
} from '../electron/files/attachmentStorage'
import { importDemo, setTestMode, setUserGivenName, setUserName } from '../electron/db/services/settingsService'
import { createTodo, removeTodo, updateTodo } from '../electron/db/services/todoService'
import { createNote, updateNote } from '../electron/db/services/notesService'
import { createCase } from '../electron/db/services/caseService'
import { deleteNote, getNote, getDraft, saveDraft, deleteDraft, listVersions, getVersion } from '../electron/db/repos/notesRepo'
import {
  validateCase,
  validateEvent,
  validateFileOwner,
  validateId,
  validateInitialSetupMode,
  validateInitialSetupPayload,
  validateTodo,
  validateUserName,
  validateNoteDraft,
  validateNoteCreation,
} from '../electron/db/validation'
import { todoEventId } from '../src/lib/todoEvent'
import * as mock from '../src/mock/data'
import { collectReminders, deadlineBucket, isRedReminder } from '../src/lib/reminders'
import { markRemindersSeen, setReminderPreference, recordReminderSent } from '../electron/db/repos/remindersRepo'
import { createReminderService } from '../electron/db/services/reminderService'
import { runExport } from '../electron/export/exportGate'
import type { CalendarEvent, Note, Todo } from '../src/types'

let passed = 0
let failed = 0

function ok(condition: boolean, name: string): void {
  if (condition) {
    passed += 1
    console.log(`  ✓ ${name}`)
  } else {
    failed += 1
    console.error(`  ✗ ${name}`)
  }
}

function eq(actual: unknown, expected: unknown, name: string): void {
  const same = JSON.stringify(actual) === JSON.stringify(expected)
  ok(same, same ? name : `${name}（实际 ${JSON.stringify(actual)}，期望 ${JSON.stringify(expected)}）`)
}

function throws(fn: () => unknown, name: string): void {
  try {
    fn()
    ok(false, `${name}（未按预期抛出异常）`)
  } catch {
    ok(true, name)
  }
}

function section(name: string, run: () => void): void {
  console.log(`\n== ${name} ==`)
  try {
    run()
  } catch (error) {
    failed += 1
    console.error(`  ✗ 分节执行异常：${error instanceof Error ? error.message : String(error)}`)
  }
}

/** 与主进程 initDatabase 相同的连接参数（级联删除依赖 foreign_keys） */
function openTestDatabase(file: string): Database.Database {
  const db = new Database(file)
  db.pragma('foreign_keys = ON')
  db.pragma('journal_mode = WAL')
  db.pragma('synchronous = NORMAL')
  db.pragma('busy_timeout = 5000')
  runMigrations(db)
  return db
}

function tableNames(db: Database.Database): string[] {
  return db
    .prepare<[], { name: string }>("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
    .all()
    .map((row) => row.name)
}

function countRows(db: Database.Database, table: string, where = ''): number {
  const row = db
    .prepare(`SELECT COUNT(*) AS count FROM ${table}${where ? ` WHERE ${where}` : ''}`)
    .get() as { count: number }
  return row.count
}

function idsOf(list: { id: string }[]): string[] {
  return list.map((value) => value.id)
}

const EXPECTED_TABLES = [
  'app_meta',
  'calendar_events',
  'case_related',
  'cases',
  'clients',
  'contract_cases',
  'contracts',
  'fee_records',
  'file_meta',
  'invoices',
  'note_drafts',
  'note_versions',
  'notes',
  'preservations',
  'reminder_log',
  'todos',
]

async function main(): Promise<void> {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lexbench-smoke-'))
  const demoDb = openTestDatabase(path.join(tmpDir, 'demo.db'))
  const blankDb = openTestDatabase(path.join(tmpDir, 'blank.db'))
  const settingsDb = openTestDatabase(path.join(tmpDir, 'settings.db'))
  const latestVersion = migrations[migrations.length - 1].version

  section('迁移与 schema', () => {
    eq(demoDb.pragma('user_version', { simple: true }), latestVersion, 'user_version 迁移到最新版本')
    eq(tableNames(demoDb), EXPECTED_TABLES, '全部 16 张表建立')
    runMigrations(demoDb)
    eq(demoDb.pragma('user_version', { simple: true }), latestVersion, '迁移重放幂等（版本不回退不重复）')
    eq(tableNames(demoDb), EXPECTED_TABLES, '迁移重放不重复建表')
    eq(demoDb.pragma('foreign_keys', { simple: true }), 1, '外键约束已开启')

    const columns = demoDb.prepare<[], { name: string }>('PRAGMA table_info(file_meta)').all().map((row) => row.name)
    ok(columns.includes('case_id'), 'file_meta 支持案件归属')
    ok(columns.includes('stored_name') && columns.includes('rel_path'), 'file_meta 包含真实文件路径字段')

    throws(
      () => demoDb.prepare(`
        INSERT INTO file_meta (
          id, contract_id, invoice_id, case_id, name, stored_name, rel_path, size, uploaded_at, sort_order
        ) VALUES ('invalid-owner-none', NULL, NULL, NULL, 'x', 'x-a', 'contracts/ct1/x-a', 1, ?, 99)
      `).run(new Date().toISOString()),
      '附件必须挂在一个归属对象上',
    )
    throws(
      () => demoDb.prepare(`
        INSERT INTO file_meta (
          id, contract_id, invoice_id, case_id, name, stored_name, rel_path, size, uploaded_at, sort_order
        ) VALUES ('invalid-owner-two', 'ct1', NULL, 'case1', 'x', 'x-b', 'contracts/ct1/x-b', 1, ?, 99)
      `).run(new Date().toISOString()),
      '附件不能同时挂在两个归属对象上',
    )

    const legacyDb = new Database(path.join(tmpDir, 'legacy-v1.db'))
    legacyDb.pragma('foreign_keys = ON')
    migrations[0].up(legacyDb)
    legacyDb.pragma('user_version = 1')
    legacyDb.prepare("INSERT INTO clients (id, name, type) VALUES ('legacy-client', '旧客户', '个人')").run()
    legacyDb.prepare(`
      INSERT INTO contracts (id, contract_no, client_id, signed_at, fee_mode, total_fee_cents, status)
      VALUES ('legacy-contract', '旧合同', 'legacy-client', '2026-01-01', '固定收费', 0, '履行中')
    `).run()
    legacyDb.prepare(`
      INSERT INTO file_meta (id, contract_id, invoice_id, name, size, uploaded_at, sort_order)
      VALUES ('legacy-file', 'legacy-contract', NULL, '旧附件.pdf', 12, '2026-01-01T00:00:00.000Z', 0)
    `).run()
    runMigrations(legacyDb)
    const legacyFile = legacyDb.prepare<[], { stored_name: string; rel_path: string; case_id: string | null }>(`
      SELECT stored_name, rel_path, case_id FROM file_meta WHERE id = 'legacy-file'
    `).get()
    eq(legacyDb.pragma('user_version', { simple: true }), latestVersion, '有数据的 v1 数据库迁移到最新版本')
    eq(legacyFile, { stored_name: '', rel_path: '', case_id: null }, '旧版仅元数据附件安全保留为空路径记录')
    legacyDb.close()

    const v2Db = new Database(path.join(tmpDir, 'legacy-v2.db'))
    v2Db.pragma('foreign_keys = ON')
    migrations.slice(0, 2).forEach((migration) => migration.up(v2Db))
    v2Db.pragma('user_version = 2')
    setTestMode(v2Db, true)
    const oldNotes = initialize(v2Db, { userName: '测试', userGivenName: '', mode: 'demo' }).notes
    runMigrations(v2Db)
    eq(v2Db.pragma('user_version', { simple: true }), latestVersion, '有笔记的 v2 数据库迁移到最新版本')
    eq(bootstrap(v2Db).state.notes, oldNotes, 'v3 迁移完整保留既有笔记')
    eq(countRows(v2Db, 'note_versions'), 0, '迁移不批量生成历史')
    eq(countRows(v2Db, 'note_drafts'), 0, '迁移不批量生成草稿')
    v2Db.close()
  })

  section('启动流：bootstrap 与演示数据初始化', () => {
    const first = bootstrap(demoDb)
    ok(first.setupRequired === true, '空库 bootstrap 返回 setupRequired = true')
    ok(
      (['cases', 'clients', 'notes', 'preservations', 'events', 'todos', 'contracts', 'fees', 'invoices'] as const).every(
        (key) => first.state[key].length === 0,
      ),
      '空库 bootstrap 返回全空 state',
    )
    eq(first.state.userName, '', '空库 bootstrap 无姓名')
    eq(first.state.testMode, false, '空库 bootstrap 测试模式默认关')
    eq(first.state.demoImported, false, '空库 bootstrap 从未导入演示数据')

    throws(() => initialize(demoDb, { userName: '演示', userGivenName: '', mode: 'demo' }), '首次初始化关闭测试模式时拒绝演示导入')
    eq(bootstrap(demoDb).setupRequired, true, '拒绝导入不标记初始化完成')
    eq(countRows(demoDb, 'clients'), 0, '拒绝初始化演示导入不写业务数据')
    setTestMode(demoDb, true)
    const state = initialize(demoDb, validateInitialSetupPayload({ userName: '演示', userGivenName: '用户', mode: 'demo' }))
    eq(state.userName, '演示', '初始化写入姓')
    eq(state.userGivenName, '用户', '初始化写入名')
    eq(state.demoImported, true, '初始化 demo 标记已导入演示数据')
    eq(state.clients.length, mock.clients.length, '客户数量与 Mock 一致')
    eq(state.cases.length, mock.cases.length, '案件数量与 Mock 一致')
    eq(state.contracts.length, mock.contracts.length, '合同数量与 Mock 一致')
    eq(state.fees.length, mock.fees.length, '收费期次数量与 Mock 一致')
    eq(state.invoices.length, mock.invoices.length, '发票数量与 Mock 一致')
    eq(state.notes.length, mock.notes.length, '笔记数量与 Mock 一致')
    eq(state.preservations.length, mock.preservations.length, '保全执行数量与 Mock 一致')
    eq(state.todos.length, mock.todos.length, '待办数量与 Mock 一致')
    eq(state.events.length, mock.events.length, '日程数量与 Mock 一致')
    ok(
      (
        [
          [idsOf(state.clients), idsOf(mock.clients)],
          [idsOf(state.cases), idsOf(mock.cases)],
          [idsOf(state.contracts), idsOf(mock.contracts)],
          [idsOf(state.fees), idsOf(mock.fees)],
          [idsOf(state.invoices), idsOf(mock.invoices)],
          [idsOf(state.notes), idsOf(mock.notes)],
          [idsOf(state.preservations), idsOf(mock.preservations)],
          [idsOf(state.todos), idsOf(mock.todos)],
          [idsOf(state.events), idsOf(mock.events)],
        ] as const
      ).every(([actual, expected]) => JSON.stringify(actual) === JSON.stringify(expected)),
      '九类实体快照顺序与 Mock 完全一致',
    )

    eq(state.cases.find((v) => v.id === 'case1')?.amount, mock.cases[0].amount, '案件金额元 ↔ 分往返一致')
    eq(state.contracts.find((v) => v.id === 'ct1')?.totalFee, mock.contracts[0].totalFee, '合同金额元 ↔ 分往返一致')
    eq(state.notes.find((v) => v.id === 'n1')?.tags, mock.notes[0].tags, '笔记标签 JSON 往返一致')
    eq(state.cases.find((v) => v.id === 'case13')?.relatedCaseIds, ['case14'], '案件关联 case13 → case14 恢复')
    eq(state.cases.find((v) => v.id === 'case14')?.relatedCaseIds, ['case13'], '案件关联 case14 → case13 恢复')
    eq(state.contracts.find((v) => v.id === 'ct1')?.files.map((f) => f.id), ['f1', 'f2'], '合同附件顺序恢复')
    eq(state.contracts.find((v) => v.id === 'ct1')?.caseIds, ['case1'], '合同关联案件恢复')
    eq(state.contracts.find((v) => v.id === 'ct2')?.caseIds, ['case3', 'case15'], '一合同多案件的关联顺序恢复')
    eq(state.invoices.find((v) => v.id === 'inv1')?.files.map((f) => f.id), ['f7'], '发票附件恢复')

    ok(state.events.every((event) => event.todoId == null), '初始日程均不绑定待办（todoId 为空）')
    ok(!state.events.some((event) => event.id.startsWith('todo_event_')), '初始待办不批量补建期限事件')

    ok(bootstrap(demoDb).setupRequired === false, '初始化后 bootstrap 返回 setupRequired = false')
    eq(
      initialize(demoDb, validateInitialSetupPayload({ userName: '演示', userGivenName: '用户', mode: 'demo' })).clients.length,
      mock.clients.length,
      '重复 initialize 不重复灌入',
    )
  })

  section('启动流：空白初始化', () => {
    const state = initialize(blankDb, validateInitialSetupPayload({ userName: '测试', userGivenName: '律师', mode: 'blank' }))
    eq(state.userName, '测试', '空白初始化写入姓')
    eq(state.userGivenName, '律师', '空白初始化写入名')
    ok(
      (['cases', 'clients', 'notes', 'preservations', 'events', 'todos', 'contracts', 'fees', 'invoices'] as const).every(
        (key) => state[key].length === 0,
      ),
      '空白初始化后全部表为空',
    )
    ok(bootstrap(blankDb).setupRequired === false, '空白初始化后不再要求初始化')
  })

  section('设置服务：姓名 / 测试模式 / 演示数据', () => {
    // 模拟首次启动填名（blank）
    initialize(settingsDb, validateInitialSetupPayload({ userName: '李', userGivenName: '建国', mode: 'blank' }))
    eq(bootstrap(settingsDb).state.userName, '李', 'bootstrap 带出已存姓')
    eq(bootstrap(settingsDb).state.userGivenName, '建国', 'bootstrap 带出已存名')
    ok(bootstrap(settingsDb).state.testMode === false, 'bootstrap 带出测试模式默认关')
    ok(bootstrap(settingsDb).state.demoImported === false, 'bootstrap 带出从未导入演示数据')

    setUserName(settingsDb, '王')
    setUserGivenName(settingsDb, '小明')
    eq(bootstrap(settingsDb).state.userName, '王', 'setUserName 写入新姓')
    eq(bootstrap(settingsDb).state.userGivenName, '小明', 'setUserGivenName 写入新名')

    setTestMode(settingsDb, true)
    ok(bootstrap(settingsDb).state.testMode === true, 'setTestMode(true) 开启测试模式')
    setTestMode(settingsDb, false)
    ok(bootstrap(settingsDb).state.testMode === false, 'setTestMode(false) 关闭测试模式')

    // 只有从未导入过演示数据时才灌入
    throws(() => importDemo(settingsDb), '关闭测试模式时服务端拒绝导入')
    eq(bootstrap(settingsDb).state.demoImported, false, '拒绝导入不更改标记')
    eq(countRows(settingsDb, 'clients'), 0, '拒绝导入不写业务数据')
    setTestMode(settingsDb, true)
    const snapshot = importDemo(settingsDb)
    eq(snapshot.clients.length, mock.clients.length, 'importDemo 灌入演示数据')
    ok(bootstrap(settingsDb).state.demoImported === true, 'importDemo 后标记 demo_imported')
    eq(importDemo(settingsDb).clients.length, mock.clients.length, '重复 importDemo 幂等（不重复灌入）')
    eq(countRows(settingsDb, 'clients'), mock.clients.length, '重复 importDemo 后客户数不变')
    setTestMode(settingsDb, false)
    throws(() => importDemo(settingsDb), '已导入后关闭测试模式也拒绝导入调用')
    eq(countRows(settingsDb, 'clients'), mock.clients.length, '拒绝重复导入不改变既有数据')
  })

  section('笔记草稿、历史事务与级联清理', () => {
    const original: Note = { ...mock.notes[0], id: 'history-note', title: '原文', content: '# 原文\n旧内容',
      tags: ['原标签'], createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' }
    createNote(demoDb, original)
    eq(listVersions(demoDb, original.id), [], '新建笔记不提前生成修改历史')
    const draftInput = { noteId: original.id, caseId: original.caseId, title: '', content: '尚未正式保存', tags: ['草稿'] }
    const saved = saveDraft(demoDb, validateNoteDraft(draftInput))
    eq(getDraft(demoDb, original.id), saved, '草稿（含空标题）和标签往返一致')
    ok(!Number.isNaN(Date.parse(saved.savedAt)), '草稿保存时间由主进程生成')
    eq(getNote(demoDb, original.id).updatedAt, '2026-01-01T00:00:00.000Z', '草稿不改变正式笔记更新时间')
    eq(getNote(demoDb, original.id).content, original.content, '草稿不改变正式正文')
    eq(listVersions(demoDb, original.id), [], '草稿不生成历史')
    saveDraft(demoDb, { ...draftInput, title: '草稿修订' })
    eq(countRows(demoDb, 'note_drafts'), 1, '重复保存同一草稿只更新一行')
    eq(getDraft(demoDb, original.id)?.title, '草稿修订', '后一次草稿内容生效')
    eq(getDraft(demoDb, 'missing'), null, '缺失草稿返回 null')
    throws(() => saveDraft(demoDb, { ...draftInput, noteId: 'missing' }), '外键拒绝不存在笔记的草稿')
    throws(() => validateNoteDraft({ ...draftInput, tags: [3] }), '草稿标签 IPC 边界校验')
    throws(() => validateNoteCreation({ note: original, clearNewDraft: 'yes' }), '新建草稿清理标志必须为布尔值')
    throws(() => validateNoteCreation({ ...original, id: '__new__' }), '正式笔记不能使用新建草稿保留键')

    const first = { ...original, title: '版本 1', content: '# 新正文', tags: ['新标签'], updatedAt: '2026-02-01T00:00:00Z' }
    updateNote(demoDb, first)
    let versions = listVersions(demoDb, original.id)
    eq(versions.length, 2, '首次修改保留原文和本次内容两个快照')
    eq(versions.map((version) => version.title), ['版本 1', '原文'], '历史按时间倒序')
    eq(versions[1].content, original.content, '首改完整保留原正文')
    eq(versions[1].tags, original.tags, '首改保留原标签')
    eq(getVersion(demoDb, versions[0].id), versions[0], '指定历史版本读取一致')
    eq(getDraft(demoDb, original.id), null, '正式修改成功同事务清理草稿')
    const originalVersionId = versions[1].id
    const failureDraft = saveDraft(demoDb, { ...draftInput, title: '失败后应保留' })
    throws(() => updateNote(demoDb, { ...first, caseId: 'missing-case', title: '失败保存' }), '正式更新外键失败时事务回滚')
    eq(getNote(demoDb, original.id).title, first.title, '更新失败保留正式内容')
    eq(listVersions(demoDb, original.id), versions, '更新失败不新增或裁剪历史')
    eq(getDraft(demoDb, original.id), failureDraft, '更新失败保留草稿')
    // 让失败发生在版本写入阶段，确认正文更新和草稿清理同样回滚。
    demoDb.exec("CREATE TRIGGER fail_note_version BEFORE INSERT ON note_versions BEGIN SELECT RAISE(ABORT, '模拟版本写入失败'); END")
    throws(() => updateNote(demoDb, { ...first, content: '写入版本失败' }), '版本写入失败时正式保存失败')
    eq(getNote(demoDb, original.id).content, first.content, '版本写入失败回滚已更新正文')
    eq(getDraft(demoDb, original.id), failureDraft, '版本写入失败草稿完整保留')
    demoDb.exec('DROP TRIGGER fail_note_version')
    for (let i = 2; i <= 25; i++) updateNote(demoDb, { ...first, title: `版本 ${i}`, updatedAt: `2026-02-${String(i).padStart(2, '0')}T00:00:00Z` })
    versions = listVersions(demoDb, original.id)
    eq(versions.length, 20, '保存 25 次后恰好保留最近 20 个快照')
    eq(versions.map((version) => version.title), Array.from({ length: 20 }, (_, i) => `版本 ${25 - i}`), '裁剪保留最近版本且顺序正确')
    eq(getVersion(demoDb, originalVersionId), null, '超出 20 版的早期快照已裁剪')

    const newDraft = saveDraft(demoDb, { ...draftInput, noteId: '__new__', caseId: '', title: '新建草稿' })
    eq(getDraft(demoDb, '__new__')?.caseId, '', '新建草稿允许尚未选择案件')
    createNote(demoDb, { ...first, id: 'history-copy' })
    eq(getDraft(demoDb, '__new__'), newDraft, '创建历史副本保留正在编辑的新建草稿')
    throws(() => createNote(demoDb, { ...first, id: 'failed-new', caseId: 'missing-case' }, true), '新建正式笔记失败时事务回滚')
    eq(getDraft(demoDb, '__new__'), newDraft, '新建失败保留新建草稿')
    createNote(demoDb, { ...first, id: 'saved-new' }, true)
    eq(getDraft(demoDb, '__new__'), null, '正式新建成功同事务清理 __new__ 草稿')
    saveDraft(demoDb, draftInput)
    saveDraft(demoDb, { ...draftInput, noteId: '__new__', caseId: '' })
    deleteNote(demoDb, original.id)
    eq(listVersions(demoDb, original.id), [], '删除笔记外键级联清理历史')
    eq(getDraft(demoDb, original.id), null, '删除笔记外键级联清理草稿')
    ok(getDraft(demoDb, '__new__') !== null, '删除已有笔记保留独立新建草稿')
    deleteDraft(demoDb, '__new__')
    deleteDraft(demoDb, '__new__')
    eq(getDraft(demoDb, '__new__'), null, '丢弃草稿幂等')

    createCase(demoDb, { ...mock.cases[0], id: 'note-cascade-case', relatedCaseIds: [], files: [] })
    const cascadeNote = { ...first, id: 'cascade-note', caseId: 'note-cascade-case' }
    createNote(demoDb, cascadeNote)
    updateNote(demoDb, cascadeNote)
    saveDraft(demoDb, { ...draftInput, noteId: cascadeNote.id, caseId: cascadeNote.caseId })
    demoDb.prepare('DELETE FROM cases WHERE id = ?').run(cascadeNote.caseId)
    eq(listVersions(demoDb, cascadeNote.id), [], '删除案件经笔记外键清理历史')
    eq(getDraft(demoDb, cascadeNote.id), null, '删除案件经笔记外键清理草稿')
    eq(demoDb.pragma('foreign_key_check'), [], '笔记操作后全部外键一致')
  })

  section('期限提醒：迁移、档位、已读与设置', () => {
    eq(latestVersion, 4, '本次 schema 版本为 4')
    const oldDb = new Database(':memory:')
    for (const migration of migrations.filter((value) => value.version <= 3)) migration.up(oldDb)
    oldDb.pragma('user_version = 3')
    oldDb.prepare('INSERT INTO app_meta VALUES (?, ?)').run('reminder_badge', '0')
    runMigrations(oldDb)
    eq(countRows(oldDb, 'reminder_log'), 0, 'v3 升级 v4 建立空发送日志')
    eq(bootstrap(oldDb).state.reminderBadge, false, '升级保留已有设置')
    oldDb.close()
    const insert = blankDb.prepare('INSERT INTO reminder_log VALUES (?, ?, ?, ?, ?)')
    insert.run('r1', 'todo:one:2026-10-04', 'system', 'week', new Date().toISOString())
    throws(() => insert.run('r2', 'todo:one:2026-10-04', 'system', 'week', new Date().toISOString()), '相同日期、通道、档位拒绝重复发送记录')
    insert.run('r3', 'todo:one:2026-10-04', 'system', 'overdue', new Date().toISOString())
    insert.run('r4', 'todo:one:2026-10-05', 'system', 'week', new Date().toISOString())
    insert.run('r5', 'todo:one:2026-10-04', 'other', 'week', new Date().toISOString())
    eq(countRows(blankDb, 'reminder_log'), 4, '新日期、新档位、新通道可各自记录')
    eq([-1, 0, 7, 8, 60, 61].map(deadlineBucket), ['overdue', 'week', 'week', 'sixty', 'sixty', 'later'], '分级边界与 DeadlineBadge 一致')
    const state = bootstrap(blankDb).state
    eq([state.reminderSystem, state.reminderBadge, state.reminderSeen], [true, true, []], '提醒开关默认开、已读默认为空')
    const fingerprint = 'todo:one:2026-10-04:week'
    markRemindersSeen(blankDb, [fingerprint, fingerprint])
    markRemindersSeen(blankDb, [fingerprint])
    eq(bootstrap(blankDb).state.reminderSeen, [fingerprint], '已读指纹合并去重并从快照读取')
    throws(() => markRemindersSeen(blankDb, ['invalid']), '拒绝非法已读指纹')
    throws(() => setReminderPreference(blankDb, 'reminderSystem', 'false'), '拒绝非布尔开关')
    setReminderPreference(blankDb, 'reminderSystem', false)
    setReminderPreference(blankDb, 'reminderBadge', false)
    eq([bootstrap(blankDb).state.reminderSystem, bootstrap(blankDb).state.reminderBadge], [false, false], '两个开关分别持久化')
    setReminderPreference(blankDb, 'reminderSystem', true)
    const now = dayjs('2026-10-04T12:00:00')
    const sample = { id: 'sample', title: '期限测试', done: false, caseId: null, deadline: '2026-10-04', createdAt: now.toISOString() }
    const source = { ...state, todos: [-1, 0, 7, 8, 60, 61].map((days) => ({ ...sample, id: `d${days}`, deadline: now.add(days, 'day').format('YYYY-MM-DD') })), preservations: [], events: [] }
    const items = collectReminders(source, now)
    eq(items.map((item) => item.group), ['overdue', 'week', 'week', 'sixty', 'sixty', 'later'], '汇集按期限升序，保留 60 天后条目')
    eq(items.filter(isRedReminder).length, 3, '红区仅计逾期与 7 天内')
    eq(collectReminders({ ...source, todos: [{ ...sample, done: true }, { ...sample, deadline: null }] }, now), [], '排除已完成和无期限待办')
    eq(collectReminders({ ...source, todos: [], preservations: [{ ...mock.preservations[0], status: '结束', deadline: '2026-10-04' }] }, now), [], '排除已结束保全')
    const event = { ...mock.events[0], todoId: sample.id }
    const events = [-1, 0, 30, 31].map((days) => ({ ...event, id: `e${days}`, start: now.add(days, 'day').toISOString() }))
    eq(collectReminders({ ...source, todos: [], events }, now).map((item) => item.itemKey.split(':')[1]), ['e0', 'e30'], '日程按开始时间包含当前至 30 天边界，含联动事件')
    eq(collectReminders({ ...source, todos: [sample], events: [] }, now.add(1, 'day'))[0].fingerprint.endsWith(':overdue'), true, '跨日进入逾期产生新已读指纹')
  })

  // 使用真实数据库和可控发送回执，检查异步扫描、重试与导出协调。
  {
    const db = openTestDatabase(path.join(tmpDir, 'reminders.db'))
    const today = dayjs().format('YYYY-MM-DD')
    const todo: Todo = { id: 'reminder-test', title: '待办提醒', done: false, deadline: today, caseId: null, createdAt: new Date().toISOString() }
    createTodo(db, todo)
    let deliveries = 0
    let success = false
    const service = createReminderService(db, async () => { deliveries++; return success })
    await service.scan()
    eq(countRows(db, 'reminder_log'), 0, '发送失败不记录日志')
    success = true
    await Promise.all([service.scan(), service.scan()])
    eq(deliveries, 2, '并发扫描只发送一次，失败后可重试')
    eq(countRows(db, 'reminder_log'), 1, '成功发送写入日志')
    await service.scan()
    eq(deliveries, 2, '重复扫描不重复发送')
    service.stop()
    const restarted = createReminderService(db, async () => { deliveries++; return true })
    await restarted.scan()
    eq(deliveries, 2, '服务重启通过持久日志去重')
    updateTodo(db, { ...todo, deadline: dayjs().subtract(1, 'day').format('YYYY-MM-DD') })
    setReminderPreference(db, 'reminderSystem', false)
    await restarted.scan()
    eq(deliveries, 2, '系统通知关闭时不发送')
    setReminderPreference(db, 'reminderSystem', true)
    await runExport(db, async () => { await restarted.scan() })
    eq(deliveries, 2, '导出期间扫描不发送或写日志')
    await restarted.scan()
    eq(deliveries, 3, '期限修改后新 item_key 重新通知')
    updateTodo(db, { ...todo, done: true })
    await restarted.scan()
    eq(deliveries, 3, '已完成待办不通知')
    updateTodo(db, todo)
    await restarted.scan()
    eq(deliveries, 3, '恢复未完成保留同一期限去重记录')
    removeTodo(db, todo.id)
    await restarted.scan()
    eq(deliveries, 3, '删除条目不通知')
    recordReminderSent(db, `todo:other:${dayjs().subtract(1, 'day').format('YYYY-MM-DD')}`, 'week')
    createTodo(db, { ...todo, id: 'other', deadline: dayjs().subtract(1, 'day').format('YYYY-MM-DD') })
    let finish!: (shown: boolean) => void
    let entered!: () => void
    const enteredPromise = new Promise<void>((resolve) => { entered = resolve })
    const waiting = createReminderService(db, () => { entered(); return new Promise<boolean>((resolve) => { finish = resolve }) })
    const pendingScan = waiting.scan()
    await enteredPromise
    let exported = false
    const pendingExport = runExport(db, async () => { exported = true; eq(countRows(db, 'reminder_log'), 4, '同一期限进入逾期可重发，导出等待回执及日志写入') })
    await Promise.resolve()
    eq(exported, false, '通知尚未回执时导出等待')
    finish(true)
    await Promise.all([pendingScan, pendingExport])
    waiting.stop(); restarted.stop(); db.close()
  }

  section('待办 ↔ 日程联动', () => {
    const base: Todo = {
      id: 'smoke-todo-1',
      title: '冒烟测试待办',
      caseId: null,
      done: false,
      deadline: '2026-10-01',
      createdAt: new Date().toISOString(),
    }

    createTodo(blankDb, validateTodo(base))
    let event = findEventByTodoId(blankDb, base.id)
    ok(event !== undefined, '设置期限的待办自动生成日程事件')
    eq(event?.id, todoEventId(base.id), '事件 id 采用 todo_event_ 前缀')
    eq(event?.type, '截止期限', '事件类型为截止期限')
    eq(event?.title, base.title, '事件标题与待办一致')
    ok(event ? dayjs(event.start).format('YYYY-MM-DD') === base.deadline : false, '事件开始时间落在期限当天')

    const moved: Todo = { ...base, deadline: '2026-11-15' }
    updateTodo(blankDb, validateTodo(moved))
    event = findEventByTodoId(blankDb, base.id)
    eq(event?.id, todoEventId(base.id), '修改期限后事件 id 保持不变')
    ok(event ? dayjs(event.start).format('YYYY-MM-DD') === '2026-11-15' : false, '事件日期随期限更新')

    const completed: Todo = { ...moved, done: true }
    updateTodo(blankDb, validateTodo(completed))
    eq(findEventByTodoId(blankDb, base.id)?.title, `已完成：${completed.title}`, '完成待办后事件标题加「已完成：」前缀')

    const restored: Todo = { ...completed, done: false }
    updateTodo(blankDb, validateTodo(restored))
    eq(findEventByTodoId(blankDb, base.id)?.title, restored.title, '恢复未完成后前缀移除')

    const noDeadline: Todo = { ...restored, deadline: null }
    updateTodo(blankDb, validateTodo(noDeadline))
    ok(findEventByTodoId(blankDb, base.id) === undefined, '取消期限后事件同步删除')

    updateTodo(blankDb, validateTodo(moved))
    event = findEventByTodoId(blankDb, base.id)
    ok(event !== undefined && event.id === todoEventId(base.id), '重新设期限后事件按原 id 重建')

    removeTodo(blankDb, base.id)
    ok(findEventByTodoId(blankDb, base.id) === undefined, '删除待办后关联事件删除')
    eq(countRows(blankDb, 'todos'), 0, '待办行已删除')
  })

  section('日程事件更新 / 删除', () => {
    const manual: CalendarEvent = {
      id: 'smoke-event-manual',
      title: '手工日程',
      type: '其他',
      caseId: null,
      start: '2026-10-01T09:00:00',
      end: '2026-10-01T10:00:00',
      location: '',
      reminder: '',
    }
    createEvent(blankDb, manual)
    eq(listEvents(blankDb).length, 1, '创建手工日程')

    updateEvent(blankDb, validateEvent({ ...manual, title: '改后标题', start: '2026-10-02T09:00:00', end: '2026-10-02T10:00:00' }))
    const saved = listEvents(blankDb).find((v) => v.id === manual.id)
    eq(saved?.title, '改后标题', '更新日程标题')
    ok(saved ? dayjs(saved.start).format('YYYY-MM-DD') === '2026-10-02' : false, '更新日程日期')

    // 联动事件兜底保护：由待办自动同步的事件不允许手工编辑/删除
    const linkedTodo: Todo = {
      id: 'smoke-event-linked-todo',
      title: '联动保护待办',
      caseId: null,
      done: false,
      deadline: '2026-11-01',
      createdAt: new Date().toISOString(),
    }
    createTodo(blankDb, validateTodo(linkedTodo))
    const linkedEvent = findEventByTodoId(blankDb, linkedTodo.id)
    ok(linkedEvent !== undefined, '联动事件已生成')
    throws(() => updateEvent(blankDb, { ...linkedEvent!, title: '越权修改' }), '联动事件不允许手工编辑')
    throws(() => deleteEvent(blankDb, linkedEvent!.id), '联动事件不允许手工删除')

    deleteEvent(blankDb, manual.id)
    ok(listEvents(blankDb).every((v) => v.id !== manual.id), '删除手工日程')

    removeTodo(blankDb, linkedTodo.id)
    ok(findEventByTodoId(blankDb, linkedTodo.id) === undefined, '删除联动事件随待办清理')
  })

  section('真实附件存储', () => {
    const sourceA = path.join(tmpDir, 'source-a')
    const sourceB = path.join(tmpDir, 'source-b')
    fs.mkdirSync(sourceA)
    fs.mkdirSync(sourceB)
    const duplicateName = '证据材料.pdf'
    const sourceAFile = path.join(sourceA, duplicateName)
    const sourceBFile = path.join(sourceB, duplicateName)
    fs.writeFileSync(sourceAFile, 'first attachment')
    fs.writeFileSync(sourceBFile, 'second attachment')

    const contractFiles = copyFilesToOwner(
      demoDb,
      validateFileOwner({ type: 'contract', id: 'ct1' }),
      [sourceAFile, sourceBFile],
    )
    eq(contractFiles.map((file) => file.name), [duplicateName, duplicateName], '中文同名文件保留原始显示名')
    ok(contractFiles[0].storedName !== contractFiles[1].storedName, '同名文件的磁盘存储名自动防重')
    ok(contractFiles.every((file) => /^证据材料-[0-9a-f]{8}\.pdf$/.test(file.storedName)), '存储名追加八位随机后缀')
    ok(contractFiles.every((file) => file.relPath.startsWith('contracts/ct1/')), '合同附件使用归属实体相对目录')

    const invoiceFiles = copyFilesToOwner(
      demoDb,
      validateFileOwner({ type: 'invoice', id: 'inv1' }),
      [sourceAFile],
    )
    const caseFiles = copyFilesToOwner(
      demoDb,
      validateFileOwner({ type: 'case', id: 'case1' }),
      [sourceAFile],
    )
    ok(invoiceFiles[0].relPath.startsWith('invoices/inv1/'), '发票附件使用归属实体相对目录')
    ok(caseFiles[0].relPath.startsWith('cases/case1/'), '案件附件使用归属实体相对目录')

    const root = attachmentsRootForDatabase(demoDb)
    const storedPaths = [...contractFiles, ...invoiceFiles, ...caseFiles].map((file) =>
      path.join(root, ...file.relPath.split('/')),
    )
    ok(storedPaths.every((filePath) => fs.statSync(filePath).isFile()), '所选文件均复制到 attachments 目录')
    eq(
      bootstrap(demoDb).state.cases.find((value) => value.id === 'case1')?.files.map((file) => file.id),
      caseFiles.map((file) => file.id),
      '案件附件从数据库快照恢复',
    )

    const removedPath = storedPaths[storedPaths.length - 1]
    deleteFileAndContent(demoDb, caseFiles[0].id)
    ok(!fs.existsSync(removedPath), '删除附件同步删除磁盘文件')
    eq(countRows(demoDb, 'file_meta', `id = '${caseFiles[0].id}'`), 0, '删除附件同步删除数据库记录')
  })

  section('删除合同级联清理', () => {
    const attachmentsRoot = attachmentsRootForDatabase(demoDb)
    const contractDirectory = path.join(attachmentsRoot, 'contracts', 'ct1')
    const invoiceDirectory = path.join(attachmentsRoot, 'invoices', 'inv1')
    ok(fs.existsSync(contractDirectory) && fs.existsSync(invoiceDirectory), '级联前合同及发票附件目录存在')
    removeContract(demoDb, validateId('ct1'))
    eq(countRows(demoDb, 'contracts', "id = 'ct1'"), 0, '合同行删除')
    eq(countRows(demoDb, 'fee_records', "contract_id = 'ct1'"), 0, '级联删除收费期次')
    eq(countRows(demoDb, 'invoices', "contract_id = 'ct1'"), 0, '级联删除发票')
    eq(countRows(demoDb, 'file_meta', "contract_id = 'ct1'"), 0, '级联删除合同附件')
    eq(countRows(demoDb, 'file_meta', "invoice_id = 'inv1'"), 0, '级联删除发票附件（随发票）')
    eq(countRows(demoDb, 'contract_cases', "contract_id = 'ct1'"), 0, '级联删除合同-案件关联')
    eq(countRows(demoDb, 'cases', "id = 'case1'"), 1, '关联案件本身不受影响')
    eq(countRows(demoDb, 'fee_records'), mock.fees.length - 2, '其余合同的费用不受影响')
    eq(countRows(demoDb, 'invoices'), mock.invoices.length - 1, '其余合同的发票不受影响')
    eq(countRows(demoDb, 'contracts'), mock.contracts.length - 1, '其余合同不受影响')
    ok(!fs.existsSync(contractDirectory), '合同删除提交后清理合同附件目录')
    ok(!fs.existsSync(invoiceDirectory), '合同删除提交后清理其发票附件目录')
  })

  section('IPC payload 边界校验', () => {
    const baseTodo = {
      id: 'smoke-todo-2',
      title: '校验用待办',
      caseId: null,
      done: false,
      deadline: '2026-10-01',
      createdAt: '2026-09-03T10:00:00',
    }
    const baseEvent = {
      id: 'smoke-event-1',
      title: '校验用日程',
      type: '其他',
      caseId: null,
      start: '2026-10-01T09:00:00',
      end: '2026-10-01T10:00:00',
      location: '',
      reminder: '',
    }

    throws(() => validateTodo({}), 'validateTodo 拒绝字段缺失的 payload')
    throws(() => validateTodo({ ...baseTodo, title: '' }), 'validateTodo 拒绝空标题')
    throws(() => validateTodo({ ...baseTodo, deadline: '2026/10/01' }), 'validateTodo 拒绝非法日期格式')
    eq(validateTodo(baseTodo), baseTodo, 'validateTodo 合法对象原样通过')
    for (const surname of ['', '  ', '\t\n', '　']) {
      throws(() => validateUserName(surname), '姓拒绝空串和各种纯空白')
      throws(() => validateInitialSetupPayload({ userName: surname, userGivenName: '', mode: 'blank' }), '初始化拒绝空白姓')
      throws(() => setUserName(settingsDb, surname), '设置服务直接调用也拒绝空白姓')
      throws(() => initialize(blankDb, { userName: surname, userGivenName: '', mode: 'blank' }), '初始化服务直接调用也拒绝空白姓')
    }
    eq(validateUserName(' 王　'), '王', '姓校验去除首尾空白')
    setUserName(settingsDb, ' 李\t')
    eq(bootstrap(settingsDb).state.userName, '李', '保存姓去除首尾空白')
    throws(() => validateId(''), 'validateId 拒绝空 id')
    throws(() => validateId(123), 'validateId 拒绝非字符串 id')
    throws(() => validateFileOwner({ type: 'case', id: '../case1' }), '附件归属校验拒绝路径字符')
    throws(() => validateFileOwner({ type: 'client', id: 'c1' }), '附件归属校验拒绝未知类型')
    throws(() => validateInitialSetupMode('unknown'), 'validateInitialSetupMode 拒绝非法模式')
    throws(() => validateInitialSetupPayload({ userName: '', userGivenName: '', mode: 'blank' }), 'validateInitialSetupPayload 拒绝空姓')
    throws(() => validateEvent({ ...baseEvent, todoId: 'smoke-todo-2' }), '手工日程不能绑定待办')
    throws(() => validateEvent({ ...baseEvent, end: '2026-10-01T08:00:00' }), '日程结束早于开始被拒绝')
    throws(() => validateCase({ ...mock.cases[0], relatedCaseIds: [mock.cases[0].id] }), '案件不能关联自身')
    throws(() => validateCase({ ...mock.cases[0], templateId: 'criminal-defense' }), '案件类型与阶段模板不匹配被拒绝')
  })

  demoDb.close()
  blankDb.close()
  settingsDb.close()

  console.log(`\n冒烟结果：${passed} 项通过，${failed} 项失败`)
  if (failed === 0) {
    fs.rmSync(tmpDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
  } else {
    console.error(`临时数据库保留于：${tmpDir}`)
    process.exitCode = 1
  }
}

void main().catch((error) => { console.error(error); process.exitCode = 1 })
