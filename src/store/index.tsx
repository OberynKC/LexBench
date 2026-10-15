import { errorMessage, showAlert } from '../lib/dialogs'
import { MutationStateContext } from '../lib/mutationState'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import dayjs from 'dayjs'
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
  Preservation,
  Todo,
} from '../types'
import type { AppState, InitialSetupPayload, LexBenchApi } from '../types/api'
import { genId } from '../lib/utils'
import { syncTodoEvents } from '../lib/todoEvent'
import { StartupGate, type StartupGateMode } from '../components/StartupGate'

export type Action =
  | { type: 'addCase'; payload: Case }
  | { type: 'updateCase'; payload: Case }
  | { type: 'addNote'; payload: Note; clearNewDraft?: boolean }
  | { type: 'updateNote'; payload: Note }
  | { type: 'deleteNote'; payload: string }
  | { type: 'addPreservation'; payload: Preservation }
  | { type: 'updatePreservation'; payload: Preservation }
  | { type: 'addEvent'; payload: CalendarEvent }
  | { type: 'updateEvent'; payload: CalendarEvent }
  | { type: 'deleteEvent'; payload: string }
  | { type: 'addClient'; payload: Client }
  | { type: 'updateClient'; payload: Client }
  | { type: 'addTodo'; payload: Todo }
  | { type: 'updateTodo'; payload: Todo }
  | { type: 'deleteTodo'; payload: string }
  | { type: 'addContract'; payload: Contract }
  | { type: 'updateContract'; payload: Contract }
  | { type: 'deleteContract'; payload: string }
  | { type: 'addFee'; payload: FeeRecord }
  | { type: 'updateFee'; payload: FeeRecord }
  | { type: 'deleteFee'; payload: string }
  | { type: 'addInvoice'; payload: Invoice }
  | { type: 'updateInvoice'; payload: Invoice }
  | { type: 'deleteInvoice'; payload: string }
  | { type: 'setUserName'; payload: string }
  | { type: 'setUserGivenName'; payload: string }
  | { type: 'setTestMode'; payload: boolean }
  | { type: 'setReminderSystem'; payload: boolean }
  | { type: 'setReminderBadge'; payload: boolean }
  | { type: 'markRemindersSeen'; payload: string[] }

type ReducerAction =
  | Action
  | { type: 'hydrate'; payload: AppState }
  | { type: 'appendFiles'; payload: { owner: FileOwner; files: FileMeta[] } }
  | { type: 'removeFile'; payload: string }

function reducer(state: AppState, action: ReducerAction): AppState {
  switch (action.type) {
    case 'hydrate':
      return action.payload
    case 'appendFiles': {
      const { owner, files } = action.payload
      if (owner.type === 'case') {
        return {
          ...state,
          cases: state.cases.map((value) =>
            value.id === owner.id ? { ...value, files: [...value.files, ...files] } : value,
          ),
        }
      }
      if (owner.type === 'contract') {
        return {
          ...state,
          contracts: state.contracts.map((value) =>
            value.id === owner.id ? { ...value, files: [...value.files, ...files] } : value,
          ),
        }
      }
      return {
        ...state,
        invoices: state.invoices.map((value) =>
          value.id === owner.id ? { ...value, files: [...value.files, ...files] } : value,
        ),
      }
    }
    case 'removeFile':
      return {
        ...state,
        cases: state.cases.map((value) => ({ ...value, files: value.files.filter((file) => file.id !== action.payload) })),
        contracts: state.contracts.map((value) => ({ ...value, files: value.files.filter((file) => file.id !== action.payload) })),
        invoices: state.invoices.map((value) => ({ ...value, files: value.files.filter((file) => file.id !== action.payload) })),
      }
    case 'addCase':
      return { ...state, cases: [action.payload, ...state.cases] }
    case 'updateCase':
      return { ...state, cases: state.cases.map((value) => (value.id === action.payload.id ? action.payload : value)) }
    case 'addNote':
      return { ...state, notes: [action.payload, ...state.notes] }
    case 'updateNote':
      return { ...state, notes: state.notes.map((value) => (value.id === action.payload.id ? action.payload : value)) }
    case 'deleteNote':
      return { ...state, notes: state.notes.filter((value) => value.id !== action.payload) }
    case 'addPreservation':
      return { ...state, preservations: [action.payload, ...state.preservations] }
    case 'updatePreservation':
      return {
        ...state,
        preservations: state.preservations.map((value) => (value.id === action.payload.id ? action.payload : value)),
      }
    case 'addEvent':
      return { ...state, events: [action.payload, ...state.events] }
    case 'updateEvent':
      return { ...state, events: state.events.map((value) => (value.id === action.payload.id ? action.payload : value)) }
    case 'deleteEvent':
      return { ...state, events: state.events.filter((value) => value.id !== action.payload) }
    case 'addClient':
      return { ...state, clients: [action.payload, ...state.clients] }
    case 'updateClient':
      return { ...state, clients: state.clients.map((value) => (value.id === action.payload.id ? action.payload : value)) }
    case 'addContract':
      return { ...state, contracts: [action.payload, ...state.contracts] }
    case 'updateContract':
      return {
        ...state,
        contracts: state.contracts.map((value) => (value.id === action.payload.id ? action.payload : value)),
      }
    // 主进程由外键 CASCADE 持久化级联；renderer 同步过滤，保持乐观 UI 一致。
    case 'deleteContract':
      return {
        ...state,
        contracts: state.contracts.filter((value) => value.id !== action.payload),
        fees: state.fees.filter((value) => value.contractId !== action.payload),
        invoices: state.invoices.filter((value) => value.contractId !== action.payload),
      }
    case 'addFee':
      return { ...state, fees: [action.payload, ...state.fees] }
    case 'updateFee':
      return { ...state, fees: state.fees.map((value) => (value.id === action.payload.id ? action.payload : value)) }
    case 'deleteFee':
      return { ...state, fees: state.fees.filter((value) => value.id !== action.payload) }
    case 'addInvoice':
      return { ...state, invoices: [action.payload, ...state.invoices] }
    case 'updateInvoice':
      return {
        ...state,
        invoices: state.invoices.map((value) => (value.id === action.payload.id ? action.payload : value)),
      }
    case 'deleteInvoice':
      return { ...state, invoices: state.invoices.filter((value) => value.id !== action.payload) }
    case 'addTodo':
      return {
        ...state,
        todos: [action.payload, ...state.todos],
        events: syncTodoEvents(state.events, action.payload),
      }
    case 'updateTodo':
      return {
        ...state,
        todos: state.todos.map((value) => (value.id === action.payload.id ? action.payload : value)),
        events: syncTodoEvents(state.events, action.payload),
      }
    case 'deleteTodo':
      return {
        ...state,
        todos: state.todos.filter((value) => value.id !== action.payload),
        events: state.events.filter((value) => value.todoId !== action.payload),
      }
    case 'setUserName':
      return { ...state, userName: action.payload }
    case 'setUserGivenName':
      return { ...state, userGivenName: action.payload }
    case 'setTestMode':
      return { ...state, testMode: action.payload }
    case 'setReminderSystem':
      return { ...state, reminderSystem: action.payload }
    case 'setReminderBadge':
      return { ...state, reminderBadge: action.payload }
    case 'markRemindersSeen':
      return { ...state, reminderSeen: [...new Set([...state.reminderSeen, ...action.payload])] }
  }
}

const initialState: AppState = {
  cases: [],
  clients: [],
  notes: [],
  preservations: [],
  events: [],
  todos: [],
  contracts: [],
  fees: [],
  invoices: [],
  userName: '',
  userGivenName: '',
  testMode: false,
  demoImported: false,
  reminderSeen: [],
  reminderSystem: true,
  reminderBadge: true,
}

interface StoreApi {
  state: AppState
  dispatch: (action: Action) => boolean
  readOnly: boolean
  canWrite: () => boolean
  /** 等待 FIFO 写队列排空；期间发生回滚时拒绝，避免将接受操作当成保存成功 */
  waitForWrites: () => Promise<void>
  /** 登记独立草稿等写操作，供导出、备份和恢复等待；失败由调用方处理 */
  trackWrite: <T>(operation: () => Promise<T>) => Promise<T>
  exportData: () => Promise<void>
  backupData: () => Promise<void>
  restoreData: () => Promise<void>
  /** 便捷查询 */
  getCase: (id: string) => Case | undefined
  getClient: (id: string) => Client | undefined
  getContract: (id: string) => Contract | undefined
  casesOfClient: (clientId: string) => Case[]
  notesOfCase: (caseId: string) => Note[]
  preservationsOfCase: (caseId: string) => Preservation[]
  eventsOfCase: (caseId: string) => CalendarEvent[]
  todosOfCase: (caseId: string) => Todo[]
  contractsOfClient: (clientId: string) => Contract[]
  contractsOfCase: (caseId: string) => Contract[]
  feesOfContract: (contractId: string) => FeeRecord[]
  invoicesOfContract: (contractId: string) => Invoice[]
  selectAndStoreFiles: (owner: FileOwner) => Promise<FileMeta[]>
  openFile: (id: string) => Promise<void>
  revealFile: (id: string) => Promise<void>
  removeFile: (id: string) => Promise<boolean>
  /** 合同的应收 / 实收汇总（均按合同计，不按案件分摊，避免多案件合同重复统计） */
  feeSummary: (contractId: string) => { receivable: number; received: number }
  /** 新建辅助 */
  newId: (prefix: string) => string
  now: () => string
  /** 导入演示数据（测试模式专用；主进程检查 test_mode 并按 demo_imported 防重复，导入后以返回快照替换 state） */
  importDemoData: () => Promise<void>
}

type StartupState =
  | { mode: 'ready'; message?: undefined }
  | { mode: StartupGateMode; message?: string }

type BootstrapReason = 'initial' | 'retry' | 'recovery'

const StoreContext = createContext<StoreApi | null>(null)

async function persistAction(api: LexBenchApi, action: Action): Promise<void> {
  switch (action.type) {
    case 'addCase':
      return api.cases.create(action.payload)
    case 'updateCase':
      return api.cases.update(action.payload)
    case 'addNote':
      return api.notes.create(action.payload, action.clearNewDraft)
    case 'updateNote':
      return api.notes.update(action.payload)
    case 'deleteNote':
      return api.notes.remove(action.payload)
    case 'addPreservation':
      return api.preservations.create(action.payload)
    case 'updatePreservation':
      return api.preservations.update(action.payload)
    case 'addEvent':
      return api.events.create(action.payload)
    case 'updateEvent':
      return api.events.update(action.payload)
    case 'deleteEvent':
      return api.events.remove(action.payload)
    case 'addClient':
      return api.clients.create(action.payload)
    case 'updateClient':
      return api.clients.update(action.payload)
    case 'addTodo':
      return api.todos.create(action.payload)
    case 'updateTodo':
      return api.todos.update(action.payload)
    case 'deleteTodo':
      return api.todos.remove(action.payload)
    case 'addContract':
      return api.contracts.create(action.payload)
    case 'updateContract':
      return api.contracts.update(action.payload)
    case 'deleteContract':
      return api.contracts.remove(action.payload)
    case 'addFee':
      return api.fees.create(action.payload)
    case 'updateFee':
      return api.fees.update(action.payload)
    case 'deleteFee':
      return api.fees.remove(action.payload)
    case 'addInvoice':
      return api.invoices.create(action.payload)
    case 'updateInvoice':
      return api.invoices.update(action.payload)
    case 'deleteInvoice':
      return api.invoices.remove(action.payload)
    case 'setUserName':
      return api.settings.setUserName(action.payload)
    case 'setUserGivenName':
      return api.settings.setUserGivenName(action.payload)
    case 'setTestMode':
      return api.settings.setTestMode(action.payload)
    case 'setReminderSystem':
      return api.settings.setReminderSystem(action.payload)
    case 'setReminderBadge':
      return api.settings.setReminderBadge(action.payload)
    case 'markRemindersSeen':
      return api.settings.markRemindersSeen(action.payload)
  }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, reducerDispatch] = useReducer(reducer, initialState)
  const [startup, setStartup] = useState<StartupState>({ mode: window.api ? 'loading' : 'browser' })
  const queueRef = useRef<Promise<void>>(Promise.resolve())
  const queueGenerationRef = useRef(0)
  const bootstrapAttemptRef = useRef(0)
  const readyRef = useRef(false)
  const recoveringRef = useRef(false)
  const [readOnly, setReadOnly] = useState(false)
  const preparingExportRef = useRef(false)
  const mainExportRef = useRef(false)
  const activeWritesRef = useRef(new Set<Promise<unknown>>())
  const stateRef = useRef(state)
  stateRef.current = state

  const canWrite = useCallback(() => readyRef.current && !recoveringRef.current && !preparingExportRef.current && !mainExportRef.current, [])
  const waitForWrites = useCallback(async (): Promise<void> => {
    const generation = queueGenerationRef.current
    let pending: Promise<void>
    do {
      pending = queueRef.current
      await pending
      if (generation !== queueGenerationRef.current || recoveringRef.current || !readyRef.current) {
        throw new Error('保存失败，请恢复后重试')
      }
    } while (pending !== queueRef.current)
  }, [])
  const trackWrite = useCallback(<T,>(operation: () => Promise<T>): Promise<T> => {
    if (!canWrite()) return Promise.reject(new Error('本地数据暂不可修改，请等待导出或恢复完成'))
    const pending = operation()
    activeWritesRef.current.add(pending)
    void pending.finally(() => activeWritesRef.current.delete(pending)).catch(() => undefined)
    return pending
  }, [canWrite])

  useEffect(() => {
    const electronApi = window.api
    if (!electronApi) return
    let disposed = false
    let receivedEvent = false
    const update = (busy: boolean) => {
      mainExportRef.current = busy
      setReadOnly(busy || preparingExportRef.current)
    }
    const unsubscribe = electronApi.settings.onExportStatusChanged((busy) => { receivedEvent = true; update(busy) })
    void electronApi.settings.getExportStatus().then((busy) => {
      if (!disposed && !receivedEvent) update(busy)
    }).catch((error) => { console.error('读取导出状态失败', error) })
    return () => { disposed = true; unsubscribe() }
  }, [])

  const runProtectedDataOperation = useCallback(async <T,>(operation: (api: LexBenchApi) => Promise<T>): Promise<T> => {
    if (!window.api || !canWrite()) throw new Error('当前无法执行数据操作，请等待保存、导出、备份或恢复完成')
    preparingExportRef.current = true
    setReadOnly(true)
    const generation = queueGenerationRef.current
    try {
      const results = await Promise.allSettled([queueRef.current, ...activeWritesRef.current])
      if (generation !== queueGenerationRef.current || recoveringRef.current || !readyRef.current || results.some((r) => r.status === 'rejected')) {
        throw new Error('已有修改未能保存，本次数据操作已停止，请检查后重试')
      }
      return await operation(window.api)
    } finally {
      preparingExportRef.current = false
      setReadOnly(mainExportRef.current)
    }
  }, [canWrite])
  const exportData = useCallback(() => runProtectedDataOperation((api) => api.settings.exportData()), [runProtectedDataOperation])
  const backupData = useCallback(() => runProtectedDataOperation((api) => api.settings.backupData()), [runProtectedDataOperation])
  const restoreData = useCallback(() => runProtectedDataOperation((api) => api.settings.restoreData()), [runProtectedDataOperation])

  const bootstrap = useCallback(async (reason: BootstrapReason): Promise<boolean> => {
    const electronApi = window.api
    readyRef.current = false
    if (!electronApi) {
      recoveringRef.current = false
      setStartup({ mode: 'browser' })
      return false
    }

    const attempt = ++bootstrapAttemptRef.current
    setStartup({
      mode: reason === 'recovery' ? 'recovering' : 'loading',
      message: reason === 'recovery' ? '保存失败，正在从本地数据库恢复最后一次成功保存的数据。' : undefined,
    })

    try {
      const result = await electronApi.bootstrap()
      if (attempt !== bootstrapAttemptRef.current) return false
      reducerDispatch({ type: 'hydrate', payload: result.state })
      recoveringRef.current = false
      if (result.setupRequired) {
        setStartup({ mode: 'setup' })
      } else {
        readyRef.current = true
        setStartup({ mode: 'ready' })
      }
      return true
    } catch (error) {
      if (attempt !== bootstrapAttemptRef.current) return false
      recoveringRef.current = false
      const prefix = reason === 'recovery' ? '保存失败，重新加载数据库也未成功。' : ''
      setStartup({ mode: 'error', message: `${prefix}${errorMessage(error)}` })
      return false
    }
  }, [])

  useEffect(() => {
    void bootstrap('initial')
    return () => {
      bootstrapAttemptRef.current += 1
    }
  }, [bootstrap])

  const initialize = useCallback(async (payload: InitialSetupPayload) => {
    const electronApi = window.api
    if (!electronApi) {
      setStartup({ mode: 'browser' })
      return
    }

    readyRef.current = false
    const attempt = ++bootstrapAttemptRef.current
    setStartup({ mode: 'initializing' })
    try {
      const nextState = await electronApi.initialize(payload)
      if (attempt !== bootstrapAttemptRef.current) return
      reducerDispatch({ type: 'hydrate', payload: nextState })
      readyRef.current = true
      setStartup({ mode: 'ready' })
    } catch (error) {
      if (attempt !== bootstrapAttemptRef.current) return
      setStartup({ mode: 'error', message: errorMessage(error) })
    }
  }, [])

  const importDemoData = useCallback(() => runProtectedDataOperation(async (api) => {
    const nextState = await api.settings.importDemo()
    reducerDispatch({ type: 'hydrate', payload: nextState })
  }), [runProtectedDataOperation])

  const selectAndStoreFiles = useCallback((owner: FileOwner): Promise<FileMeta[]> => trackWrite(async () => {
    const generation = queueGenerationRef.current
    await queueRef.current
    if (generation !== queueGenerationRef.current || recoveringRef.current) throw new Error('保存失败，请恢复后重试')
    const files = await window.api!.files.selectAndStore(owner)
    if (files.length > 0) reducerDispatch({ type: 'appendFiles', payload: { owner, files } })
    return files
  }), [trackWrite])

  const openFile = useCallback(async (id: string): Promise<void> => {
    const electronApi = window.api
    if (!electronApi) throw new Error('本地文件服务当前不可用')
    await electronApi.files.open(id)
  }, [])

  const revealFile = useCallback(async (id: string): Promise<void> => {
    const electronApi = window.api
    if (!electronApi) throw new Error('本地文件服务当前不可用')
    await electronApi.files.reveal(id)
  }, [])

  const removeFile = useCallback((id: string): Promise<boolean> => trackWrite(async () => {
    const generation = queueGenerationRef.current
    await queueRef.current
    if (generation !== queueGenerationRef.current || recoveringRef.current) throw new Error('保存失败，请恢复后重试')
    const removed = await window.api!.files.remove(id)
    if (removed) reducerDispatch({ type: 'removeFile', payload: id })
    return removed
  }), [trackWrite])

  const dispatch = useCallback<(action: Action) => boolean>(
    (action) => {
      const electronApi = window.api
      if (!electronApi || !canWrite()) return false
      // 确认框等待期间目标可能消失；更新/删除前按最新快照核对，拒绝时保留表单。
      const match = /^(update|delete)(Case|Client|Note|Preservation|Event|Todo|Contract|Fee|Invoice)$/.exec(action.type)
      if (match) {
        const collections = { Case: 'cases', Client: 'clients', Note: 'notes', Preservation: 'preservations', Event: 'events', Todo: 'todos', Contract: 'contracts', Fee: 'fees', Invoice: 'invoices' } as const
        const collection = collections[match[2] as keyof typeof collections]
        const id = typeof action.payload === 'string' ? action.payload : (action.payload as { id: string }).id
        if (!stateRef.current[collection].some((item) => item.id === id)) {
          void showAlert('目标记录已不存在，请重新打开列表查看')
          return false
        }
      }
      stateRef.current = reducer(stateRef.current, action)
      reducerDispatch(action)
      const generation = queueGenerationRef.current
      queueRef.current = queueRef.current
        .then(async () => {
          if (generation !== queueGenerationRef.current || recoveringRef.current) return
          await persistAction(electronApi, action)
        })
        .catch(async (error) => {
          if (generation !== queueGenerationRef.current || recoveringRef.current) return
          console.error(`持久化操作 ${action.type} 失败`, error)
          queueGenerationRef.current += 1
          recoveringRef.current = true
          readyRef.current = false
          void showAlert('保存失败，后续待保存操作已停止。律衡将重新加载本地数据库中的数据。', '保存失败', 'error')
          await bootstrap('recovery')
        })
      return true
    },
    [bootstrap, canWrite],
  )

  const api = useMemo<StoreApi>(
    () => ({
      state,
      dispatch,
      readOnly,
      canWrite,
      waitForWrites,
      trackWrite,
      exportData,
      backupData,
      restoreData,
      getCase: (id) => state.cases.find((value) => value.id === id),
      getClient: (id) => state.clients.find((value) => value.id === id),
      casesOfClient: (clientId) => state.cases.filter((value) => value.clientId === clientId),
      notesOfCase: (caseId) =>
        state.notes
          .filter((value) => value.caseId === caseId)
          .sort((a, b) => dayjs(b.updatedAt).valueOf() - dayjs(a.updatedAt).valueOf()),
      preservationsOfCase: (caseId) => state.preservations.filter((value) => value.caseId === caseId),
      eventsOfCase: (caseId) =>
        state.events
          .filter((value) => value.caseId === caseId)
          .sort((a, b) => dayjs(a.start).valueOf() - dayjs(b.start).valueOf()),
      todosOfCase: (caseId) =>
        state.todos.filter((value) => value.caseId === caseId).sort((a, b) => Number(a.done) - Number(b.done)),
      getContract: (id) => state.contracts.find((value) => value.id === id),
      contractsOfClient: (clientId) =>
        state.contracts
          .filter((value) => value.clientId === clientId)
          .sort((a, b) => dayjs(b.signedAt).valueOf() - dayjs(a.signedAt).valueOf()),
      contractsOfCase: (caseId) => state.contracts.filter((value) => value.caseIds.includes(caseId)),
      feesOfContract: (contractId) =>
        state.fees
          .filter((value) => value.contractId === contractId)
          .sort((a, b) => dayjs(a.dueDate).valueOf() - dayjs(b.dueDate).valueOf()),
      invoicesOfContract: (contractId) =>
        state.invoices
          .filter((value) => value.contractId === contractId)
          .sort((a, b) => dayjs(b.issuedAt).valueOf() - dayjs(a.issuedAt).valueOf()),
      selectAndStoreFiles,
      openFile,
      revealFile,
      removeFile,
      feeSummary: (contractId) => {
        const list = state.fees.filter((value) => value.contractId === contractId)
        return {
          receivable: list.reduce((sum, value) => sum + value.amount, 0),
          received: list.reduce((sum, value) => sum + value.receivedAmount, 0),
        }
      },
      newId: genId,
      now: () => dayjs().toISOString(),
      importDemoData,
    }),
    [dispatch, state, readOnly, canWrite, waitForWrites, trackWrite, exportData, backupData, restoreData, importDemoData, openFile, removeFile, revealFile, selectAndStoreFiles],
  )

  if (startup.mode !== 'ready') {
    return (
      <StartupGate
        mode={startup.mode}
        message={startup.message}
        testMode={state.testMode}
        onInitialize={(payload) => void initialize(payload)}
        onRetry={() => void bootstrap('retry')}
      />
    )
  }

  return (
    <StoreContext.Provider value={api}>
      <MutationStateContext.Provider value={readOnly}>{children}</MutationStateContext.Provider>
    </StoreContext.Provider>
  )
}

export function useStore(): StoreApi {
  const context = useContext(StoreContext)
  if (!context) throw new Error('useStore 必须在 StoreProvider 内使用')
  return context
}
