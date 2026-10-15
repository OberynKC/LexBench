import { assertWritable } from '../export/exportGate'
import type Database from 'better-sqlite3'
import fs from 'node:fs'
import path from 'node:path'
import { randomBytes, randomUUID } from 'node:crypto'
import type { FileMeta, FileOwner } from '../../src/types'
import { createOwnedFile, deleteFile, findFileRow, nextFileSortOrder } from '../db/repos/filesRepo'
import { mapFile, type FileRow } from '../db/mappers'

const OWNER_FOLDERS = {
  contract: 'contracts',
  invoice: 'invoices',
  case: 'cases',
} as const

function assertSafeSegment(value: string, label: string): void {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error(`${label}格式无效`)
}

function ownerIdOf(row: FileRow): FileOwner {
  if (row.contract_id !== null && row.invoice_id === null && row.case_id === null) {
    return { type: 'contract', id: row.contract_id }
  }
  if (row.contract_id === null && row.invoice_id !== null && row.case_id === null) {
    return { type: 'invoice', id: row.invoice_id }
  }
  if (row.contract_id === null && row.invoice_id === null && row.case_id !== null) {
    return { type: 'case', id: row.case_id }
  }
  throw new Error('附件归属数据损坏')
}

function assertOwnerExists(db: Database.Database, owner: FileOwner): void {
  const table = owner.type === 'contract' ? 'contracts' : owner.type === 'invoice' ? 'invoices' : 'cases'
  const found = db.prepare(`SELECT 1 FROM ${table} WHERE id = ?`).get(owner.id)
  if (!found) throw new Error('附件归属对象不存在')
}

function truncateUtf8(value: string, maxBytes: number): string {
  let result = ''
  for (const char of value) {
    if (Buffer.byteLength(result + char, 'utf8') > maxBytes) break
    result += char
  }
  return result
}

function safeStoredName(originalName: string, suffix: string): string {
  const sanitized = originalName
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')
    .replace(/[. ]+$/g, '')
    .trim() || '附件'
  const rawExtension = path.extname(sanitized)
  const extension = truncateUtf8(rawExtension, 40)
  const stem = truncateUtf8(sanitized.slice(0, sanitized.length - rawExtension.length), 180) || '附件'
  return `${stem}-${suffix}${extension}`
}

function tryRemoveEmptyDirectory(directory: string): void {
  try {
    fs.rmdirSync(directory)
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    if (code !== 'ENOENT' && code !== 'ENOTEMPTY') throw error
  }
}

export function attachmentsRootForDatabase(db: Database.Database): string {
  if (!db.name || db.name === ':memory:') throw new Error('无法确定附件存储目录')
  return path.join(path.dirname(db.name), 'attachments')
}

export function ownerDirectory(root: string, owner: FileOwner): string {
  assertSafeSegment(owner.id, '归属对象 id')
  return path.join(root, OWNER_FOLDERS[owner.type], owner.id)
}

export function removeOwnerDirectory(root: string, owner: FileOwner): void {
  fs.rmSync(ownerDirectory(root, owner), { recursive: true, force: true })
}

export function storedFilePath(root: string, row: FileRow): string {
  if (!row.stored_name || !row.rel_path) {
    throw new Error('该记录来自旧版，仅保存过文件元数据，没有可打开的文件内容')
  }
  if (row.stored_name !== path.posix.basename(row.stored_name) || row.stored_name === '.' || row.stored_name === '..') {
    throw new Error('附件存储名无效')
  }

  const owner = ownerIdOf(row)
  assertSafeSegment(owner.id, '附件归属对象 id')
  const expected = path.posix.join(OWNER_FOLDERS[owner.type], owner.id, row.stored_name)
  if (row.rel_path !== expected) throw new Error('附件相对路径与归属不一致')

  const resolvedRoot = path.resolve(root)
  const resolvedFile = path.resolve(root, ...row.rel_path.split('/'))
  if (!resolvedFile.startsWith(`${resolvedRoot}${path.sep}`)) throw new Error('附件路径越出存储目录')
  return resolvedFile
}

export function findStoredFilePath(db: Database.Database, fileId: string): string {
  const row = findFileRow(db, fileId)
  if (!row) throw new Error('附件记录不存在')
  const filePath = storedFilePath(attachmentsRootForDatabase(db), row)
  if (!fs.statSync(filePath, { throwIfNoEntry: false })?.isFile()) throw new Error('附件文件不存在或已被移动')
  return filePath
}

export function copyFilesToOwner(
  db: Database.Database,
  owner: FileOwner,
  sourcePaths: readonly string[],
): FileMeta[] {
  assertWritable(db)
  assertSafeSegment(owner.id, '归属对象 id')
  assertOwnerExists(db, owner)
  if (sourcePaths.length === 0) return []

  const root = attachmentsRootForDatabase(db)
  const directory = ownerDirectory(root, owner)
  fs.mkdirSync(directory, { recursive: true })

  const copiedPaths: string[] = []
  const files: FileMeta[] = []
  try {
    for (const sourcePath of sourcePaths) {
      const stat = fs.statSync(sourcePath)
      if (!stat.isFile()) throw new Error(`只能上传普通文件：${path.basename(sourcePath)}`)

      const name = path.basename(sourcePath)
      let storedName = ''
      let destination = ''
      for (let attempt = 0; attempt < 20; attempt += 1) {
        storedName = safeStoredName(name, randomBytes(4).toString('hex'))
        destination = path.join(directory, storedName)
        try {
          fs.copyFileSync(sourcePath, destination, fs.constants.COPYFILE_EXCL)
          break
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'EEXIST' || attempt === 19) throw error
        }
      }
      copiedPaths.push(destination)
      files.push({
        id: `file_${randomUUID()}`,
        name,
        storedName,
        relPath: path.posix.join(OWNER_FOLDERS[owner.type], owner.id, storedName),
        size: stat.size,
        uploadedAt: new Date().toISOString(),
      })
    }

    const firstSortOrder = nextFileSortOrder(db, owner)
    db.transaction(() => {
      files.forEach((file, index) => createOwnedFile(db, owner, file, firstSortOrder + index))
    })()
    return files
  } catch (error) {
    copiedPaths.forEach((filePath) => fs.rmSync(filePath, { force: true }))
    tryRemoveEmptyDirectory(directory)
    throw error
  }
}

/** 删除数据库记录及对应磁盘文件；界面层必须在调用前完成二次确认。 */
export function deleteFileAndContent(db: Database.Database, fileId: string): FileMeta {
  assertWritable(db)
  const row = findFileRow(db, fileId)
  if (!row) throw new Error('附件记录不存在')
  const root = attachmentsRootForDatabase(db)
  const owner = ownerIdOf(row)
  const directory = ownerDirectory(root, owner)
  let originalPath: string | null = null
  let stagedPath: string | null = null

  if (row.stored_name && row.rel_path) {
    originalPath = storedFilePath(root, row)
    if (fs.statSync(originalPath, { throwIfNoEntry: false })?.isFile()) {
      stagedPath = path.join(directory, `.${row.stored_name}.deleting-${randomBytes(4).toString('hex')}`)
      fs.renameSync(originalPath, stagedPath)
    }
  }

  try {
    db.transaction(() => deleteFile(db, fileId))()
  } catch (error) {
    if (originalPath && stagedPath && fs.existsSync(stagedPath)) fs.renameSync(stagedPath, originalPath)
    throw error
  }

  if (stagedPath) fs.rmSync(stagedPath, { force: true })
  tryRemoveEmptyDirectory(directory)
  return mapFile(row)
}
