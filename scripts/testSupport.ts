import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import { runMigrations } from '../electron/db/migrations'

let assertions = 0
export function check(condition: unknown, label: string): asserts condition {
  assert.ok(condition, label)
  assertions++
  console.log(`  ✓ ${label}`)
}
export function equal(actual: unknown, expected: unknown, label: string): void {
  assert.deepEqual(actual, expected, label)
  assertions++
  console.log(`  ✓ ${label}`)
}
export async function rejects(operation: () => unknown | Promise<unknown>, message: RegExp, label: string): Promise<void> {
  await assert.rejects(async () => { await operation() }, message, label)
  assertions++
  console.log(`  ✓ ${label}`)
}
export function report(): void { console.log(`\n冒烟结果：${assertions} 项通过，0 项失败`) }
export function testDatabase(file: string): Database.Database {
  const db = new Database(file)
  db.pragma('foreign_keys = ON')
  db.pragma('journal_mode = WAL')
  runMigrations(db)
  return db
}
export function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
