import type { AppState } from '../types/api'
import { contractDisplayName } from './contractName'
import { formatAmount, formatDate, formatDateTime } from './utils'

export interface SearchResult {
  key: string
  title: string
  secondary: string
  to: string
  snippet?: string
}

export interface SearchGroup {
  label: string
  total: number
  items: SearchResult[]
}

export const SEARCH_GROUP_LIMIT = 5

export function searchTokens(query: string): string[] {
  return [...new Set(query.trim().toLowerCase().split(/\s+/).filter(Boolean))]
}

/** 每个词都须命中该对象的指定字段，允许不同词命中不同字段。 */
function matches(tokens: string[], fields: (string | undefined)[]): boolean {
  const values = fields.map((value) => (value ?? '').toLowerCase())
  return tokens.every((token) => values.some((value) => value.includes(token)))
}

function noteSnippet(content: string, tokens: string[]): string | undefined {
  const lower = content.toLowerCase()
  const hits = tokens.map((token) => ({ index: lower.indexOf(token), length: token.length }))
    .filter((hit) => hit.index >= 0).sort((a, b) => a.index - b.index || b.length - a.length)
  if (!hits.length) return undefined
  const start = Math.max(0, hits[0].index - 30)
  const end = Math.min(content.length, hits[0].index + hits[0].length + 30)
  return `${start ? '…' : ''}${content.slice(start, end).replace(/\s+/g, ' ')}${end < content.length ? '…' : ''}`
}

/** 仅投影业务文本与对象路由，不读取附件元数据；随 Store 快照重新派生。 */
export function searchAppState(state: AppState, tokens: string[]): SearchGroup[] {
  if (!tokens.length) return []
  const cases = new Map(state.cases.map((value) => [value.id, value]))
  const clients = new Map(state.clients.map((value) => [value.id, value]))
  const caseName = (id: string | null) => (id ? cases.get(id)?.title : undefined) ?? '未关联案件'
  const clientName = (id: string) => clients.get(id)?.name ?? '未关联客户'
  const groups: SearchGroup[] = []
  const addGroup = <T>(label: string, values: T[], toResult: (value: T) => SearchResult) => {
    // 统计全部命中，但只为展示的前五条生成摘要、格式化字段和路由。
    if (values.length) groups.push({ label, total: values.length, items: values.slice(0, SEARCH_GROUP_LIMIT).map(toResult) })
  }
  const secondary = (...values: (string | undefined | null)[]) => values.filter(Boolean).join(' · ')
  const editRoute = (page: string, id: string) => `/${page}?edit=${encodeURIComponent(id)}`

  addGroup('案件', state.cases.filter((value) => matches(tokens, [value.title, value.caseNumber, value.opposingParty, clients.get(value.clientId)?.name, value.court])),
    (value) => ({ key: `case:${value.id}`, title: value.title,
      secondary: secondary(clientName(value.clientId), value.caseNumber, value.court, formatAmount(value.amount)),
      to: `/cases/${encodeURIComponent(value.id)}` }))
  addGroup('客户', state.clients.filter((value) => matches(tokens, [value.name, value.phone, value.email, value.address])),
    (value) => ({ key: `client:${value.id}`, title: value.name,
      secondary: secondary(value.type, value.phone, value.email, value.address), to: `/clients/${encodeURIComponent(value.id)}` }))
  addGroup('合同', state.contracts.map((value) => ({ value, title: contractDisplayName(value, (id) => cases.get(id), (id) => clients.get(id)) }))
    .filter(({ value, title }) => matches(tokens, [title, value.contractNo])),
    ({ value, title }) => ({ key: `contract:${value.id}`, title,
      secondary: secondary(clientName(value.clientId), value.contractNo, formatDate(value.signedAt), formatAmount(value.totalFee)),
      to: `/contracts/${encodeURIComponent(value.id)}` }))
  addGroup('笔记', state.notes.filter((value) => matches(tokens, [value.title, value.content])),
    (value) => ({ key: `note:${value.id}`, title: value.title,
      secondary: secondary(caseName(value.caseId), `更新于 ${formatDate(value.updatedAt)}`),
      snippet: noteSnippet(value.content, tokens), to: `/notes?note=${encodeURIComponent(value.id)}` }))
  addGroup('待办', state.todos.filter((value) => matches(tokens, [value.title])),
    (value) => ({ key: `todo:${value.id}`, title: value.title,
      secondary: secondary(caseName(value.caseId), value.done ? '已完成' : '未完成', value.deadline ? `期限 ${formatDate(value.deadline)}` : '未设定期限'),
      to: editRoute('todos', value.id) }))
  addGroup('日程', state.events.filter((value) => matches(tokens, [value.title, value.location])),
    (value) => ({ key: `event:${value.id}`, title: value.title,
      secondary: secondary(caseName(value.caseId), formatDateTime(value.start), value.location), to: editRoute('calendar', value.id) }))
  addGroup('保全', state.preservations.filter((value) => matches(tokens, [value.type, cases.get(value.caseId)?.title])),
    (value) => ({ key: `preservation:${value.id}`, title: value.type,
      secondary: secondary(caseName(value.caseId), value.deadline ? `到期日 ${formatDate(value.deadline)}` : '未设定到期日'),
      to: editRoute('preservations', value.id) }))
  return groups
}

/** 合并相交命中区间，以纯文本片段交给 React 渲染；标点按字面匹配。 */
export function highlightParts(value: string, tokens: string[]): { text: string; matched: boolean }[] {
  const lower = value.toLowerCase()
  const ranges: { start: number; end: number }[] = []
  for (const token of tokens) {
    if (!token) continue
    let start = lower.indexOf(token)
    while (start >= 0) {
      ranges.push({ start, end: start + token.length })
      start = lower.indexOf(token, start + 1)
    }
  }
  ranges.sort((a, b) => a.start - b.start || b.end - a.end)
  const merged: typeof ranges = []
  for (const range of ranges) {
    const previous = merged[merged.length - 1]
    if (previous && range.start <= previous.end) previous.end = Math.max(previous.end, range.end)
    else merged.push({ ...range })
  }
  const parts: { text: string; matched: boolean }[] = []
  let offset = 0
  for (const range of merged) {
    if (offset < range.start) parts.push({ text: value.slice(offset, range.start), matched: false })
    parts.push({ text: value.slice(range.start, range.end), matched: true })
    offset = range.end
  }
  if (offset < value.length) parts.push({ text: value.slice(offset), matched: false })
  return parts
}
