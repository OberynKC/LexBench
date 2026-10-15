import dayjs from 'dayjs'
import type {
  CalendarEvent,
  Case,
  Client,
  Contract,
  FeeRecord,
  FileMeta,
  Invoice,
  Note,
  NoteDraft,
  NoteVersion,
  Preservation,
  Todo,
} from '../../src/types'

export interface ClientRow {
  id: string
  name: string
  type: Client['type']
  phone: string
  email: string
  address: string
  note: string
}

export interface CaseRow {
  id: string
  case_number: string | null
  title: string
  type: Case['type']
  template_id: string
  stage_id: string
  side: Case['side']
  client_id: string
  opposing_party: string
  court: string
  judge: string
  judge_phone: string
  amount_cents: number
  accepted_at: string
  next_deadline: string
  note: string
}

export interface ContractRow {
  id: string
  contract_no: string
  client_id: string
  signed_at: string
  fee_mode: Contract['feeMode']
  total_fee_cents: number
  status: Contract['status']
  note: string
}

export interface FeeRow {
  id: string
  contract_id: string
  label: string
  amount_cents: number
  due_date: string
  received_amount_cents: number
  received_at: string
  note: string
}

export interface InvoiceRow {
  id: string
  contract_id: string
  invoice_no: string
  kind: Invoice['kind']
  amount_cents: number
  issued_at: string
  note: string
}

export interface FileRow {
  id: string
  contract_id: string | null
  invoice_id: string | null
  case_id: string | null
  name: string
  stored_name: string
  rel_path: string
  size: number
  uploaded_at: string
  sort_order: number
}

export interface NoteRow {
  id: string
  case_id: string
  title: string
  content: string
  tags_json: string
  created_at: string
  updated_at: string
}

export interface NoteVersionRow {
  id: string
  note_id: string
  title: string
  content: string
  tags_json: string
  created_at: string
}

export interface NoteDraftRow {
  note_id: string
  case_id: string | null
  title: string
  content: string
  tags_json: string
  saved_at: string
}

export function mapNoteVersion(row: NoteVersionRow): NoteVersion {
  return { id: row.id, noteId: row.note_id, title: row.title, content: row.content,
    tags: parseTags(row.tags_json), createdAt: normalizeTimestamp(row.created_at) }
}

export function mapNoteDraft(row: NoteDraftRow): NoteDraft {
  return { noteId: row.note_id, caseId: row.case_id ?? '', title: row.title, content: row.content,
    tags: parseTags(row.tags_json), savedAt: normalizeTimestamp(row.saved_at) }
}

export interface PreservationRow {
  id: string
  case_id: string
  type: Preservation['type']
  deadline: string | null
  status: Preservation['status']
  note: string
}

export interface EventRow {
  id: string
  title: string
  type: CalendarEvent['type']
  case_id: string | null
  starts_at: string
  ends_at: string
  location: string
  reminder: string
  todo_id: string | null
}

export interface TodoRow {
  id: string
  title: string
  case_id: string | null
  done: number
  deadline: string | null
  created_at: string
}

export function toCents(value: number): number {
  const cents = Math.round(value * 100)
  if (!Number.isSafeInteger(cents) || cents < 0) throw new Error('金额超出可存储范围')
  return cents
}

export function fromCents(value: number): number {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error('数据库金额格式无效')
  return value / 100
}

export function normalizeDate(value: string, allowEmpty = false): string {
  if (allowEmpty && value === '') return ''
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('日期必须为 YYYY-MM-DD 格式')
  const parsed = dayjs(value)
  if (!parsed.isValid() || parsed.format('YYYY-MM-DD') !== value) throw new Error('日期值无效')
  return value
}

export function normalizeTimestamp(value: string): string {
  const parsed = dayjs(value)
  if (!parsed.isValid()) throw new Error('时间值无效')
  return parsed.toISOString()
}

export function parseTags(value: string): string[] {
  let parsed: unknown
  try {
    parsed = JSON.parse(value)
  } catch {
    throw new Error('数据库笔记标签 JSON 损坏')
  }
  if (!Array.isArray(parsed) || parsed.some((tag) => typeof tag !== 'string')) {
    throw new Error('数据库笔记标签格式无效')
  }
  return parsed
}

export function mapClient(row: ClientRow): Client {
  return { ...row }
}

export function mapCase(row: CaseRow, relatedCaseIds: string[], files: FileMeta[]): Case {
  return {
    id: row.id,
    ...(row.case_number === null ? {} : { caseNumber: row.case_number }),
    title: row.title,
    type: row.type,
    templateId: row.template_id,
    stageId: row.stage_id,
    side: row.side,
    relatedCaseIds,
    clientId: row.client_id,
    opposingParty: row.opposing_party,
    court: row.court,
    judge: row.judge,
    judgePhone: row.judge_phone,
    amount: fromCents(row.amount_cents),
    acceptedAt: row.accepted_at,
    nextDeadline: row.next_deadline,
    note: row.note,
    files,
  }
}

export function mapFile(row: FileRow): FileMeta {
  return {
    id: row.id,
    name: row.name,
    storedName: row.stored_name,
    relPath: row.rel_path,
    size: row.size,
    uploadedAt: row.uploaded_at,
  }
}

export function mapContract(row: ContractRow, caseIds: string[], files: FileMeta[]): Contract {
  return {
    id: row.id,
    contractNo: row.contract_no,
    clientId: row.client_id,
    caseIds,
    signedAt: row.signed_at,
    feeMode: row.fee_mode,
    totalFee: fromCents(row.total_fee_cents),
    status: row.status,
    files,
    note: row.note,
  }
}

export function mapFee(row: FeeRow): FeeRecord {
  return {
    id: row.id,
    contractId: row.contract_id,
    label: row.label,
    amount: fromCents(row.amount_cents),
    dueDate: row.due_date,
    receivedAmount: fromCents(row.received_amount_cents),
    receivedAt: row.received_at,
    note: row.note,
  }
}

export function mapInvoice(row: InvoiceRow, files: FileMeta[]): Invoice {
  return {
    id: row.id,
    contractId: row.contract_id,
    invoiceNo: row.invoice_no,
    kind: row.kind,
    amount: fromCents(row.amount_cents),
    issuedAt: row.issued_at,
    files,
    note: row.note,
  }
}

export function mapNote(row: NoteRow): Note {
  return {
    id: row.id,
    caseId: row.case_id,
    title: row.title,
    content: row.content,
    tags: parseTags(row.tags_json),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function mapPreservation(row: PreservationRow): Preservation {
  return {
    id: row.id,
    caseId: row.case_id,
    type: row.type,
    deadline: row.deadline,
    status: row.status,
    note: row.note,
  }
}

export function mapEvent(row: EventRow): CalendarEvent {
  return {
    id: row.id,
    title: row.title,
    type: row.type,
    caseId: row.case_id,
    start: row.starts_at,
    end: row.ends_at,
    location: row.location,
    reminder: row.reminder,
    todoId: row.todo_id,
  }
}

export function mapTodo(row: TodoRow): Todo {
  if (row.done !== 0 && row.done !== 1) throw new Error('数据库待办完成状态无效')
  return {
    id: row.id,
    title: row.title,
    caseId: row.case_id,
    done: row.done === 1,
    deadline: row.deadline,
    createdAt: row.created_at,
  }
}
