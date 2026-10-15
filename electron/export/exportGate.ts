import type Database from 'better-sqlite3'
import { AsyncLocalStorage } from 'node:async_hooks'

const mutationContext = new AsyncLocalStorage<{ db: Database.Database; token: symbol }>()
const states = new WeakMap<Database.Database, { busy: boolean; locked: boolean; owner?: symbol; writes: Map<symbol, Promise<unknown>> }>()
const listeners = new Set<(db: Database.Database, busy: boolean) => void>()
export const EXPORT_BUSY_MESSAGE = '正在导出数据、备份或恢复，暂时不能修改，请等待完成'

function stateOf(db: Database.Database) {
  let state = states.get(db)
  if (!state) {
    state = { busy: false, locked: false, writes: new Map() }
    states.set(db, state)
  }
  return state
}
export function isExporting(db: Database.Database): boolean { return stateOf(db).busy }

export function subscribeExportState(listener: (db: Database.Database, busy: boolean) => void): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

/** 在原生选择/确认框返回后、同步写入前再次调用。准备导出时允许已登记的操作完成。 */
export function assertWritable(db: Database.Database): void {
  const state = stateOf(db)
  const context = mutationContext.getStore()
  if (state.locked && !(context?.db === db && context.token === state.owner)) throw new Error(EXPORT_BUSY_MESSAGE)
}

export async function runMutation<T>(db: Database.Database, operation: () => T | Promise<T>): Promise<T> {
  const state = stateOf(db)
  if (state.busy) throw new Error(EXPORT_BUSY_MESSAGE)
  const token = Symbol('mutation')
  const pending = Promise.resolve().then(() => mutationContext.run({ db, token }, operation))
  state.writes.set(token, pending)
  try { return await pending } finally { state.writes.delete(token) }
}

export async function runExport<T>(db: Database.Database, operation: () => Promise<T>): Promise<T> {
  const state = stateOf(db)
  if (state.busy) throw new Error('已有数据导出、备份或恢复正在进行，请等待完成')
  const context = mutationContext.getStore()
  const owner = context?.db === db ? context.token : undefined
  const publish = (busy: boolean) => {
    state.busy = busy
    for (const listener of listeners) {
      try { listener(db, busy) } catch (error) { console.error('通知导出状态失败', error) }
    }
  }
  publish(true)
  try {
    // 不跨 await 持有 SQLite 事务；原生对话框已启动的写操作先完成，再固定快照。
    // 恢复、演示导入仍经过 runMutation；排空其他写操作，避免等待当前操作自身。
    const results = await Promise.allSettled([...state.writes].filter(([token]) => token !== owner).map(([, pending]) => pending))
    if (results.some((result) => result.status === 'rejected')) throw new Error('已有修改未能保存，本次导出已停止，请检查后重试')
    state.locked = true
    state.owner = owner
    return await operation()
  } finally {
    state.locked = false
    state.owner = undefined
    publish(false)
  }
}
