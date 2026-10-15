import type { AlertOptions, ConfirmOptions } from '../../src/types/api'
import dayjs from 'dayjs'
import type {
  CalendarEvent,
  Case,
  CaseType,
  Client,
  ClientType,
  Contract,
  ContractStatus,
  EventType,
  FeeMode,
  FeeRecord,
  FileMeta,
  FileOwner,
  Invoice,
  Note,
  NoteDraftInput,
  PartySide,
  Preservation,
  PreservationStatus,
  PreservationType,
  Todo,
} from '../../src/types'
import type { InitialSetupMode, InitialSetupPayload } from '../../src/types/api'
import { getTemplate } from '../../src/lib/stageTemplates'

const caseTypes: readonly CaseType[] = ['民事', '刑事', '行政', '仲裁', '非诉']
const partySides: readonly PartySide[] = [
  '原告方',
  '被告方',
  '上诉人方',
  '被上诉人方',
  '申请人方',
  '被申请人方',
  '申请执行人方',
  '被执行人方',
  '辩护人',
  '被害人方',
  '自诉人方',
  '案外人/第三人',
  '无对抗立场',
]
const clientTypes: readonly ClientType[] = ['个人', '企业']
const feeModes: readonly FeeMode[] = ['固定收费', '风险代理', '半风险代理', '计时收费']
const contractStatuses: readonly ContractStatus[] = ['履行中', '已完结', '已解除']
const invoiceKinds: readonly Invoice['kind'][] = ['增值税普通发票', '增值税专用发票']
const preservationTypes: readonly PreservationType[] = ['财产保全', '行为保全', '证据保全', '先予执行', '查封扣押']
const preservationStatuses: readonly PreservationStatus[] = ['申请', '生效', '结束']
const eventTypes: readonly EventType[] = ['开庭', '会见', '截止期限', '其他']
const fileOwnerTypes: readonly FileOwner['type'][] = ['contract', 'invoice', 'case']

function record(value: unknown, name: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error(`${name} 必须是对象`)
  const prototype = Object.getPrototypeOf(value)
  if (prototype !== Object.prototype && prototype !== null) throw new Error(`${name} 必须是普通对象`)
  return value as Record<string, unknown>
}

function stringValue(value: unknown, name: string, allowEmpty = true): string {
  if (typeof value !== 'string') throw new Error(`${name} 必须是字符串`)
  if (!allowEmpty && value.length === 0) throw new Error(`${name} 不能为空`)
  return value
}

function optionalString(value: unknown, name: string): string | undefined {
  if (value === undefined) return undefined
  return stringValue(value, name)
}

function nullableString(value: unknown, name: string): string | null {
  if (value === null) return null
  return stringValue(value, name)
}

function booleanValue(value: unknown, name: string): boolean {
  if (typeof value !== 'boolean') throw new Error(`${name} 必须是布尔值`)
  return value
}

function nonNegativeNumber(value: unknown, name: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) throw new Error(`${name} 必须是不小于 0 的有限数字`)
  const cents = Math.round(value * 100)
  if (!Number.isSafeInteger(cents)) throw new Error(`${name} 超出可存储范围`)
  return value
}

function nonNegativeInteger(value: unknown, name: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) throw new Error(`${name} 必须是非负安全整数`)
  return value
}

function enumValue<T extends string>(value: unknown, name: string, allowed: readonly T[]): T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) throw new Error(`${name} 取值无效`)
  return value as T
}

function stringArray(value: unknown, name: string, unique = false): string[] {
  if (!Array.isArray(value)) throw new Error(`${name} 必须是字符串数组`)
  const values = value.map((item, index) => stringValue(item, `${name}[${index}]`, false))
  if (unique && new Set(values).size !== values.length) throw new Error(`${name} 不能包含重复项`)
  return values
}

function dateValue(value: unknown, name: string, allowEmpty = false): string {
  const result = stringValue(value, name)
  if (allowEmpty && result === '') return result
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result)) throw new Error(`${name} 必须为 YYYY-MM-DD`)
  const parsed = dayjs(result)
  if (!parsed.isValid() || parsed.format('YYYY-MM-DD') !== result) throw new Error(`${name} 日期无效`)
  return result
}

function nullableDate(value: unknown, name: string): string | null {
  if (value === null) return null
  return dateValue(value, name)
}

function timestampValue(value: unknown, name: string): string {
  const result = stringValue(value, name, false)
  if (!dayjs(result).isValid()) throw new Error(`${name} 时间无效`)
  return result
}

function fileMeta(value: unknown, name: string): FileMeta {
  const data = record(value, name)
  return {
    id: stringValue(data.id, `${name}.id`, false),
    name: stringValue(data.name, `${name}.name`, false),
    storedName: stringValue(data.storedName, `${name}.storedName`),
    relPath: stringValue(data.relPath, `${name}.relPath`),
    size: nonNegativeInteger(data.size, `${name}.size`),
    uploadedAt: timestampValue(data.uploadedAt, `${name}.uploadedAt`),
  }
}

function files(value: unknown, name: string): FileMeta[] {
  if (!Array.isArray(value)) throw new Error(`${name} 必须是数组`)
  const result = value.map((item, index) => fileMeta(item, `${name}[${index}]`))
  if (new Set(result.map((item) => item.id)).size !== result.length) throw new Error(`${name} 的文件 id 不能重复`)
  return result
}

export function validateId(value: unknown, name = 'id'): string {
  return stringValue(value, name, false)
}

export function validateFileOwner(value: unknown): FileOwner {
  const data = record(value, '附件归属')
  const id = stringValue(data.id, '附件归属.id', false)
  if (!/^[A-Za-z0-9_-]+$/.test(id)) throw new Error('附件归属.id 格式无效')
  return {
    type: enumValue(data.type, '附件归属.type', fileOwnerTypes),
    id,
  }
}

export function validateInitialSetupMode(value: unknown): InitialSetupMode {
  if (value !== 'blank' && value !== 'demo') throw new Error('初始化模式无效')
  return value
}

export function validateInitialSetupPayload(value: unknown): InitialSetupPayload {
  const data = record(value, '初始化')
  return {
    userName: validateUserName(data.userName),
    userGivenName: stringValue(data.userGivenName, '初始化.userGivenName'),
    mode: enumValue(data.mode, '初始化.mode', ['blank', 'demo']),
  }
}

export function validateUserName(value: unknown): string {
  const surname = stringValue(value, '姓').trim()
  if (!surname) throw new Error('姓不能为空或纯空白')
  return surname
}

export function validateUserGivenName(value: unknown): string {
  return stringValue(value, '名')
}

export function validateTestMode(value: unknown): boolean {
  return booleanValue(value, '测试模式')
}

export function validateClient(value: unknown): Client {
  const data = record(value, '客户')
  return {
    id: stringValue(data.id, '客户.id', false),
    name: stringValue(data.name, '客户.name', false),
    type: enumValue(data.type, '客户.type', clientTypes),
    phone: stringValue(data.phone, '客户.phone'),
    email: stringValue(data.email, '客户.email'),
    address: stringValue(data.address, '客户.address'),
    note: stringValue(data.note, '客户.note'),
  }
}

export function validateCase(value: unknown): Case {
  const data = record(value, '案件')
  const result: Case = {
    id: stringValue(data.id, '案件.id', false),
    caseNumber: optionalString(data.caseNumber, '案件.caseNumber'),
    title: stringValue(data.title, '案件.title', false),
    type: enumValue(data.type, '案件.type', caseTypes),
    templateId: stringValue(data.templateId, '案件.templateId', false),
    stageId: stringValue(data.stageId, '案件.stageId', false),
    side: enumValue(data.side, '案件.side', partySides),
    relatedCaseIds: stringArray(data.relatedCaseIds, '案件.relatedCaseIds', true),
    clientId: stringValue(data.clientId, '案件.clientId', false),
    opposingParty: stringValue(data.opposingParty, '案件.opposingParty'),
    court: stringValue(data.court, '案件.court'),
    judge: stringValue(data.judge, '案件.judge'),
    judgePhone: stringValue(data.judgePhone, '案件.judgePhone'),
    amount: nonNegativeNumber(data.amount, '案件.amount'),
    acceptedAt: dateValue(data.acceptedAt, '案件.acceptedAt'),
    nextDeadline: dateValue(data.nextDeadline, '案件.nextDeadline'),
    note: stringValue(data.note, '案件.note'),
    files: files(data.files, '案件.files'),
  }
  if (result.relatedCaseIds.includes(result.id)) throw new Error('案件不能关联自身')
  const template = getTemplate(result.templateId)
  if (!template) throw new Error('案件阶段模板不存在')
  if (template.caseType !== result.type) throw new Error('案件类型与阶段模板不匹配')
  if (!template.sides.includes(result.side)) throw new Error('案件代理立场不属于当前阶段模板')
  if (!template.stages.some((stage) => stage.id === result.stageId)) throw new Error('案件当前阶段不属于当前阶段模板')
  return result
}

export function validateContract(value: unknown): Contract {
  const data = record(value, '合同')
  return {
    id: stringValue(data.id, '合同.id', false),
    contractNo: stringValue(data.contractNo, '合同.contractNo', false),
    clientId: stringValue(data.clientId, '合同.clientId', false),
    caseIds: stringArray(data.caseIds, '合同.caseIds', true),
    signedAt: dateValue(data.signedAt, '合同.signedAt'),
    feeMode: enumValue(data.feeMode, '合同.feeMode', feeModes),
    totalFee: nonNegativeNumber(data.totalFee, '合同.totalFee'),
    status: enumValue(data.status, '合同.status', contractStatuses),
    files: files(data.files, '合同.files'),
    note: stringValue(data.note, '合同.note'),
  }
}

export function validateFee(value: unknown): FeeRecord {
  const data = record(value, '收费期次')
  return {
    id: stringValue(data.id, '收费期次.id', false),
    contractId: stringValue(data.contractId, '收费期次.contractId', false),
    label: stringValue(data.label, '收费期次.label', false),
    amount: nonNegativeNumber(data.amount, '收费期次.amount'),
    dueDate: dateValue(data.dueDate, '收费期次.dueDate'),
    receivedAmount: nonNegativeNumber(data.receivedAmount, '收费期次.receivedAmount'),
    receivedAt: dateValue(data.receivedAt, '收费期次.receivedAt', true),
    note: stringValue(data.note, '收费期次.note'),
  }
}

export function validateInvoice(value: unknown): Invoice {
  const data = record(value, '发票')
  return {
    id: stringValue(data.id, '发票.id', false),
    contractId: stringValue(data.contractId, '发票.contractId', false),
    invoiceNo: stringValue(data.invoiceNo, '发票.invoiceNo', false),
    kind: enumValue(data.kind, '发票.kind', invoiceKinds),
    amount: nonNegativeNumber(data.amount, '发票.amount'),
    issuedAt: dateValue(data.issuedAt, '发票.issuedAt'),
    files: files(data.files, '发票.files'),
    note: stringValue(data.note, '发票.note'),
  }
}

export function validateNote(value: unknown): Note {
  const data = record(value, '笔记')
  if (data.id === '__new__') throw new Error('笔记 id 不能使用新建草稿保留键')
  return {
    id: stringValue(data.id, '笔记.id', false),
    caseId: stringValue(data.caseId, '笔记.caseId', false),
    title: stringValue(data.title, '笔记.title', false),
    content: stringValue(data.content, '笔记.content'),
    tags: stringArray(data.tags, '笔记.tags'),
    createdAt: timestampValue(data.createdAt, '笔记.createdAt'),
    updatedAt: timestampValue(data.updatedAt, '笔记.updatedAt'),
  }
}

export function validateNoteCreation(value: unknown): { note: Note; clearNewDraft: boolean } {
  const data = record(value, '新建笔记')
  return 'note' in data
    ? { note: validateNote(data.note), clearNewDraft: booleanValue(data.clearNewDraft, '清理新建草稿') }
    : { note: validateNote(value), clearNewDraft: false }
}

export function validateNoteDraft(value: unknown): NoteDraftInput {
  const data = record(value, '笔记草稿')
  return {
    noteId: stringValue(data.noteId, '笔记草稿.noteId', false),
    caseId: stringValue(data.caseId, '笔记草稿.caseId'),
    title: stringValue(data.title, '笔记草稿.title'),
    content: stringValue(data.content, '笔记草稿.content'),
    tags: stringArray(data.tags, '笔记草稿.tags'),
  }
}

export function validatePreservation(value: unknown): Preservation {
  const data = record(value, '保全执行')
  return {
    id: stringValue(data.id, '保全执行.id', false),
    caseId: stringValue(data.caseId, '保全执行.caseId', false),
    type: enumValue(data.type, '保全执行.type', preservationTypes),
    deadline: nullableDate(data.deadline, '保全执行.deadline'),
    status: enumValue(data.status, '保全执行.status', preservationStatuses),
    note: stringValue(data.note, '保全执行.note'),
  }
}

export function validateEvent(value: unknown, allowTodoId = false): CalendarEvent {
  const data = record(value, '日程')
  const todoId = data.todoId === undefined ? null : nullableString(data.todoId, '日程.todoId')
  if (!allowTodoId && todoId !== null) throw new Error('手工日程不能绑定待办')
  const result: CalendarEvent = {
    id: stringValue(data.id, '日程.id', false),
    title: stringValue(data.title, '日程.title', false),
    type: enumValue(data.type, '日程.type', eventTypes),
    caseId: nullableString(data.caseId, '日程.caseId'),
    start: timestampValue(data.start, '日程.start'),
    end: timestampValue(data.end, '日程.end'),
    location: stringValue(data.location, '日程.location'),
    reminder: stringValue(data.reminder, '日程.reminder'),
    todoId,
  }
  if (dayjs(result.end).isBefore(dayjs(result.start))) throw new Error('日程结束时间不能早于开始时间')
  return result
}

export function validateTodo(value: unknown): Todo {
  const data = record(value, '待办')
  return {
    id: stringValue(data.id, '待办.id', false),
    title: stringValue(data.title, '待办.title', false),
    caseId: nullableString(data.caseId, '待办.caseId'),
    done: booleanValue(data.done, '待办.done'),
    deadline: nullableDate(data.deadline, '待办.deadline'),
    createdAt: timestampValue(data.createdAt, '待办.createdAt'),
  }
}

function dialogText(value: unknown, label: string, required = true): string {
  const text = stringValue(value, label).trim()
  if ((required && !text) || text.length > 10000) throw new Error(`${label}为空或过长`)
  return text
}
export function validateAlertOptions(value: unknown): AlertOptions {
  const data = record(value, '提示')
  return {
    title: dialogText(data.title, '标题'), message: dialogText(data.message, '提示内容'),
    detail: data.detail === undefined ? undefined : dialogText(data.detail, '详细说明', false),
    type: data.type === undefined ? 'info' : enumValue(data.type, '提示类型', ['info', 'warning', 'error'] as const),
  }
}
export function validateConfirmOptions(value: unknown): ConfirmOptions {
  const data = record(value, '确认')
  const { title, message, detail } = validateAlertOptions(value)
  return { title, message, detail, confirmLabel: enumValue(data.confirmLabel, '确认按钮', ['删除', '导入']) }
}
