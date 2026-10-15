import { contextBridge, ipcRenderer } from 'electron'
import type { LexBenchApi } from '../src/types/api'
import { IPC_CHANNELS } from './ipc/channels'

const api: LexBenchApi = {
  dialogs: {
    confirm: (options) => ipcRenderer.invoke(IPC_CHANNELS.dialogConfirm, options),
    alert: (options) => ipcRenderer.invoke(IPC_CHANNELS.dialogAlert, options),
  },
  bootstrap: () => ipcRenderer.invoke(IPC_CHANNELS.bootstrap),
  initialize: (payload) => ipcRenderer.invoke(IPC_CHANNELS.initialize, payload),
  settings: {
    markRemindersSeen: (keys) => ipcRenderer.invoke(IPC_CHANNELS.markRemindersSeen, keys),
    setReminderBadge: (on) => ipcRenderer.invoke(IPC_CHANNELS.settingsSetReminderBadge, on),
    setReminderSystem: (on) => ipcRenderer.invoke(IPC_CHANNELS.settingsSetReminderSystem, on),
    setUserName: (name) => ipcRenderer.invoke(IPC_CHANNELS.settingsSetUserName, name),
    setUserGivenName: (name) => ipcRenderer.invoke(IPC_CHANNELS.settingsSetUserGivenName, name),
    setTestMode: (on) => ipcRenderer.invoke(IPC_CHANNELS.settingsSetTestMode, on),
    importDemo: () => ipcRenderer.invoke(IPC_CHANNELS.settingsImportDemo),
    exportData: () => ipcRenderer.invoke(IPC_CHANNELS.settingsExportData),
    backupData: () => ipcRenderer.invoke(IPC_CHANNELS.settingsBackupData),
    restoreData: () => ipcRenderer.invoke(IPC_CHANNELS.settingsRestoreData),
    getExportStatus: () => ipcRenderer.invoke(IPC_CHANNELS.settingsGetExportStatus),
    onExportStatusChanged: (listener) => {
      const handler = (_event: Electron.IpcRendererEvent, exporting: boolean) => listener(exporting)
      ipcRenderer.on(IPC_CHANNELS.exportStatusChanged, handler)
      return () => { ipcRenderer.removeListener(IPC_CHANNELS.exportStatusChanged, handler) }
    },
  },
  cases: {
    create: (value) => ipcRenderer.invoke(IPC_CHANNELS.caseCreate, value),
    update: (value) => ipcRenderer.invoke(IPC_CHANNELS.caseUpdate, value),
  },
  clients: {
    create: (value) => ipcRenderer.invoke(IPC_CHANNELS.clientCreate, value),
    update: (value) => ipcRenderer.invoke(IPC_CHANNELS.clientUpdate, value),
  },
  notes: {
    create: (value, clearNewDraft = false) => ipcRenderer.invoke(IPC_CHANNELS.noteCreate, { note: value, clearNewDraft }),
    update: (value) => ipcRenderer.invoke(IPC_CHANNELS.noteUpdate, value),
    remove: (id) => ipcRenderer.invoke(IPC_CHANNELS.noteDelete, id),
    saveNoteDraft: (value) => ipcRenderer.invoke(IPC_CHANNELS.saveNoteDraft, value),
    getNoteDraft: (noteId) => ipcRenderer.invoke(IPC_CHANNELS.getNoteDraft, noteId),
    deleteNoteDraft: (noteId) => ipcRenderer.invoke(IPC_CHANNELS.deleteNoteDraft, noteId),
    listNoteVersions: (noteId) => ipcRenderer.invoke(IPC_CHANNELS.listNoteVersions, noteId),
    getNoteVersion: (id) => ipcRenderer.invoke(IPC_CHANNELS.getNoteVersion, id),
  },
  preservations: {
    create: (value) => ipcRenderer.invoke(IPC_CHANNELS.preservationCreate, value),
    update: (value) => ipcRenderer.invoke(IPC_CHANNELS.preservationUpdate, value),
  },
  events: {
    create: (value) => ipcRenderer.invoke(IPC_CHANNELS.eventCreate, value),
    update: (value) => ipcRenderer.invoke(IPC_CHANNELS.eventUpdate, value),
    remove: (id) => ipcRenderer.invoke(IPC_CHANNELS.eventDelete, id),
  },
  todos: {
    create: (value) => ipcRenderer.invoke(IPC_CHANNELS.todoCreate, value),
    update: (value) => ipcRenderer.invoke(IPC_CHANNELS.todoUpdate, value),
    remove: (id) => ipcRenderer.invoke(IPC_CHANNELS.todoDelete, id),
  },
  contracts: {
    create: (value) => ipcRenderer.invoke(IPC_CHANNELS.contractCreate, value),
    update: (value) => ipcRenderer.invoke(IPC_CHANNELS.contractUpdate, value),
    remove: (id) => ipcRenderer.invoke(IPC_CHANNELS.contractDelete, id),
  },
  fees: {
    create: (value) => ipcRenderer.invoke(IPC_CHANNELS.feeCreate, value),
    update: (value) => ipcRenderer.invoke(IPC_CHANNELS.feeUpdate, value),
    remove: (id) => ipcRenderer.invoke(IPC_CHANNELS.feeDelete, id),
  },
  invoices: {
    create: (value) => ipcRenderer.invoke(IPC_CHANNELS.invoiceCreate, value),
    update: (value) => ipcRenderer.invoke(IPC_CHANNELS.invoiceUpdate, value),
    remove: (id) => ipcRenderer.invoke(IPC_CHANNELS.invoiceDelete, id),
  },
  files: {
    selectAndStore: (owner) => ipcRenderer.invoke(IPC_CHANNELS.fileSelectAndStore, owner),
    open: (id) => ipcRenderer.invoke(IPC_CHANNELS.fileOpen, id),
    reveal: (id) => ipcRenderer.invoke(IPC_CHANNELS.fileReveal, id),
    remove: (id) => ipcRenderer.invoke(IPC_CHANNELS.fileDelete, id),
  },
}

contextBridge.exposeInMainWorld('api', api)
