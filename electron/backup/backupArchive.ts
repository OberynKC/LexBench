import Database from 'better-sqlite3'
import fs from 'node:fs'
import type { FileHandle } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import dayjs from 'dayjs'
import JSZip from 'jszip'
import { migrations, runMigrations } from '../db/migrations'
import { readSnapshot } from '../db/services/snapshotService'
import { attachmentsRootForDatabase } from '../files/attachmentStorage'
import { BACKUP_LIMITS, validateArchiveLimits, type ArchiveLimits } from './archiveLimits'

export const LATEST_SCHEMA_VERSION = Math.max(...migrations.map((migration) => migration.version))
export interface BackupAttachment { path: string; size: number; sha256: string }
export interface BackupWarning { path?: string; fileId?: string; reason: string }
export interface BackupManifest {
  formatVersion: 1
  appVersion: string
  schemaVersion: number
  backedUpAt: string
  tableCounts: Record<string, number>
  attachments: BackupAttachment[]
  warnings: BackupWarning[]
}
export interface PreparedRestore { directory: string; manifest: BackupManifest }

function tableCounts(db: Database.Database): Record<string, number> {
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all() as { name: string }[]
  return Object.fromEntries(tables.map(({ name }) => [name,
    (db.prepare(`SELECT COUNT(*) AS count FROM "${name.replace(/"/g, '""')}"`).get() as { count: number }).count,
  ]))
}

/** 相对路径必须可以原样用于 macOS / Windows，不能被 ZIP 解压器静默改写。 */
function safeRelativePath(value: string): boolean {
  return value.length > 0 && !/[\\:\u0000-\u001f]/.test(value) && value.split('/').every((part) =>
    part.length > 0 && part !== '.' && part !== '..' && !/[. ]$/.test(part) &&
    !/[<>"|?*]/.test(part) && !/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part))
}

function pathKey(value: string): string { return value.normalize('NFC').toLowerCase() }

async function copyAndHash(source: string, destination: string): Promise<Pick<BackupAttachment, 'size' | 'sha256'>> {
  const hash = createHash('sha256')
  let size = 0
  await fs.promises.mkdir(path.dirname(destination), { recursive: true })
  await pipeline(fs.createReadStream(source), new Transform({
    transform(chunk: Buffer, _encoding, callback) { size += chunk.length; hash.update(chunk); callback(null, chunk) },
  }), fs.createWriteStream(destination, { flags: 'wx' }))
  return { size, sha256: hash.digest('hex') }
}

async function collectAttachments(db: Database.Database, staging: string): Promise<Pick<BackupManifest, 'attachments' | 'warnings'>> {
  const root = attachmentsRootForDatabase(db)
  const attachments: BackupAttachment[] = []
  const warnings: BackupWarning[] = []
  const keys = new Set<string>()
  async function visit(relative: string): Promise<void> {
    const source = path.join(root, relative)
    let stat: fs.Stats
    try { stat = await fs.promises.lstat(source) } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
      if (relative) warnings.push({ path: relative, reason: '本地文件缺失，已跳过' })
      return
    }
    if (stat.isSymbolicLink()) {
      warnings.push({ ...(relative ? { path: relative } : {}), reason: '符号链接未包含在备份中' }); return
    }
    if (stat.isDirectory()) {
      for (const name of (await fs.promises.readdir(source)).sort()) await visit(relative ? `${relative}/${name}` : name)
      return
    }
    if (!stat.isFile()) { warnings.push({ path: relative, reason: '附件不是普通文件，已跳过' }); return }
    if (!safeRelativePath(relative) || keys.has(pathKey(relative))) throw new Error('附件路径存在跨平台冲突，请检查附件目录')
    keys.add(pathKey(relative))
    const destination = path.join(staging, 'attachments', ...relative.split('/'))
    try { attachments.push({ path: relative, ...await copyAndHash(source, destination) }) } catch (error) {
      await fs.promises.rm(destination, { force: true })
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
      warnings.push({ path: relative, reason: '本地文件缺失，已跳过' })
    }
  }
  await visit('')
  const available = new Set(attachments.map((attachment) => attachment.path))
  const rows = db.prepare('SELECT id, rel_path FROM file_meta').all() as { id: string; rel_path: string }[]
  for (const row of rows) {
    if (!row.rel_path || !available.has(row.rel_path)) {
      // 数据库中的异常路径不写进清单，避免产生无法通过自身预检的备份包。
      warnings.push({ fileId: row.id, ...(safeRelativePath(row.rel_path) ? { path: row.rel_path } : {}),
        reason: row.rel_path ? '附件记录对应的本地文件缺失，已跳过' : '旧版附件仅有元数据，未包含文件内容' })
    }
  }
  return { attachments, warnings }
}

async function writeZip(handle: FileHandle, staging: string, manifest: BackupManifest, limits: ArchiveLimits): Promise<void> {
  // 预检容量：数据库 + 附件原始大小 + 清单 JSON 估算。
  const dbSize = (await fs.promises.stat(path.join(staging, 'lexbench.db'))).size
  const attachmentsSize = manifest.attachments.reduce((sum, a) => sum + a.size, 0)
  const manifestSize = JSON.stringify(manifest).length
  const estimatedExpanded = dbSize + attachmentsSize + manifestSize
  if (estimatedExpanded > limits.expandedBytes) {
    throw new Error(`备份内容超过容量限制：预估 ${Math.ceil(estimatedExpanded / 1024 / 1024)} MiB，上限 ${Math.ceil(limits.expandedBytes / 1024 / 1024)} MiB`)
  }
  // archiver 8 是 ESM；CJS 主进程必须保留运行时动态 import。
  const { ZipArchive } = await import('archiver')
  await new Promise<void>((resolve, reject) => {
    // handle 以 wx 打开；输出流直接继承独占创建的描述符，并负责关闭它。
    const output = handle.createWriteStream()
    const archive = new ZipArchive({ zlib: { level: 9 } })
    let failure: Error | undefined
    const fail = (error: Error) => {
      if (failure) return
      failure = error; void archive.abort(); output.destroy()
    }
    output.on('error', fail)
    output.on('close', () => failure ? reject(failure) : resolve())
    archive.on('warning', fail)
    archive.on('error', fail)
    archive.pipe(output)
    archive.file(path.join(staging, 'lexbench.db'), { name: 'lexbench.db' })
    archive.append('', { name: 'attachments/' })
    for (const attachment of manifest.attachments) {
      archive.file(path.join(staging, 'attachments', ...attachment.path.split('/')), { name: `attachments/${attachment.path}` })
    }
    archive.append(JSON.stringify(manifest, null, 2), { name: 'manifest.json' })
    void archive.finalize().catch(fail)
  })
}

/** 调用者须持有 runExport 锁；数据库在线快照和附件都在临时目录固定后流式入包。 */
export async function createBackupArchive(
  db: Database.Database, parent: string, appVersion: string, prefix = '律衡备份', now = new Date(),
): Promise<{ file: string; manifest: BackupManifest }> {
  const staging = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'lexbench-backup-'))
  let ownedFile: string | undefined
  try {
    await db.backup(path.join(staging, 'lexbench.db'))
    const snapshot = new Database(path.join(staging, 'lexbench.db'), { readonly: true, fileMustExist: true })
    let manifest: BackupManifest
    try {
      manifest = { formatVersion: 1, appVersion, schemaVersion: snapshot.pragma('user_version', { simple: true }) as number,
        backedUpAt: now.toISOString(), tableCounts: tableCounts(snapshot), ...await collectAttachments(db, staging) }
    } finally { snapshot.close() }
    // 附件根目录来自原库，快照只用于数据库统计。
    const base = `${prefix}-${dayjs(now).format('YYYYMMDD-HHmm')}`
    for (let index = 1; index <= 1000; index++) {
      const file = path.join(parent, `${base}${index === 1 ? '' : `-${index}`}.zip`)
      // wx 原子占用名字，输出流沿用同一文件描述符，全程不释放占用。
      let handle: FileHandle
      try { handle = await fs.promises.open(file, 'wx') } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'EEXIST') continue
        throw error
      }
      ownedFile = file
      try {
        await writeZip(handle, staging, manifest, BACKUP_LIMITS)
      } finally {
        await handle.close()
      }
      // 写入完成后核验最终压缩包大小。
      const finalSize = (await fs.promises.stat(file)).size
      if (finalSize > BACKUP_LIMITS.compressedBytes) {
        throw new Error(`备份压缩包超过容量限制：实际 ${Math.ceil(finalSize / 1024 / 1024)} MiB，上限 ${Math.ceil(BACKUP_LIMITS.compressedBytes / 1024 / 1024)} MiB`)
      }
      return { file, manifest }
    }
    throw new Error('同一分钟内的同名备份过多，请稍后重试')
  } catch (error) {
    if (ownedFile) await fs.promises.rm(ownedFile, { force: true })
    throw error
  } finally { await fs.promises.rm(staging, { recursive: true, force: true }) }
}

function readManifest(value: unknown): BackupManifest {
  if (!value || typeof value !== 'object') throw new Error('备份清单格式无效')
  const manifest = value as BackupManifest
  if (manifest.formatVersion !== 1 || typeof manifest.appVersion !== 'string' || !manifest.appVersion ||
    !Number.isSafeInteger(manifest.schemaVersion) || manifest.schemaVersion < 1 ||
    typeof manifest.backedUpAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(manifest.backedUpAt) || !Number.isFinite(Date.parse(manifest.backedUpAt)) ||
    !manifest.tableCounts || typeof manifest.tableCounts !== 'object' || Array.isArray(manifest.tableCounts) ||
    !Array.isArray(manifest.attachments) || !Array.isArray(manifest.warnings)) throw new Error('备份清单缺少必要字段或格式无效')
  const keys = new Set<string>()
  for (const attachment of manifest.attachments) {
    if (!attachment || typeof attachment.path !== 'string' || !safeRelativePath(attachment.path) || keys.has(pathKey(attachment.path)) ||
      !Number.isSafeInteger(attachment.size) || attachment.size < 0 || typeof attachment.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(attachment.sha256)) {
      throw new Error('备份附件清单格式无效或路径重复')
    }
    keys.add(pathKey(attachment.path))
  }
  for (const warning of manifest.warnings) {
    if (!warning || typeof warning.reason !== 'string' || (warning.path !== undefined && (typeof warning.path !== 'string' || !safeRelativePath(warning.path)))) {
      throw new Error('备份警告清单格式无效')
    }
  }
  return manifest
}

async function hashFile(file: string): Promise<{ size: number; sha256: string }> {
  const hash = createHash('sha256'); let size = 0
  for await (const chunk of fs.createReadStream(file)) { size += chunk.length; hash.update(chunk) }
  return { size, sha256: hash.digest('hex') }
}

/** 预检全部在临时目录完成；任何拒绝路径都不修改当前数据库和附件。 */
export async function prepareRestore(zipPath: string, userData: string): Promise<PreparedRestore> {
  const directory = await fs.promises.mkdtemp(path.join(userData, '.lexbench-restore-'))
  try {
    // 先按文件大小截断超大压缩包，再做逐条目流式 CRC/容量校验；JSZip 载入全部解压内容之前完成拦截。
    const stat = await fs.promises.stat(zipPath).catch(() => { throw new Error('所选备份文件不存在') })
    if (stat.size > BACKUP_LIMITS.compressedBytes) throw new Error('备份压缩包超过容量限制')
    const archiveBytes = await fs.promises.readFile(zipPath)
    try { await validateArchiveLimits(archiveBytes, BACKUP_LIMITS) } catch (error) {
      throw error instanceof Error && /损坏|容量|过多|重复|不安全/.test(error.message) ? error : new Error('备份 ZIP 无法读取或已损坏')
    }
    let zip: JSZip
    try { zip = await JSZip.loadAsync(archiveBytes, { checkCRC32: true }) } catch {
      throw new Error('备份 ZIP 无法读取或已损坏')
    }
    const entries = Object.values(zip.files)
    const keys = new Set<string>()
    for (const entry of entries) {
      const original = (entry as JSZip.JSZipObject & { unsafeOriginalName?: string }).unsafeOriginalName
      const name = entry.dir ? entry.name.replace(/\/$/, '') : entry.name
      if ((original !== undefined && original !== entry.name) || !safeRelativePath(name) || keys.has(pathKey(name)) ||
        (entry.unixPermissions !== null && ((Number(entry.unixPermissions) & 0o170000) === 0o120000))) throw new Error('备份 ZIP 含有不安全或重复的路径')
      keys.add(pathKey(name))
    }
    const manifestEntry = zip.file('manifest.json'); const dbEntry = zip.file('lexbench.db')
    if (!manifestEntry || !dbEntry) throw new Error('备份缺少 manifest.json 或 lexbench.db')
    let manifestJson: unknown
    try { manifestJson = JSON.parse(await manifestEntry.async('string')) } catch {
      // JSON.parse 抛出英文 SyntaxError，不能直接拼进用户可见提示（CU-02）。
      throw new Error('备份清单无法读取：清单文件不是有效的 JSON')
    }
    let manifest: BackupManifest
    try { manifest = readManifest(manifestJson) } catch (error) {
      throw new Error(`备份清单无法读取：${error instanceof Error ? error.message : '格式无效'}`)
    }
    const allowedFiles = new Set(['manifest.json', 'lexbench.db', ...manifest.attachments.map((attachment) => `attachments/${attachment.path}`)])
    if (entries.some((entry) => !entry.dir && !allowedFiles.has(entry.name))) throw new Error('备份包含清单以外的文件')
    await fs.promises.mkdir(path.join(directory, 'attachments'))
    for (const name of allowedFiles) {
      const entry = zip.file(name)
      if (!entry) throw new Error('备份附件缺失，与清单不一致')
      const target = path.join(directory, ...name.split('/'))
      await fs.promises.mkdir(path.dirname(target), { recursive: true })
      await pipeline(entry.nodeStream(), fs.createWriteStream(target, { flags: 'wx' }))
    }
    for (const attachment of manifest.attachments) {
      const actual = await hashFile(path.join(directory, 'attachments', ...attachment.path.split('/')))
      if (actual.size !== attachment.size || actual.sha256 !== attachment.sha256) throw new Error('附件 SHA-256 或大小校验失败，备份可能已损坏')
    }
    let candidate: Database.Database | undefined
    try {
      candidate = new Database(path.join(directory, 'lexbench.db'), { fileMustExist: true })
      const version = candidate.pragma('user_version', { simple: true }) as number
      if (version > LATEST_SCHEMA_VERSION) throw new Error('备份数据库版本高于当前应用支持的版本，请使用较新版本的律衡恢复')
      if (version !== manifest.schemaVersion) throw new Error('备份数据库版本与清单不一致')
      if (candidate.pragma('integrity_check', { simple: true }) !== 'ok') throw new Error('备份数据库完整性校验失败')
      const actualCounts = tableCounts(candidate)
      if (Object.keys(actualCounts).length !== Object.keys(manifest.tableCounts).length ||
        Object.entries(actualCounts).some(([table, count]) => manifest.tableCounts[table] !== count)) {
        throw new Error('备份数据库记录数与清单不一致')
      }
      // 旧 schema 在隔离库试迁移；正式替换的是已确认可启动的数据库。
      candidate.pragma('foreign_keys = ON')
      runMigrations(candidate)
      if ((candidate.pragma('foreign_key_check') as unknown[]).length) throw new Error('备份数据库的关联关系校验失败')
      readSnapshot(candidate)
      // WAL 数据写回临时库，正式替换仅需主文件。
      candidate.pragma('wal_checkpoint(TRUNCATE)')
    } catch (error) {
      throw new Error(`备份数据库预检失败：${error instanceof Error ? error.message : '无法打开数据库'}`)
    } finally { candidate?.close() }
    return { directory, manifest }
  } catch (error) {
    await fs.promises.rm(directory, { recursive: true, force: true }); throw error
  }
}

export async function createRestorePoint(db: Database.Database, appVersion: string, now = new Date()): Promise<{ file: string; manifest: BackupManifest }> {
  const parent = path.join(path.dirname(db.name), 'backups')
  await fs.promises.mkdir(parent, { recursive: true })
  const result = await createBackupArchive(db, parent, appVersion, '恢复点', now)
  const files = await Promise.all((await fs.promises.readdir(parent)).filter((name) => /^恢复点-\d{8}-\d{4}(?:-\d+)?\.zip$/.test(name)).map(async (name) => {
    const stat = await fs.promises.lstat(path.join(parent, name)); return { name, stat }
  }))
  files.sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs || b.stat.birthtimeMs - a.stat.birthtimeMs || b.name.localeCompare(a.name, 'zh-CN', { numeric: true }))
  for (const file of files.filter((file) => file.stat.isFile()).slice(3)) await fs.promises.unlink(path.join(parent, file.name))
  return result
}
