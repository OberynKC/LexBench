import { app, dialog, shell, type BrowserWindow } from 'electron'
import path from 'node:path'
import type Database from 'better-sqlite3'
import { writeExportArtifacts } from '../../export/dataExport'
import { attachmentsRootForDatabase } from '../../files/attachmentStorage'
import { exportToDirectory } from '../../export/exportDirectory'
import { runExport } from '../../export/exportGate'
import { alertDialog } from '../../ipc/dialogService'

export function protectedExportDirectories(db: Database.Database): string[] {
  return [app.getPath('userData'), attachmentsRootForDatabase(db), app.getAppPath(), process.resourcesPath,
    ...(app.isPackaged ? [process.platform === 'darwin' ? path.resolve(path.dirname(process.execPath), '../..') : path.dirname(process.execPath)] : []),
  ]
}

export async function exportData(db: Database.Database, parent: BrowserWindow | null): Promise<void> {
  const completed = await runExport(db, async () => {
    const options: Electron.OpenDialogOptions = {
      title: '选择数据导出位置', defaultPath: app.getPath('documents'), buttonLabel: '选择此目录',
      properties: ['openDirectory', 'createDirectory'],
    }
    const selection = parent ? await dialog.showOpenDialog(parent, options) : await dialog.showOpenDialog(options)
    if (selection.canceled || selection.filePaths.length === 0) return null
    return exportToDirectory(selection.filePaths[0], protectedExportDirectories(db), (directory) => writeExportArtifacts(db, directory))
  })
  if (!completed) return
  const { directory, result } = completed
  shell.showItemInFolder(directory)
  const zipDetail = result.zipCreated ? `附件.zip（${result.exportedAttachmentCount} 个文件）` : '附件.zip：没有可导出的附件，未生成'
  const skippedDetail = result.skippedAttachmentCount > 0
    ? `\n\n另有 ${result.skippedAttachmentCount} 条附件记录缺少可读取的本地文件，已保留在附件清单并跳过 ZIP。` : ''
  await alertDialog(parent, {
    title: '数据导出完成', message: '律衡数据导出完成',
    detail: `已生成：\n• 律衡数据.xlsx\n• ${zipDetail}${skippedDetail}`,
  })
}
