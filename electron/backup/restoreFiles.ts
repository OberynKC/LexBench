import fs from 'node:fs'
import path from 'node:path'
import type { PreparedRestore } from './backupArchive'

const DATA_NAMES = ['lexbench.db', 'lexbench.db-wal', 'lexbench.db-shm', 'attachments'] as const
const JOURNAL_NAME = '.lexbench-restore.json'
interface RestoreJournal { directory: string; originals: string[] }

function rollback(userData: string, journal: RestoreJournal): void {
  const staging = path.join(userData, journal.directory)
  for (const name of DATA_NAMES) {
    const old = path.join(staging, 'original', name)
    const current = path.join(userData, name)
    if (fs.existsSync(old)) {
      fs.rmSync(current, { recursive: true, force: true }); fs.renameSync(old, current)
    } else if (!journal.originals.includes(name)) {
      fs.rmSync(current, { recursive: true, force: true })
    }
  }
  fs.unlinkSync(path.join(userData, JOURNAL_NAME))
  fs.rmSync(staging, { recursive: true, force: true })
}

/** 切换中意外退出时，在下次打开数据库前恢复旧文件；成功删除日志即为提交。 */
export function recoverInterruptedRestore(userData: string): void {
  const file = path.join(userData, JOURNAL_NAME)
  if (!fs.existsSync(file)) return
  const journal = JSON.parse(fs.readFileSync(file, 'utf8')) as RestoreJournal
  if (typeof journal.directory !== 'string' || !/^\.lexbench-restore-[A-Za-z0-9]+$/.test(journal.directory) ||
    !Array.isArray(journal.originals) || journal.originals.some((name) => !(DATA_NAMES as readonly string[]).includes(name)) ||
    !fs.existsSync(path.join(userData, journal.directory, 'original'))) throw new Error('数据恢复记录异常，请保留本地数据目录并检查恢复点')
  rollback(userData, journal)
}

/** 必须在关闭数据库后调用；同一文件系统内改名，失败时把旧库、WAL 和附件原样放回。 */
export function installPreparedRestore(prepared: PreparedRestore, userData: string): void {
  if (path.dirname(prepared.directory) !== path.resolve(userData)) throw new Error('恢复临时目录必须位于当前数据目录内')
  const original = path.join(prepared.directory, 'original')
  fs.mkdirSync(original)
  const journal: RestoreJournal = { directory: path.basename(prepared.directory), originals: DATA_NAMES.filter((name) => fs.existsSync(path.join(userData, name))) }
  fs.writeFileSync(path.join(userData, JOURNAL_NAME), JSON.stringify(journal), { flag: 'wx' })
  try {
    for (const name of journal.originals) fs.renameSync(path.join(userData, name), path.join(original, name))
    fs.renameSync(path.join(prepared.directory, 'lexbench.db'), path.join(userData, 'lexbench.db'))
    fs.renameSync(path.join(prepared.directory, 'attachments'), path.join(userData, 'attachments'))
    fs.unlinkSync(path.join(userData, JOURNAL_NAME))
  } catch (error) {
    try { rollback(userData, journal) } catch (rollbackError) {
      console.error('恢复旧数据失败，保留切换日志及原文件', rollbackError)
      throw new Error('恢复未完成，旧文件保存在恢复临时目录中，请重新启动应用以恢复原数据')
    }
    throw error
  }
  // 数据切换已提交；临时文件清理失败不得反向报告为恢复失败。
  try { fs.rmSync(prepared.directory, { recursive: true, force: true }) } catch (error) { console.error('清理恢复临时目录失败', error) }
}
