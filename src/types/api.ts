import type {
  CalendarEvent,
  Case,
  Client,
  Contract,
  FeeRecord,
  FileMeta,
  FileOwner,
  Invoice,
  Note,
  NoteDraft,
  NoteDraftInput,
  NoteVersion,
  Preservation,
  Todo,
} from './index'

export interface AppState {
  cases: Case[]
  clients: Client[]
  notes: Note[]
  preservations: Preservation[]
  events: CalendarEvent[]
  todos: Todo[]
  contracts: Contract[]
  fees: FeeRecord[]
  invoices: Invoice[]
  /** 用户姓（app_meta.user_name）；未填写为空字符串。问候语仅展示姓 */
  userName: string
  /** 用户名（app_meta.user_given_name）；可空，用于头像等完整姓名展示 */
  userGivenName: string
  /** 测试模式（app_meta.test_mode）；开启后应用内可见演示数据入口 */
  testMode: boolean
  /** 是否已导入过演示数据（app_meta.demo_imported，防重复导入） */
  demoImported: boolean
  reminderSeen: string[]
  reminderSystem: boolean
  reminderBadge: boolean
}

export type InitialSetupMode = 'blank' | 'demo'

/** 首次启动初始化参数：姓必填（不填不能继续），名可空，mode 决定是否同时导入演示数据 */
export interface InitialSetupPayload {
  userName: string
  userGivenName: string
  mode: InitialSetupMode
}

export interface BootstrapResult {
  state: AppState
  setupRequired: boolean
}

export interface AlertOptions {
  title: string
  message: string
  detail?: string
  type?: 'info' | 'warning' | 'error'
}
export interface ConfirmOptions {
  title: string
  message: string
  detail?: string
  confirmLabel: '删除' | '导入'
}

export interface LexBenchApi {
  dialogs: {
    confirm(options: ConfirmOptions): Promise<boolean>
    alert(options: AlertOptions): Promise<void>
  }
  bootstrap(): Promise<BootstrapResult>
  initialize(payload: InitialSetupPayload): Promise<AppState>

  settings: {
    setReminderSystem(on: boolean): Promise<void>
    setReminderBadge(on: boolean): Promise<void>
    markRemindersSeen(fingerprints: string[]): Promise<void>
    /** 保存姓（app_meta.user_name），问候语仅展示姓 */
    setUserName(name: string): Promise<void>
    /** 保存名（app_meta.user_given_name），可空 */
    setUserGivenName(name: string): Promise<void>
    /** 切换测试模式（app_meta.test_mode），即点即生效 */
    setTestMode(on: boolean): Promise<void>
    /** 测试模式开启时导入演示数据（app_meta.demo_imported 防重复，返回完整快照） */
    importDemo(): Promise<AppState>
    /** 选择目标目录并导出 Excel 与可用附件 ZIP；取消选择时直接返回 */
    exportData(): Promise<void>
    /** 选择父目录并创建数据库与附件的完整备份；路径仅在主进程处理 */
    backupData(): Promise<void>
    /** 预检备份、确认覆盖、自动生成恢复点，成功后重启应用 */
    restoreData(): Promise<void>
    getExportStatus(): Promise<boolean>
    onExportStatusChanged(listener: (exporting: boolean) => void): () => void
  }

  cases: {
    create(value: Case): Promise<void>
    update(value: Case): Promise<void>
  }
  clients: {
    create(value: Client): Promise<void>
    update(value: Client): Promise<void>
  }
  notes: {
    create(value: Note, clearNewDraft?: boolean): Promise<void>
    update(value: Note): Promise<void>
    remove(id: string): Promise<void>
    saveNoteDraft(value: NoteDraftInput): Promise<NoteDraft>
    getNoteDraft(noteId: string): Promise<NoteDraft | null>
    deleteNoteDraft(noteId: string): Promise<void>
    listNoteVersions(noteId: string): Promise<NoteVersion[]>
    getNoteVersion(id: string): Promise<NoteVersion | null>
  }
  preservations: {
    create(value: Preservation): Promise<void>
    update(value: Preservation): Promise<void>
  }
  events: {
    create(value: CalendarEvent): Promise<void>
    update(value: CalendarEvent): Promise<void>
    remove(id: string): Promise<void>
  }
  todos: {
    create(value: Todo): Promise<void>
    update(value: Todo): Promise<void>
    remove(id: string): Promise<void>
  }
  contracts: {
    create(value: Contract): Promise<void>
    update(value: Contract): Promise<void>
    remove(id: string): Promise<void>
  }
  fees: {
    create(value: FeeRecord): Promise<void>
    update(value: FeeRecord): Promise<void>
    remove(id: string): Promise<void>
  }
  invoices: {
    create(value: Invoice): Promise<void>
    update(value: Invoice): Promise<void>
    remove(id: string): Promise<void>
  }
  files: {
    /** 打开系统文件选择框，将所选文件复制进对应归属目录并写入数据库 */
    selectAndStore(owner: FileOwner): Promise<FileMeta[]>
    open(id: string): Promise<void>
    reveal(id: string): Promise<void>
    /** 主进程显示二次确认；确认并删除后返回 true，取消返回 false */
    remove(id: string): Promise<boolean>
  }
}

declare global {
  interface Window {
    /** Electron preload 中存在；纯浏览器预览时不存在 */
    api?: LexBenchApi
  }
}
