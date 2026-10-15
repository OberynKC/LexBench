import { dialog, shell, type BrowserWindow } from 'electron'
import type Database from 'better-sqlite3'
import type { FileMeta, FileOwner } from '../../../src/types'
import { copyFilesToOwner, deleteFileAndContent, findStoredFilePath } from '../../files/attachmentStorage'
import { assertWritable } from '../../export/exportGate'
import { confirmDialog } from '../../ipc/dialogService'
import { findFileRow } from '../repos/filesRepo'

export async function selectAndStoreFiles(
  db: Database.Database,
  parent: BrowserWindow | null,
  owner: FileOwner,
): Promise<FileMeta[]> {
  const options: Electron.OpenDialogOptions = {
    title: '选择要上传的附件',
    properties: ['openFile', 'multiSelections'],
  }
  const result = parent ? await dialog.showOpenDialog(parent, options) : await dialog.showOpenDialog(options)
  if (result.canceled || result.filePaths.length === 0) return []
  assertWritable(db)
  return copyFilesToOwner(db, owner, result.filePaths)
}

export async function openFile(db: Database.Database, fileId: string): Promise<void> {
  const error = await shell.openPath(findStoredFilePath(db, fileId))
  if (error) throw new Error(`系统无法打开附件：${error}`)
}

export function revealFile(db: Database.Database, fileId: string): void {
  shell.showItemInFolder(findStoredFilePath(db, fileId))
}

export async function confirmAndDeleteFile(
  db: Database.Database,
  parent: BrowserWindow | null,
  fileId: string,
): Promise<boolean> {
  const file = findFileRow(db, fileId)
  if (!file) throw new Error('附件记录不存在')
  const confirmed = await confirmDialog(parent, {
    title: '删除附件', message: `确定删除“${file.name}”吗？`,
    detail: '附件记录和本机存储的文件将一并删除，此操作不可撤销。', confirmLabel: '删除',
  })
  if (!confirmed) return false
  assertWritable(db)
  deleteFileAndContent(db, fileId)
  return true
}
