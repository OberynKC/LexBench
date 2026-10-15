import { app, dialog, shell, type BrowserWindow } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import type Database from 'better-sqlite3'
import type { AppState, InitialSetupPayload } from '../../../src/types/api'
import { createBackupArchive, createRestorePoint, prepareRestore, type PreparedRestore } from '../../backup/backupArchive'
import { installPreparedRestore } from '../../backup/restoreFiles'
import { assertWritable, runExport } from '../../export/exportGate'
import { validateExportParent } from '../../export/exportDirectory'
import { alertDialog } from '../../ipc/dialogService'
import { closeDatabase, initDatabase } from '..'
import { protectedExportDirectories } from './exportService'
import { assertDemoAllowed, importDemo } from './settingsService'
import { initialize } from './bootstrapService'
import { hasBusinessData, readSnapshot } from './snapshotService'
import { getMeta, META_KEYS } from '../repos/appMetaRepo'

/** 文件系统错误的原始信息只记主进程日志，IPC 不返回绝对路径。 */
function publicError(error: unknown): Error {
  console.error('数据备份或恢复失败', error)
  const code = (error as NodeJS.ErrnoException)?.code
  const reasons: Record<string, string> = {
    ENOSPC: '磁盘空间不足，请释放空间后重试', EACCES: '无法访问所选文件或目录，请检查权限',
    EPERM: '文件操作被拒绝，请检查权限及文件是否被占用', ENOENT: '所选文件或目录不存在，请重新选择',
    EIO: '磁盘读写失败，请检查存储设备', EEXIST: '目标已存在，请重新选择或稍后重试',
    ENOTDIR: '所选位置不是目录，请检查备份目录',
  }
  if (code && !code.startsWith('SQLITE_')) return new Error(reasons[code] ?? '文件读写失败，请检查所选位置和可用空间')
  return new Error(error instanceof Error ? error.message : '数据操作未完成，请重试')
}

export async function backupData(db: Database.Database, parent: BrowserWindow | null): Promise<void> {
  try {
    const result = await runExport(db, async () => {
      const options: Electron.OpenDialogOptions = { title: '选择数据备份位置', defaultPath: app.getPath('documents'),
        buttonLabel: '选择此目录', properties: ['openDirectory', 'createDirectory'] }
      const selection = parent ? await dialog.showOpenDialog(parent, options) : await dialog.showOpenDialog(options)
      if (selection.canceled || !selection.filePaths.length) return null
      await validateExportParent(selection.filePaths[0], protectedExportDirectories(db))
      return createBackupArchive(db, selection.filePaths[0], app.getVersion())
    })
    if (!result) return
    shell.showItemInFolder(result.file)
    await alertDialog(parent, { title: '数据备份完成', message: '律衡数据备份完成',
      detail: `已生成 ${path.basename(result.file)}，包含数据库与 ${result.manifest.attachments.length} 个附件。` +
        (result.manifest.warnings.length ? `\n\n有 ${result.manifest.warnings.length} 条附件警告，详情见备份包内 manifest.json。` : '') })
  } catch (error) { throw publicError(error) }
}

export async function restoreData(db: Database.Database, parent: BrowserWindow | null): Promise<void> {
  // 恢复属于 mutation；assertWritable 先检查，再由 runExport 独占执行。
  assertWritable(db)
  try {
    await runExport(db, async () => {
      let prepared: PreparedRestore | undefined
      const userData = app.getPath('userData')
      try {
        const options: Electron.OpenDialogOptions = { title: '选择律衡数据备份', defaultPath: app.getPath('documents'),
          buttonLabel: '选择备份', properties: ['openFile'], filters: [{ name: '律衡备份', extensions: ['zip'] }] }
        const selection = parent ? await dialog.showOpenDialog(parent, options) : await dialog.showOpenDialog(options)
        if (selection.canceled || !selection.filePaths.length) return
        assertWritable(db)
        prepared = await prepareRestore(selection.filePaths[0], userData)
        const confirmation: Electron.MessageBoxOptions = { type: 'warning', title: '恢复数据',
          message: '将使用备份覆盖当前全部数据和附件，完成后应用会自动重启。',
          detail: '继续前会自动备份当前数据为恢复点，保留最近 3 份。' +
            (prepared.manifest.warnings.length ? `\n\n所选备份有 ${prepared.manifest.warnings.length} 条附件警告，部分附件可能缺少文件内容。` : ''),
          buttons: ['取消', '恢复并重启'], defaultId: 0, cancelId: 0, noLink: true }
        const answer = parent ? await dialog.showMessageBox(parent, confirmation) : await dialog.showMessageBox(confirmation)
        if (answer.response !== 1) return
        assertWritable(db)
        await createRestorePoint(db, app.getVersion())
        assertWritable(db)
        closeDatabase()
        try { installPreparedRestore(prepared, userData) } catch (error) {
          initDatabase(); throw error
        }
        prepared = undefined
        app.relaunch()
        app.exit(0)
      } finally {
        // 若回滚尚未完成，启动恢复仍需要临时目录中的原数据。
        if (prepared && !fs.existsSync(path.join(userData, '.lexbench-restore.json'))) {
          await fs.promises.rm(prepared.directory, { recursive: true, force: true })
        }
      }
    })
  } catch (error) { throw publicError(error) }
}

/** 设置与首次初始化的演示导入共用恢复点目录、格式、保留策略。 */
export async function importDemoWithRestorePoint(db: Database.Database): Promise<AppState> {
  assertDemoAllowed(db)
  if (getMeta(db, META_KEYS.demoImported) === '1') return readSnapshot(db)
  try {
    return await runExport(db, async () => {
      await createRestorePoint(db, app.getVersion())
      assertWritable(db)
      return importDemo(db)
    })
  } catch (error) { throw publicError(error) }
}

export async function initializeWithRestorePoint(db: Database.Database, payload: InitialSetupPayload): Promise<AppState> {
  if (payload.mode !== 'demo') return initialize(db, payload)
  assertDemoAllowed(db)
  if (getMeta(db, META_KEYS.setupCompleted) === '1' || hasBusinessData(db)) return initialize(db, payload)
  try {
    return await runExport(db, async () => {
      await createRestorePoint(db, app.getVersion())
      assertWritable(db)
      return initialize(db, payload)
    })
  } catch (error) { throw publicError(error) }
}
