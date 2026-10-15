/** 正式导出回归：仅在系统临时目录创建虚构数据，绝不读取用户数据库。 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import ExcelJS from 'exceljs'
import JSZip from 'jszip'
import { seedDemoData } from '../electron/db/services/seedService'
import { readSnapshot } from '../electron/db/services/snapshotService'
import { listFileRows } from '../electron/db/repos/filesRepo'
import { attachmentsRootForDatabase, copyFilesToOwner } from '../electron/files/attachmentStorage'
import { writeExportArtifacts } from '../electron/export/dataExport'
import { createUniqueExportDirectory, exportToDirectory, validateExportParent } from '../electron/export/exportDirectory'
import { check, equal, rejects, report, testDatabase } from './testSupport'

function fileHashes(directory: string): Record<string, string> {
  const result: Record<string, string> = {}
  const visit = (current: string) => {
    if (!fs.existsSync(current)) return
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const file = path.join(current, entry.name)
      if (entry.isDirectory()) visit(file)
      else result[path.relative(directory, file)] = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
    }
  }
  visit(directory)
  return result
}

async function main() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lexbench-export-smoke-'))
  const db = testDatabase(path.join(tmp, 'fixture.db'))
  const blank = testDatabase(path.join(tmp, 'blank.db'))
  let passed = false
  try {
    seedDemoData(db)
    const out = path.join(tmp, 'outputs')
    fs.mkdirSync(out)
    const sourceA = path.join(tmp, 'source-a'); const sourceB = path.join(tmp, 'source-b')
    fs.mkdirSync(sourceA); fs.mkdirSync(sourceB)
    const name = '证据材料.pdf'
    fs.writeFileSync(path.join(sourceA, name), '虚构附件 A')
    fs.writeFileSync(path.join(sourceB, name), '虚构附件 B')
    const contractFiles = copyFilesToOwner(db, { type: 'contract', id: 'ct1' }, [path.join(sourceA, name), path.join(sourceB, name)])
    copyFilesToOwner(db, { type: 'invoice', id: 'inv1' }, [path.join(sourceA, name)])
    copyFilesToOwner(db, { type: 'case', id: 'case1' }, [path.join(sourceA, name)])
    copyFilesToOwner(db, { type: 'case', id: 'case3' }, [path.join(sourceB, name)])
    copyFilesToOwner(db, { type: 'contract', id: 'ct2' }, [path.join(sourceB, name)])
    db.prepare('UPDATE cases SET title = ? WHERE id IN (?, ?)').run('同名/案件', 'case1', 'case3')
    db.prepare('UPDATE contracts SET contract_no = ? WHERE id IN (?, ?)').run('同名/编号', 'ct1', 'ct2')
    // 增加一个有效元数据但源文件丢失的附件，与旧版元数据混合。
    const missing = copyFilesToOwner(db, { type: 'case', id: 'case1' }, [path.join(sourceB, name)])[0]
    fs.unlinkSync(path.join(attachmentsRootForDatabase(db), missing.relPath))
    const stateBefore = readSnapshot(db)
    const rowsBefore = listFileRows(db)
    const metaBefore = db.prepare('SELECT * FROM app_meta ORDER BY key').all()
    const hashesBefore = fileHashes(attachmentsRootForDatabase(db))
    const protectedRoots = [attachmentsRootForDatabase(db)]
    const exported = await exportToDirectory(out, protectedRoots, (directory) => writeExportArtifacts(db, directory))
    equal(exported.result.exportedAttachmentCount, 6, '混合附件仅导出六个可读文件')
    equal(exported.result.skippedAttachmentCount, rowsBefore.length - 6, '旧版和缺失附件跳过数量准确')
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.readFile(path.join(exported.directory, '律衡数据.xlsx'))
    equal(workbook.worksheets.map((sheet) => sheet.name), ['案件', '客户', '合同', '收费期次', '发票', '待办', '日程', '保全执行', '办案笔记', '附件清单'], '十张工作表齐全且顺序正确')
    const counts = [stateBefore.cases.length, stateBefore.clients.length, stateBefore.contracts.length, stateBefore.fees.length, stateBefore.invoices.length, stateBefore.todos.length, stateBefore.events.length, stateBefore.preservations.length, stateBefore.notes.length, rowsBefore.length]
    workbook.worksheets.forEach((sheet, index) => equal(sheet.rowCount - 1, counts[index], `${sheet.name}记录数正确`))
    // 流式读取走 unzipper。构造元信息优先的 ZIP 测试副本，符合 ExcelJS
    // WorkbookReader 的条目顺序要求；保留正式导出文件原样。
    const exportedZip = await JSZip.loadAsync(fs.readFileSync(path.join(exported.directory, '律衡数据.xlsx')))
    const orderedZip = new JSZip()
    const priority = ['xl/workbook.xml', 'xl/_rels/workbook.xml.rels', 'xl/sharedStrings.xml', 'xl/styles.xml']
    const entryNames = Object.keys(exportedZip.files).filter((name) => !exportedZip.files[name].dir)
      .sort((a, b) => (priority.includes(a) ? priority.indexOf(a) : priority.length) - (priority.includes(b) ? priority.indexOf(b) : priority.length))
    for (const name of entryNames) orderedZip.file(name, await exportedZip.file(name)!.async('nodebuffer'))
    const streamFixture = path.join(tmp, '流式读取测试.xlsx')
    fs.writeFileSync(streamFixture, await orderedZip.generateAsync({ type: 'nodebuffer' }))
    const streamed: { name: string; rows: number }[] = []
    // 由测试持有读取流并在结束后等待关闭；Windows 上未关闭的句柄会使临时目录无法删除。
    const fixtureStream = fs.createReadStream(streamFixture)
    const reader = new ExcelJS.stream.xlsx.WorkbookReader(fixtureStream, {
      worksheets: 'emit', sharedStrings: 'cache', styles: 'cache', hyperlinks: 'ignore',
    })
    for await (const sheet of reader) {
      let rows = 0
      for await (const _row of sheet) rows++
      // ExcelJS 的 WorksheetReader 类型声明尚未列出运行时 name 属性。
      streamed.push({ name: (sheet as typeof sheet & { name: string }).name, rows })
    }
    if (!fixtureStream.closed) await new Promise<void>((resolve) => fixtureStream.once('close', () => resolve()).destroy())
    equal(streamed, workbook.worksheets.map((sheet) => ({ name: sheet.name, rows: sheet.rowCount })), '流式读取十表的名称与记录数一致')
    const cell = (sheetName: string, id: string, header: string) => {
      const sheet = workbook.getWorksheet(sheetName)!
      const row = sheet.getRows(2, sheet.rowCount - 1)!.find((r) => r.getCell(1).value === id)!
      const column = (sheet.getRow(1).values as ExcelJS.CellValue[]).findIndex((value) => value === header)
      return row.getCell(column)
    }
    equal(cell('合同', 'ct1', '约定律师费总额（元）').value, stateBefore.contracts.find((c) => c.id === 'ct1')!.totalFee, '金额按元导出')
    equal(cell('合同', 'ct1', '约定律师费总额（元）').numFmt, '#,##0.00', '金额保留两位小数')
    check(cell('合同', 'ct1', '签约日期').value instanceof Date, '日期为 Excel 可排序日期值')
    equal(cell('合同', 'ct1', '签约日期').numFmt, 'yyyy-mm-dd', '日期格式正确')
    equal((cell('合同', 'ct1', '签约日期').value as Date).toISOString().slice(0, 10), stateBefore.contracts.find((c) => c.id === 'ct1')!.signedAt, '日期值没有时区偏移')
    check(cell('待办', stateBefore.todos[0].id, '创建时间').value instanceof Date, '时间为 Excel 可排序日期值')
    equal(cell('待办', stateBefore.todos[0].id, '创建时间').numFmt, 'yyyy-mm-dd hh:mm', '时间格式正确')
    equal(cell('案件', 'case1', '客户名称').value, stateBefore.clients.find((c) => c.id === stateBefore.cases.find((c) => c.id === 'case1')!.clientId)!.name, '关联字段显示客户名称')
    check(String(cell('合同', 'ct1', '关联案件（案号｜名称）').value).includes('同名/案件'), '关联案件显示业务名称')
    check(String(cell('收费期次', stateBefore.fees.find((f) => f.contractId === 'ct1')!.id, '合同（编号｜客户）').value).includes('同名/编号｜'), '关联合同显示编号和客户')
    const zip = await JSZip.loadAsync(fs.readFileSync(path.join(exported.directory, '附件.zip')), { checkCRC32: true })
    const entries = Object.keys(zip.files).filter((key) => !zip.files[key].dir)
    equal(entries.length, 6, 'ZIP 完整关闭后可读取全部条目并通过 CRC 校验')
    check(entries.includes('合同发票/同名_编号/证据材料.pdf'), '合同使用编号目录且替换路径字符')
    check(entries.includes('合同发票/同名_编号/证据材料 (2).pdf'), '同名文件追加序号')
    check(entries.includes('合同发票/同名_编号/发票/证据材料.pdf'), '发票位于合同的发票子目录')
    check(entries.includes('合同发票/同名_编号 (2)/证据材料.pdf'), '同名合同目录不覆盖')
    check(entries.includes('同名_案件/证据材料.pdf') && entries.includes('同名_案件 (2)/证据材料.pdf'), '同名案件目录不覆盖')
    equal(await zip.file('合同发票/同名_编号/证据材料.pdf')!.async('string'), '虚构附件 A', 'ZIP 附件内容 A 完整')
    equal(await zip.file('合同发票/同名_编号/证据材料 (2).pdf')!.async('string'), '虚构附件 B', 'ZIP 附件内容 B 完整')
    equal(readSnapshot(db), stateBefore, '导出不改变业务快照')
    equal(listFileRows(db), rowsBefore, '导出不改变附件元数据')
    equal(db.prepare('SELECT * FROM app_meta ORDER BY key').all(), metaBefore, '导出不改变设置')
    equal(fileHashes(attachmentsRootForDatabase(db)), hashesBefore, '附件源文件内容不变')

    for (const mode of ['空库', '仅旧版元数据', '真实文件全部缺失']) {
      if (mode === '仅旧版元数据') seedDemoData(blank)
      if (mode === '真实文件全部缺失') {
        const file = copyFilesToOwner(blank, { type: 'contract', id: 'ct1' }, [path.join(sourceA, name)])[0]
        fs.unlinkSync(path.join(attachmentsRootForDatabase(blank), file.relPath))
      }
      const result = await exportToDirectory(out, [], (directory) => writeExportArtifacts(blank, directory))
      check(fs.existsSync(path.join(result.directory, '律衡数据.xlsx')), `${mode}仍生成 Excel`)
      check(!result.result.zipCreated && !fs.existsSync(path.join(result.directory, '附件.zip')), `${mode}不生成 ZIP`)
    }
    const now = new Date('2026-09-06T01:00:00Z')
    const first = await createUniqueExportDirectory(out, now)
    fs.writeFileSync(path.join(first, '保留.txt'), '原有数据')
    const second = await createUniqueExportDirectory(out, now)
    equal(second, `${first}-2`, '同分钟重名目录追加序号')
    equal(fs.readFileSync(path.join(first, '保留.txt'), 'utf8'), '原有数据', '重名导出不覆盖既有内容')
    const beforeFailure = fs.readdirSync(out).sort()
    await rejects(() => exportToDirectory(out, [], async (directory) => {
      fs.writeFileSync(path.join(directory, 'partial'), '未完成产物')
      throw new Error('模拟写入失败')
    }), /模拟写入失败/, '导出失败向调用方报告错误')
    equal(fs.readdirSync(out).sort(), beforeFailure, '失败仅清理本次目录')
    await rejects(() => exportToDirectory(out, [], async (directory) => {
      fs.writeFileSync(path.join(directory, '附件.zip'), '模拟 ZIP 输出路径已存在')
      return writeExportArtifacts(db, directory)
    }), /EEXIST/, 'ZIP 输出流实际失败时能结束并报告错误')
    equal(fs.readdirSync(out).sort(), beforeFailure, 'ZIP 流失败关闭后清理本次产物')

    const protectedRoot = path.join(tmp, 'protected'); fs.mkdirSync(protectedRoot)
    const link = path.join(tmp, 'alias')
    // Windows junction 不要求启用开发者模式或管理员权限。
    fs.symlinkSync(protectedRoot, link, process.platform === 'win32' ? 'junction' : 'dir')
    for (const candidate of [protectedRoot, path.join(protectedRoot, 'sub'), link, path.join(link, 'missing', 'nested')]) {
      await rejects(() => validateExportParent(candidate, [protectedRoot]), /不能位于/, '拒绝受限目录及符号链接子目录')
    }
    await validateExportParent(`${protectedRoot}-neighbor`, [protectedRoot]); check(true, '允许名称相近的相邻目录')
    await validateExportParent(out, [protectedRoot]); check(true, '允许普通用户目录')
    await rejects(() => exportToDirectory(protectedRoot, [protectedRoot], async () => undefined), /不能位于/, '路径拒绝发生在创建目录之前')
    equal(fs.readdirSync(protectedRoot), [], '受限目录没有生成任何产物')
    check(contractFiles.every((file) => file.relPath), '测试附件均来自真实存储入口')
    // 先单独移除目录链接本身（不触及目标目录），避免递归清理在 Windows junction 上失败。
    // Windows 的 junction 按目录删除；其他平台的符号链接按文件删除。
    if (process.platform === 'win32') fs.rmdirSync(link)
    else fs.unlinkSync(link)
    check(fs.existsSync(protectedRoot), '移除目录链接不影响目标目录')
    passed = true
    report()
  } finally {
    db.close(); blank.close()
    if (passed) fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
    else console.error(`失败现场保留：${tmp}`)
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1 })
