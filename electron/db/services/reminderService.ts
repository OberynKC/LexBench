import type Database from 'better-sqlite3'
import { collectReminders, isRedReminder, type ReminderItem } from '../../../src/lib/reminders'
import { getMeta, META_KEYS } from '../repos/appMetaRepo'
import { listTodos } from '../repos/todosRepo'
import { listPreservations } from '../repos/preservationsRepo'
import { recordReminderSent, wasReminderSent } from '../repos/remindersRepo'
import { isExporting, runMutation, assertWritable } from '../../export/exportGate'

export const REMINDER_SCAN_INTERVAL = 30 * 60 * 1000

/** 发送器返回系统 show 回执；扫描及回执写入均纳入导出等待。 */
export function createReminderService(db: Database.Database, deliver: (item: ReminderItem) => Promise<boolean>) {
  let stopped = false
  let scanning = false
  let timer: ReturnType<typeof setInterval> | undefined
  const scan = async () => {
    if (stopped || scanning || !db.open || isExporting(db)) return
    scanning = true
    try {
      // 只投影通知需要的数据，不读取附件和笔记正文。
      const candidates = collectReminders({ todos: listTodos(db), preservations: listPreservations(db), events: [],
        cases: db.prepare('SELECT id, title FROM cases').all() as Parameters<typeof collectReminders>[0]['cases'] }).filter(isRedReminder)
      for (const item of candidates) {
        if (stopped || isExporting(db) || getMeta(db, META_KEYS.reminderSystem) === '0') break
        if (wasReminderSent(db, item.itemKey, item.group)) continue
        await runMutation(db, async () => {
          assertWritable(db)
          // 前一通知等待期间可能完成、删除或修改期限，发出前重新核对。
          const current = collectReminders({ todos: listTodos(db), preservations: listPreservations(db), events: [], cases: [] })
            .find((value) => value.fingerprint === item.fingerprint)
          if (!current) return
          const shown = await deliver(item)
          if (shown && !stopped && db.open) {
            assertWritable(db)
            recordReminderSent(db, item.itemKey, item.group)
          }
        })
      }
    } catch (error) {
      console.error('期限提醒扫描失败', error)
    } finally { scanning = false }
  }
  return {
    scan,
    start() {
      if (timer || stopped) return
      void scan()
      timer = setInterval(() => { void scan() }, REMINDER_SCAN_INTERVAL)
    },
    stop() { stopped = true; clearInterval(timer) },
  }
}
