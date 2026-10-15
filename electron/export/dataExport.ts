import type Database from 'better-sqlite3'
import dayjs from 'dayjs'
import ExcelJS from 'exceljs'
import fs from 'node:fs'
import path from 'node:path'
import type { AppState } from '../../src/types/api'
import type { FeeRecord } from '../../src/types'
import { getTemplate, stageLabel } from '../../src/lib/stageTemplates'
import { listFileRows } from '../db/repos/filesRepo'
import type { FileRow } from '../db/mappers'
import { readSnapshot } from '../db/services/snapshotService'
import { attachmentsRootForDatabase, storedFilePath } from '../files/attachmentStorage'

interface ExportColumn<T> {
  header: string
  width: number
  value: (item: T) => ExcelJS.CellValue
  numFmt?: string
}

interface ZipEntry {
  sourcePath: string
  archivePath: string
}

export interface ExportArtifactsResult {
  zipCreated: boolean
  exportedAttachmentCount: number
  skippedAttachmentCount: number
}

const DATE_FORMAT = 'yyyy-mm-dd'
const TIMESTAMP_FORMAT = 'yyyy-mm-dd hh:mm'
const MONEY_FORMAT = '#,##0.00'

function dateCell(value: string | null | undefined): ExcelJS.CellValue {
  if (!value) return ''
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return value
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
}

/** 将 ISO 时间按本机时区转为 Excel 无时区日期值，显示口径与渲染进程一致。 */
function timestampCell(value: string | null | undefined): ExcelJS.CellValue {
  if (!value) return ''
  const parsed = dayjs(value)
  if (!parsed.isValid()) return value
  return new Date(Date.UTC(
    parsed.year(),
    parsed.month(),
    parsed.date(),
    parsed.hour(),
    parsed.minute(),
    parsed.second(),
  ))
}

function addSheet<T>(
  workbook: ExcelJS.Workbook,
  name: string,
  values: readonly T[],
  columns: readonly ExportColumn<T>[],
): void {
  const worksheet = workbook.addWorksheet(name, {
    views: [{ state: 'frozen', ySplit: 1, activeCell: 'A2', showGridLines: false }],
    properties: { defaultRowHeight: 20 },
    pageSetup: { fitToPage: true, fitToWidth: 1, fitToHeight: 0, orientation: 'landscape' },
  })

  worksheet.columns = columns.map((column, index) => ({
    header: column.header,
    key: `column_${index}`,
    width: column.width,
    ...(column.numFmt ? { style: { numFmt: column.numFmt } } : {}),
  }))

  for (const value of values) {
    const row = worksheet.addRow(columns.map((column) => column.value(value)))
    row.eachCell((cell) => {
      cell.alignment = { vertical: 'top', wrapText: true }
      cell.border = { bottom: { style: 'hair', color: { argb: 'FFE5E7EB' } } }
    })
  }

  const header = worksheet.getRow(1)
  header.height = 25
  header.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF172554' } }
  header.alignment = { vertical: 'middle', horizontal: 'center' }
  header.border = { bottom: { style: 'medium', color: { argb: 'FF172554' } } }
  worksheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: columns.length },
  }
}

function localToday(): string {
  return dayjs().format('YYYY-MM-DD')
}

function feeStatus(fee: Pick<FeeRecord, 'amount' | 'receivedAmount' | 'dueDate'>): string {
  if (fee.receivedAmount >= fee.amount) return '已收'
  if (fee.dueDate < localToday()) return '逾期'
  return fee.receivedAmount > 0 ? '部分收' : '未收'
}

function buildWorkbook(state: AppState, fileRows: readonly FileRow[]): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = '律衡'
  workbook.lastModifiedBy = '律衡'
  workbook.created = new Date()
  workbook.modified = new Date()

  const clients = new Map(state.clients.map((client) => [client.id, client]))
  const cases = new Map(state.cases.map((caseItem) => [caseItem.id, caseItem]))
  const contracts = new Map(state.contracts.map((contract) => [contract.id, contract]))
  const invoices = new Map(state.invoices.map((invoice) => [invoice.id, invoice]))
  const todos = new Map(state.todos.map((todo) => [todo.id, todo]))

  const clientName = (clientId: string): string => clients.get(clientId)?.name ?? `未找到客户（${clientId}）`
  const caseName = (caseId: string | null): string => {
    if (caseId === null) return ''
    const caseItem = cases.get(caseId)
    if (!caseItem) return `未找到案件（${caseId}）`
    return caseItem.caseNumber ? `${caseItem.caseNumber}｜${caseItem.title}` : caseItem.title
  }
  const contractName = (contractId: string): string => {
    const contract = contracts.get(contractId)
    if (!contract) return `未找到合同（${contractId}）`
    return `${contract.contractNo}｜${clientName(contract.clientId)}`
  }

  addSheet(workbook, '案件', state.cases, [
    { header: '案件 ID', width: 28, value: (item) => item.id },
    { header: '案号', width: 24, value: (item) => item.caseNumber ?? '' },
    { header: '案件名称', width: 34, value: (item) => item.title },
    { header: '案件类型', width: 12, value: (item) => item.type },
    { header: '程序模板', width: 20, value: (item) => getTemplate(item.templateId)?.name ?? item.templateId },
    { header: '当前阶段', width: 18, value: (item) => stageLabel(item.templateId, item.stageId) },
    { header: '代理立场', width: 16, value: (item) => item.side },
    { header: '关联案件（案号｜名称）', width: 42, value: (item) => item.relatedCaseIds.map(caseName).join('；') },
    { header: '客户名称', width: 24, value: (item) => clientName(item.clientId) },
    { header: '对方当事人', width: 24, value: (item) => item.opposingParty },
    { header: '受理法院 / 仲裁委', width: 28, value: (item) => item.court },
    { header: '承办法官', width: 16, value: (item) => item.judge },
    { header: '法官联系方式', width: 20, value: (item) => item.judgePhone },
    { header: '标的金额（元）', width: 18, value: (item) => item.amount, numFmt: MONEY_FORMAT },
    { header: '收案日期', width: 14, value: (item) => dateCell(item.acceptedAt), numFmt: DATE_FORMAT },
    { header: '下次关键节点日期', width: 18, value: (item) => dateCell(item.nextDeadline), numFmt: DATE_FORMAT },
    { header: '备注', width: 48, value: (item) => item.note },
    { header: '附件数', width: 10, value: (item) => item.files.length, numFmt: '#,##0' },
  ])

  addSheet(workbook, '客户', state.clients, [
    { header: '客户 ID', width: 28, value: (item) => item.id },
    { header: '客户名称', width: 28, value: (item) => item.name },
    { header: '客户类型', width: 12, value: (item) => item.type },
    { header: '电话', width: 20, value: (item) => item.phone },
    { header: '邮箱', width: 28, value: (item) => item.email },
    { header: '地址', width: 36, value: (item) => item.address },
    { header: '备注', width: 48, value: (item) => item.note },
  ])

  addSheet(workbook, '合同', state.contracts, [
    { header: '合同 ID', width: 28, value: (item) => item.id },
    { header: '合同编号', width: 28, value: (item) => item.contractNo },
    { header: '客户名称', width: 24, value: (item) => clientName(item.clientId) },
    { header: '关联案件（案号｜名称）', width: 48, value: (item) => item.caseIds.map(caseName).join('；') },
    { header: '签约日期', width: 14, value: (item) => dateCell(item.signedAt), numFmt: DATE_FORMAT },
    { header: '收费方式', width: 16, value: (item) => item.feeMode },
    { header: '约定律师费总额（元）', width: 22, value: (item) => item.totalFee, numFmt: MONEY_FORMAT },
    { header: '合同状态', width: 12, value: (item) => item.status },
    { header: '附件数', width: 10, value: (item) => item.files.length, numFmt: '#,##0' },
    { header: '备注', width: 48, value: (item) => item.note },
  ])

  addSheet(workbook, '收费期次', state.fees, [
    { header: '收费期次 ID', width: 28, value: (item) => item.id },
    { header: '合同（编号｜客户）', width: 38, value: (item) => contractName(item.contractId) },
    { header: '期次', width: 20, value: (item) => item.label },
    { header: '应收金额（元）', width: 18, value: (item) => item.amount, numFmt: MONEY_FORMAT },
    { header: '应收日期', width: 14, value: (item) => dateCell(item.dueDate), numFmt: DATE_FORMAT },
    { header: '实收金额（元）', width: 18, value: (item) => item.receivedAmount, numFmt: MONEY_FORMAT },
    { header: '最近收款日期', width: 16, value: (item) => dateCell(item.receivedAt), numFmt: DATE_FORMAT },
    { header: '收款状态', width: 12, value: (item) => feeStatus(item) },
    { header: '备注', width: 48, value: (item) => item.note },
  ])

  addSheet(workbook, '发票', state.invoices, [
    { header: '发票 ID', width: 28, value: (item) => item.id },
    { header: '合同（编号｜客户）', width: 38, value: (item) => contractName(item.contractId) },
    { header: '发票号码', width: 24, value: (item) => item.invoiceNo },
    { header: '发票种类', width: 22, value: (item) => item.kind },
    { header: '开票金额（元）', width: 18, value: (item) => item.amount, numFmt: MONEY_FORMAT },
    { header: '开票日期', width: 14, value: (item) => dateCell(item.issuedAt), numFmt: DATE_FORMAT },
    { header: '附件数', width: 10, value: (item) => item.files.length, numFmt: '#,##0' },
    { header: '备注', width: 48, value: (item) => item.note },
  ])

  addSheet(workbook, '待办', state.todos, [
    { header: '待办 ID', width: 28, value: (item) => item.id },
    { header: '待办标题', width: 40, value: (item) => item.title },
    { header: '关联案件（案号｜名称）', width: 42, value: (item) => caseName(item.caseId) },
    { header: '完成状态', width: 12, value: (item) => item.done ? '已完成' : '未完成' },
    { header: '期限', width: 14, value: (item) => dateCell(item.deadline), numFmt: DATE_FORMAT },
    { header: '创建时间', width: 19, value: (item) => timestampCell(item.createdAt), numFmt: TIMESTAMP_FORMAT },
  ])

  addSheet(workbook, '日程', state.events, [
    { header: '日程 ID', width: 28, value: (item) => item.id },
    { header: '日程标题', width: 38, value: (item) => item.title },
    { header: '日程类型', width: 14, value: (item) => item.type },
    { header: '关联案件（案号｜名称）', width: 42, value: (item) => caseName(item.caseId) },
    { header: '开始时间', width: 19, value: (item) => timestampCell(item.start), numFmt: TIMESTAMP_FORMAT },
    { header: '结束时间', width: 19, value: (item) => timestampCell(item.end), numFmt: TIMESTAMP_FORMAT },
    { header: '地点', width: 28, value: (item) => item.location },
    { header: '提醒说明', width: 24, value: (item) => item.reminder },
    { header: '关联待办', width: 38, value: (item) => item.todoId ? (todos.get(item.todoId)?.title ?? `未找到待办（${item.todoId}）`) : '' },
  ])

  addSheet(workbook, '保全执行', state.preservations, [
    { header: '保全执行 ID', width: 28, value: (item) => item.id },
    { header: '关联案件（案号｜名称）', width: 42, value: (item) => caseName(item.caseId) },
    { header: '措施类型', width: 16, value: (item) => item.type },
    { header: '到期日', width: 14, value: (item) => dateCell(item.deadline), numFmt: DATE_FORMAT },
    { header: '状态', width: 12, value: (item) => item.status },
    { header: '备注', width: 48, value: (item) => item.note },
  ])

  addSheet(workbook, '办案笔记', state.notes, [
    { header: '笔记 ID', width: 28, value: (item) => item.id },
    { header: '关联案件（案号｜名称）', width: 42, value: (item) => caseName(item.caseId) },
    { header: '标题', width: 34, value: (item) => item.title },
    { header: 'Markdown 正文', width: 72, value: (item) => item.content },
    { header: '标签', width: 28, value: (item) => item.tags.join('、') },
    { header: '创建时间', width: 19, value: (item) => timestampCell(item.createdAt), numFmt: TIMESTAMP_FORMAT },
    { header: '更新时间', width: 19, value: (item) => timestampCell(item.updatedAt), numFmt: TIMESTAMP_FORMAT },
  ])

  const attachmentOwner = (row: FileRow): { type: string; name: string } => {
    if (row.case_id !== null && row.contract_id === null && row.invoice_id === null) {
      return { type: '案件', name: caseName(row.case_id) }
    }
    if (row.contract_id !== null && row.case_id === null && row.invoice_id === null) {
      return { type: '合同', name: contractName(row.contract_id) }
    }
    if (row.invoice_id !== null && row.case_id === null && row.contract_id === null) {
      const invoice = invoices.get(row.invoice_id)
      if (!invoice) return { type: '发票', name: `未找到发票（${row.invoice_id}）` }
      return { type: '发票', name: `${invoice.invoiceNo}｜${contractName(invoice.contractId)}` }
    }
    return { type: '归属异常', name: '' }
  }

  addSheet(workbook, '附件清单', fileRows, [
    { header: '附件 ID', width: 28, value: (item) => item.id },
    { header: '归属类型', width: 12, value: (item) => attachmentOwner(item).type },
    { header: '归属名称', width: 48, value: (item) => attachmentOwner(item).name },
    { header: '文件名', width: 36, value: (item) => item.name },
    { header: '存储文件名', width: 40, value: (item) => item.stored_name },
    { header: '大小（字节）', width: 16, value: (item) => item.size, numFmt: '#,##0' },
    { header: '上传时间', width: 19, value: (item) => timestampCell(item.uploaded_at), numFmt: TIMESTAMP_FORMAT },
    { header: '相对路径', width: 54, value: (item) => item.rel_path },
  ])

  return workbook
}

function truncateUtf8(value: string, maxBytes: number): string {
  let result = ''
  for (const char of value) {
    if (Buffer.byteLength(result + char, 'utf8') > maxBytes) break
    result += char
  }
  return result
}

function safeArchiveSegment(value: string, fallback: string): string {
  const sanitized = value
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')
    .replace(/[. ]+$/g, '')
    .trim()
  const result = truncateUtf8(sanitized || fallback, 180)
  return result === '.' || result === '..' ? fallback : result
}

function reserveName(preferred: string, usedNames: Set<string>, preserveExtension: boolean): string {
  const parsed = preserveExtension ? path.parse(preferred) : { name: preferred, ext: '' }
  const stem = parsed.name || '附件'
  for (let index = 1; index <= 10_000; index += 1) {
    const suffix = index === 1 ? '' : ` (${index})`
    const candidate = `${stem}${suffix}${parsed.ext}`
    const key = candidate.toLocaleLowerCase('zh-CN')
    if (!usedNames.has(key)) {
      usedNames.add(key)
      return candidate
    }
  }
  throw new Error('导出附件重名过多，无法生成安全文件名')
}

async function collectZipEntries(
  db: Database.Database,
  state: AppState,
  fileRows: readonly FileRow[],
): Promise<{ entries: ZipEntry[]; skipped: number }> {
  const root = attachmentsRootForDatabase(db)
  const cases = new Map(state.cases.map((caseItem) => [caseItem.id, caseItem]))
  const contracts = new Map(state.contracts.map((contract) => [contract.id, contract]))
  const invoices = new Map(state.invoices.map((invoice) => [invoice.id, invoice]))
  const topLevelNames = new Set<string>(['合同发票'])
  const contractFolderNames = new Set<string>()
  const caseFolders = new Map<string, string>()
  const contractFolders = new Map<string, string>()
  const fileNamesByDirectory = new Map<string, Set<string>>()
  const entries: ZipEntry[] = []
  let skipped = 0

  const caseFolder = (caseId: string): string => {
    const existing = caseFolders.get(caseId)
    if (existing) return existing
    const preferred = safeArchiveSegment(cases.get(caseId)?.title ?? `未找到案件-${caseId}`, '未命名案件')
    const reserved = reserveName(preferred, topLevelNames, false)
    caseFolders.set(caseId, reserved)
    return reserved
  }

  const contractFolder = (contractId: string): string => {
    const existing = contractFolders.get(contractId)
    if (existing) return existing
    const preferred = safeArchiveSegment(
      contracts.get(contractId)?.contractNo ?? `未找到合同-${contractId}`,
      '未编号合同',
    )
    const reserved = reserveName(preferred, contractFolderNames, false)
    contractFolders.set(contractId, reserved)
    return reserved
  }

  for (const row of fileRows) {
    let archiveDirectory: string | null = null
    if (row.case_id !== null && row.contract_id === null && row.invoice_id === null) {
      archiveDirectory = caseFolder(row.case_id)
    } else if (row.contract_id !== null && row.case_id === null && row.invoice_id === null) {
      archiveDirectory = path.posix.join('合同发票', contractFolder(row.contract_id))
    } else if (row.invoice_id !== null && row.case_id === null && row.contract_id === null) {
      const invoice = invoices.get(row.invoice_id)
      if (invoice) archiveDirectory = path.posix.join('合同发票', contractFolder(invoice.contractId), '发票')
    }

    if (!archiveDirectory || !row.stored_name || !row.rel_path) {
      skipped += 1
      continue
    }

    let sourcePath: string
    try {
      sourcePath = storedFilePath(root, row)
      const stat = await fs.promises.stat(sourcePath)
      if (!stat.isFile()) throw new Error('附件不是普通文件')
    } catch {
      skipped += 1
      continue
    }

    let usedNames = fileNamesByDirectory.get(archiveDirectory)
    if (!usedNames) {
      usedNames = new Set<string>()
      fileNamesByDirectory.set(archiveDirectory, usedNames)
    }
    const preferredName = safeArchiveSegment(row.name, '附件')
    const fileName = reserveName(preferredName, usedNames, true)
    entries.push({ sourcePath, archivePath: path.posix.join(archiveDirectory, fileName) })
  }

  return { entries, skipped }
}

async function writeAttachmentZip(zipPath: string, entries: readonly ZipEntry[]): Promise<void> {
  // archiver 8 为纯 ESM；主进程仍是 CJS 且将其 external，必须保留运行时动态 import。
  const { ZipArchive } = await import('archiver')
  await new Promise<void>((resolve, reject) => {
    const output = fs.createWriteStream(zipPath, { flags: 'wx' })
    const archive = new ZipArchive({ zlib: { level: 9 } })
    let settled = false
    let failure: Error | undefined

    const fail = (error: Error): void => {
      if (settled) return
      if (failure) return
      failure = error
      void archive.abort()
      output.destroy()
    }

    output.on('close', () => {
      if (settled) return
      settled = true
      if (failure) reject(failure)
      else resolve()
    })
    output.on('error', fail)
    archive.on('warning', fail)
    archive.on('error', fail)
    archive.pipe(output)

    for (const entry of entries) {
      archive.file(entry.sourcePath, { name: entry.archivePath })
    }
    void archive.finalize().catch(fail)
  })
}

/** 只读读取数据库与附件，向已经创建好的目标目录写入 Excel 和可选 ZIP。 */
export async function writeExportArtifacts(
  db: Database.Database,
  exportDirectory: string,
): Promise<ExportArtifactsResult> {
  const { state, fileRows } = db.transaction(() => ({ state: readSnapshot(db), fileRows: listFileRows(db) }))()
  const workbook = buildWorkbook(state, fileRows)
  const { entries, skipped } = await collectZipEntries(db, state, fileRows)

  await workbook.xlsx.writeFile(path.join(exportDirectory, '律衡数据.xlsx'))
  if (entries.length > 0) {
    await writeAttachmentZip(path.join(exportDirectory, '附件.zip'), entries)
  }

  return {
    zipCreated: entries.length > 0,
    exportedAttachmentCount: entries.length,
    skippedAttachmentCount: skipped,
  }
}
