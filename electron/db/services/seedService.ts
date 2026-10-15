import type Database from 'better-sqlite3'
import * as mock from '../../../src/mock/data'
import { createCase as createCaseRow, createCaseRelation } from '../repos/casesRepo'
import { createClient } from '../repos/clientsRepo'
import { createContract as createContractRow, createContractCase } from '../repos/contractsRepo'
import { createEvent } from '../repos/eventsRepo'
import { createFee } from '../repos/feesRepo'
import { createContractFile, createInvoiceFile } from '../repos/filesRepo'
import { createInvoice as createInvoiceRow } from '../repos/invoicesRepo'
import { createNote } from '../repos/notesRepo'
import { createPreservation } from '../repos/preservationsRepo'
import { createTodo as createTodoRow } from '../repos/todosRepo'

export function seedDemoData(db: Database.Database): void {
  // 顶层实体按反向插入，配合 rowid DESC 读取恢复 Mock 数组原顺序。
  [...mock.clients].reverse().forEach((value) => createClient(db, value))
  ;[...mock.cases].reverse().forEach((value) => createCaseRow(db, value))
  mock.cases.forEach((value) => {
    value.relatedCaseIds.forEach((relatedId, index) => createCaseRelation(db, value.id, relatedId, index))
  })

  ;[...mock.contracts].reverse().forEach((value) => {
    createContractRow(db, value)
    value.caseIds.forEach((caseId, index) => createContractCase(db, value.id, caseId, index))
    value.files.forEach((file, index) => createContractFile(db, value.id, file, index))
  })

  ;[...mock.fees].reverse().forEach((value) => createFee(db, value))
  ;[...mock.invoices].reverse().forEach((value) => {
    createInvoiceRow(db, value)
    value.files.forEach((file, index) => createInvoiceFile(db, value.id, file, index))
  })

  ;[...mock.notes].reverse().forEach((value) => createNote(db, value))
  ;[...mock.preservations].reverse().forEach((value) => createPreservation(db, value))

  // 初始 Mock 待办与日程分别原样导入，不能调用会自动补期限事件的 todoService。
  ;[...mock.todos].reverse().forEach((value) => createTodoRow(db, value))
  ;[...mock.events].reverse().forEach((value) => createEvent(db, value))
}
