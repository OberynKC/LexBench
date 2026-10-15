import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'node:path'
import { isTrustedPageUrl } from '../security/trustedSource'
import type { IpcMainInvokeEvent } from 'electron'
import { getDatabase } from '../db'
import { createClient, updateClient } from '../db/repos/clientsRepo'
import { createEvent, deleteEvent, updateEvent } from '../db/repos/eventsRepo'
import { createFee, deleteFee, updateFee } from '../db/repos/feesRepo'
import { deleteNote, saveDraft, getDraft, deleteDraft, listVersions, getVersion } from '../db/repos/notesRepo'
import { createNote, updateNote } from '../db/services/notesService'
import { createPreservation, updatePreservation } from '../db/repos/preservationsRepo'
import { bootstrap } from '../db/services/bootstrapService'
import { createCase, updateCase } from '../db/services/caseService'
import { createContract, removeContract, updateContract } from '../db/services/contractService'
import { createInvoice, removeInvoice, updateInvoice } from '../db/services/invoiceService'
import { setTestMode, setUserGivenName, setUserName } from '../db/services/settingsService'
import { backupData, restoreData, importDemoWithRestorePoint, initializeWithRestorePoint } from '../db/services/backupService'
import { createTodo, removeTodo, updateTodo } from '../db/services/todoService'
import { confirmAndDeleteFile, openFile, revealFile, selectAndStoreFiles } from '../db/services/fileService'
import { exportData } from '../db/services/exportService'
import {
  validateAlertOptions,
  validateConfirmOptions,
  validateCase,
  validateClient,
  validateContract,
  validateEvent,
  validateFee,
  validateFileOwner,
  validateId,
  validateInitialSetupPayload,
  validateInvoice,
  validateNote,
  validateNoteCreation,
  validateNoteDraft,
  validatePreservation,
  validateTestMode,
  validateTodo,
  validateUserGivenName,
  validateUserName,
} from '../db/validation'
import { isExporting, runMutation, subscribeExportState } from '../export/exportGate'
import { confirmDialog, alertDialog } from './dialogService'
import { IPC_CHANNELS } from './channels'
import { markRemindersSeen, setReminderPreference } from '../db/repos/remindersRepo'

let registered = false
const readChannels: ReadonlySet<string> = new Set([
  IPC_CHANNELS.bootstrap, IPC_CHANNELS.settingsExportData, IPC_CHANNELS.settingsBackupData, IPC_CHANNELS.settingsGetExportStatus,
  IPC_CHANNELS.fileOpen, IPC_CHANNELS.fileReveal, IPC_CHANNELS.dialogAlert, IPC_CHANNELS.dialogConfirm,
  IPC_CHANNELS.getNoteDraft, IPC_CHANNELS.listNoteVersions, IPC_CHANNELS.getNoteVersion,
])

type Handler = (event: IpcMainInvokeEvent, payload: unknown) => unknown | Promise<unknown>

function errorMessage(error: unknown): string {
  return error instanceof Error && error.message ? error.message : '未知错误'
}

function register(channel: string, operation: string, handler: Handler): void {
  ipcMain.handle(channel, async (event, payload) => {
    try {
      const owner = BrowserWindow.fromWebContents(event.sender)
      const frame = event.senderFrame
      const devServerUrl = app.isPackaged ? undefined : process.env.VITE_DEV_SERVER_URL
      if (!owner || owner.isDestroyed() || !BrowserWindow.getAllWindows().includes(owner) ||
        !frame || frame !== event.sender.mainFrame ||
        !isTrustedPageUrl(frame.url, path.join(__dirname, '../dist/index.html'), devServerUrl)) {
        throw new Error('请求来源未经授权')
      }
      return await (readChannels.has(channel)
        ? handler(event, payload)
        : runMutation(getDatabase(), () => handler(event, payload)))
    } catch (error) {
      console.error(`[IPC] ${operation}失败`, error)
      throw new Error(`${operation}失败：${errorMessage(error)}`)
    }
  })
}

export function registerIpc(): void {
  if (registered) return
  registered = true
  subscribeExportState((_db, busy) => {
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) win.webContents.send(IPC_CHANNELS.exportStatusChanged, busy)
    }
  })
  register(IPC_CHANNELS.dialogConfirm, '显示确认', (event, payload) =>
    confirmDialog(BrowserWindow.fromWebContents(event.sender), validateConfirmOptions(payload)))
  register(IPC_CHANNELS.dialogAlert, '显示提示', (event, payload) =>
    alertDialog(BrowserWindow.fromWebContents(event.sender), validateAlertOptions(payload)))
  register(IPC_CHANNELS.settingsGetExportStatus, '读取导出状态', () => isExporting(getDatabase()))

  register(IPC_CHANNELS.bootstrap, '加载本地数据', () => bootstrap(getDatabase()))
  register(IPC_CHANNELS.initialize, '初始化本地数据', (_event, payload) =>
    initializeWithRestorePoint(getDatabase(), validateInitialSetupPayload(payload)),
  )

  register(IPC_CHANNELS.settingsSetUserName, '保存姓名', (_event, payload) =>
    setUserName(getDatabase(), validateUserName(payload)),
  )
  register(IPC_CHANNELS.settingsSetUserGivenName, '保存姓名', (_event, payload) =>
    setUserGivenName(getDatabase(), validateUserGivenName(payload)),
  )
  register(IPC_CHANNELS.settingsSetTestMode, '切换测试模式', (_event, payload) =>
    setTestMode(getDatabase(), validateTestMode(payload)),
  )
  register(IPC_CHANNELS.settingsSetReminderSystem, '保存系统通知设置', (_event, payload) => setReminderPreference(getDatabase(), 'reminderSystem', payload))
  register(IPC_CHANNELS.settingsSetReminderBadge, '保存红点设置', (_event, payload) => setReminderPreference(getDatabase(), 'reminderBadge', payload))
  register(IPC_CHANNELS.markRemindersSeen, '保存提醒已读状态', (_event, payload) => markRemindersSeen(getDatabase(), payload))
  register(IPC_CHANNELS.settingsImportDemo, '导入演示数据', () => importDemoWithRestorePoint(getDatabase()))
  register(IPC_CHANNELS.settingsExportData, '数据导出', (event) =>
    exportData(getDatabase(), BrowserWindow.fromWebContents(event.sender)),
  )
  register(IPC_CHANNELS.settingsBackupData, '备份数据', (event) => backupData(getDatabase(), BrowserWindow.fromWebContents(event.sender)))
  register(IPC_CHANNELS.settingsRestoreData, '恢复数据', (event) => restoreData(getDatabase(), BrowserWindow.fromWebContents(event.sender)))

  register(IPC_CHANNELS.caseCreate, '创建案件', (_event, payload) => createCase(getDatabase(), validateCase(payload)))
  register(IPC_CHANNELS.caseUpdate, '更新案件', (_event, payload) => updateCase(getDatabase(), validateCase(payload)))
  register(IPC_CHANNELS.clientCreate, '创建客户', (_event, payload) => createClient(getDatabase(), validateClient(payload)))
  register(IPC_CHANNELS.clientUpdate, '更新客户', (_event, payload) => updateClient(getDatabase(), validateClient(payload)))
  register(IPC_CHANNELS.noteCreate, '创建笔记', (_event, payload) => {
    const { note, clearNewDraft } = validateNoteCreation(payload)
    return createNote(getDatabase(), note, clearNewDraft)
  })
  register(IPC_CHANNELS.noteUpdate, '更新笔记', (_event, payload) => updateNote(getDatabase(), validateNote(payload)))
  register(IPC_CHANNELS.noteDelete, '删除笔记', (_event, payload) => deleteNote(getDatabase(), validateId(payload)))
  register(IPC_CHANNELS.saveNoteDraft, '保存笔记草稿', (_event, payload) => saveDraft(getDatabase(), validateNoteDraft(payload)))
  register(IPC_CHANNELS.getNoteDraft, '读取笔记草稿', (_event, payload) => getDraft(getDatabase(), validateId(payload)))
  register(IPC_CHANNELS.deleteNoteDraft, '丢弃笔记草稿', (_event, payload) => deleteDraft(getDatabase(), validateId(payload)))
  register(IPC_CHANNELS.listNoteVersions, '读取笔记历史', (_event, payload) => listVersions(getDatabase(), validateId(payload)))
  register(IPC_CHANNELS.getNoteVersion, '读取笔记版本', (_event, payload) => getVersion(getDatabase(), validateId(payload)))
  register(IPC_CHANNELS.preservationCreate, '创建保全执行记录', (_event, payload) =>
    createPreservation(getDatabase(), validatePreservation(payload)),
  )
  register(IPC_CHANNELS.preservationUpdate, '更新保全执行记录', (_event, payload) =>
    updatePreservation(getDatabase(), validatePreservation(payload)),
  )
  register(IPC_CHANNELS.eventCreate, '创建日程', (_event, payload) => createEvent(getDatabase(), validateEvent(payload)))
  register(IPC_CHANNELS.eventUpdate, '更新日程', (_event, payload) => updateEvent(getDatabase(), validateEvent(payload)))
  register(IPC_CHANNELS.eventDelete, '删除日程', (_event, payload) => deleteEvent(getDatabase(), validateId(payload)))
  register(IPC_CHANNELS.todoCreate, '创建待办', (_event, payload) => createTodo(getDatabase(), validateTodo(payload)))
  register(IPC_CHANNELS.todoUpdate, '更新待办', (_event, payload) => updateTodo(getDatabase(), validateTodo(payload)))
  register(IPC_CHANNELS.todoDelete, '删除待办', (_event, payload) => removeTodo(getDatabase(), validateId(payload)))
  register(IPC_CHANNELS.contractCreate, '创建合同', (_event, payload) =>
    createContract(getDatabase(), validateContract(payload)),
  )
  register(IPC_CHANNELS.contractUpdate, '更新合同', (_event, payload) =>
    updateContract(getDatabase(), validateContract(payload)),
  )
  register(IPC_CHANNELS.contractDelete, '删除合同', (_event, payload) =>
    removeContract(getDatabase(), validateId(payload)),
  )
  register(IPC_CHANNELS.feeCreate, '创建收费期次', (_event, payload) => createFee(getDatabase(), validateFee(payload)))
  register(IPC_CHANNELS.feeUpdate, '更新收费期次', (_event, payload) => updateFee(getDatabase(), validateFee(payload)))
  register(IPC_CHANNELS.feeDelete, '删除收费期次', (_event, payload) => deleteFee(getDatabase(), validateId(payload)))
  register(IPC_CHANNELS.invoiceCreate, '创建发票', (_event, payload) =>
    createInvoice(getDatabase(), validateInvoice(payload)),
  )
  register(IPC_CHANNELS.invoiceUpdate, '更新发票', (_event, payload) =>
    updateInvoice(getDatabase(), validateInvoice(payload)),
  )
  register(IPC_CHANNELS.invoiceDelete, '删除发票', (_event, payload) =>
    removeInvoice(getDatabase(), validateId(payload)),
  )
  register(IPC_CHANNELS.fileSelectAndStore, '上传附件', (event, payload) =>
    selectAndStoreFiles(
      getDatabase(),
      BrowserWindow.fromWebContents(event.sender),
      validateFileOwner(payload),
    ),
  )
  register(IPC_CHANNELS.fileOpen, '打开附件', (_event, payload) =>
    openFile(getDatabase(), validateId(payload, '附件 id')),
  )
  register(IPC_CHANNELS.fileReveal, '打开附件所在文件夹', (_event, payload) =>
    revealFile(getDatabase(), validateId(payload, '附件 id')),
  )
  register(IPC_CHANNELS.fileDelete, '删除附件', (event, payload) =>
    confirmAndDeleteFile(
      getDatabase(),
      BrowserWindow.fromWebContents(event.sender),
      validateId(payload, '附件 id'),
    ),
  )
}
