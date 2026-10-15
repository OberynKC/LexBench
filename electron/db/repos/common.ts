import type Database from 'better-sqlite3'

export function assertOne(result: Database.RunResult): void {
  if (result.changes !== 1) throw new Error('目标记录不存在或受影响行数异常')
}
