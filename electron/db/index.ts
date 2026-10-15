import Database from 'better-sqlite3'
import { app } from 'electron'
import path from 'node:path'
import { runMigrations } from './migrations'
import { recoverInterruptedRestore } from '../backup/restoreFiles'

let database: Database.Database | null = null

export function initDatabase(): Database.Database {
  if (database?.open) return database

  recoverInterruptedRestore(app.getPath('userData'))
  const dbPath = path.join(app.getPath('userData'), 'lexbench.db')
  const nextDatabase = new Database(dbPath, { timeout: 5000 })
  try {
    nextDatabase.pragma('foreign_keys = ON')
    nextDatabase.pragma('journal_mode = WAL')
    nextDatabase.pragma('synchronous = NORMAL')
    nextDatabase.pragma('busy_timeout = 5000')
    runMigrations(nextDatabase)
    database = nextDatabase
    return nextDatabase
  } catch (error) {
    nextDatabase.close()
    throw error
  }
}

export function getDatabase(): Database.Database {
  if (!database?.open) throw new Error('数据库尚未初始化')
  return database
}

export function closeDatabase(): void {
  if (!database?.open) return
  database.close()
  database = null
}
