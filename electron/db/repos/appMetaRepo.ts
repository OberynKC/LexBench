import type Database from 'better-sqlite3'

export const META_KEYS = {
  setupCompleted: 'initial_setup_completed',
  userName: 'user_name',
  userGivenName: 'user_given_name',
  testMode: 'test_mode',
  demoImported: 'demo_imported',
  reminderSeen: 'reminder_seen',
  reminderSystem: 'reminder_system',
  reminderBadge: 'reminder_badge',
} as const

interface MetaRow {
  value: string
}

export function getMeta(db: Database.Database, key: string): string | null {
  const row = db.prepare<[string], MetaRow>('SELECT value FROM app_meta WHERE key = ?').get(key)
  return row?.value ?? null
}

export function setMeta(db: Database.Database, key: string, value: string): void {
  db.prepare(`
    INSERT INTO app_meta (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(key, value)
}
