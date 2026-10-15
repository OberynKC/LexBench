import type Database from 'better-sqlite3'
import { randomUUID } from 'node:crypto'
import { getMeta, setMeta, META_KEYS } from './appMetaRepo'

export function readReminderSeen(db: Database.Database): string[] {
  const value: unknown = JSON.parse(getMeta(db, META_KEYS.reminderSeen) ?? '[]')
  if (!Array.isArray(value) || value.some((key) => typeof key !== 'string')) throw new Error('提醒已读记录格式无效')
  return value
}

export function markRemindersSeen(db: Database.Database, value: unknown): void {
  if (!Array.isArray(value) || value.some((key) => typeof key !== 'string' || !/^(todo|preservation):.+:\d{4}-\d{2}-\d{2}:(overdue|week)$/.test(key))) {
    throw new Error('提醒已读指纹格式无效')
  }
  setMeta(db, META_KEYS.reminderSeen, JSON.stringify([...new Set([...readReminderSeen(db), ...value])]))
}

export function setReminderPreference(db: Database.Database, key: 'reminderSystem' | 'reminderBadge', value: unknown): void {
  if (typeof value !== 'boolean') throw new Error('提醒开关必须为布尔值')
  setMeta(db, META_KEYS[key], value ? '1' : '0')
}

export function wasReminderSent(db: Database.Database, itemKey: string, bucket: string): boolean {
  return !!db.prepare('SELECT 1 FROM reminder_log WHERE item_key = ? AND channel = ? AND threshold_bucket = ?')
    .get(itemKey, 'system', bucket)
}

export function recordReminderSent(db: Database.Database, itemKey: string, bucket: string): void {
  db.prepare(`INSERT INTO reminder_log (id, item_key, channel, threshold_bucket, sent_at)
    VALUES (?, ?, ?, ?, ?) ON CONFLICT(item_key, channel, threshold_bucket) DO NOTHING`)
    .run(randomUUID(), itemKey, 'system', bucket, new Date().toISOString())
}
