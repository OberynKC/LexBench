import assert from 'node:assert/strict'
import * as mock from '../src/mock/data'
import type { AppState } from '../src/types/api'
import { highlightParts, searchAppState, searchTokens } from '../src/lib/globalSearch'

const state: AppState = {
  ...mock, userName: '测试', userGivenName: '', testMode: true, demoImported: true,
  reminderSeen: [], reminderSystem: true, reminderBadge: true,
}
const initial = structuredClone(state)
let passed = 0
function check(label: string, run: () => void) {
  run()
  passed++
  console.log(`  ✓ ${label}`)
}
const search = (query: string, snapshot = state) => searchAppState(snapshot, searchTokens(query))
const contains = (query: string, key: string, snapshot = state) => search(query, snapshot).some((group) => group.items.some((item) => item.key === key))

for (const query of ['公', '公司', '公司甲']) {
  check(`中文 ${query.length} 字命中`, () => assert.ok(contains(query, 'case:case3')))
}
check('案号及标点按字面匹配', () => assert.ok(contains('演示案号(001)', 'case:case1')))
check('当事人和法院可跨字段同时命中', () => assert.ok(contains('对方甲 示例受理机构-001', 'case:case1')))
check('委托人作为案件当事人命中', () => assert.ok(contains('客户丙 示例受理机构-002', 'case:case2')))
check('客户联系方式大小写不敏感', () => assert.ok(contains('CLIENT01@EXAMPLE.COM', 'client:c1')))
check('客户电话可命中', () => assert.ok(contains('示例电话-01', 'client:c1')))
check('多词全部命中并去重，支持全角空格', () => assert.deepEqual(searchTokens(' ABC　abc \t 证据 '), ['abc', '证据']))
check('任一词未命中则排除对象', () => assert.deepEqual(search('对方甲 绝无此词'), []))
check('空词不列出实体', () => assert.deepEqual(search(' \t '), []))
check('合同名称与编号同时命中', () => assert.ok(contains(`客户甲 ${state.contracts[0].contractNo}`, `contract:${state.contracts[0].id}`)))
check('多案件合同使用总表展示名', () => assert.ok(contains('等2案', 'contract:ct2')))

const note = { ...state.notes[0], id: 'search-note', title: '检索标题', content: `${'前'.repeat(45)}摘要独有[AbC]${'后'.repeat(45)}` }
const noteState = { ...state, notes: [note] }
check('笔记标题与正文跨字段匹配', () => assert.ok(contains('检索 摘要独有', 'note:search-note', noteState)))
check('正文摘要保留命中词前后约 30 字', () => {
  const result = search('摘要独有', noteState)[0].items[0]
  assert.equal(result.snippet, `…${'前'.repeat(30)}摘要独有[AbC]${'后'.repeat(25)}…`)
})
check('标点和英文原始大小写正确高亮', () => assert.deepEqual(highlightParts('正文[AbC]结尾', searchTokens('[abc]')), [
  { text: '正文', matched: false }, { text: '[AbC]', matched: true }, { text: '结尾', matched: false },
]))
check('相交关键词高亮保持原文', () => {
  const parts = highlightParts('财产保全', searchTokens('财产 产保 保全'))
  assert.deepEqual(parts, [{ text: '财产保全', matched: true }])
})
check('日程地点可命中', () => assert.ok(contains(state.events[0].location, `event:${state.events[0].id}`)))
check('保全类型与所属案件同时命中', () => {
  const value = state.preservations[0]
  const title = state.cases.find((item) => item.id === value.caseId)!.title
  assert.ok(contains(`${value.type} ${title}`, `preservation:${value.id}`))
})
check('每组限制五条并保留总数', () => {
  const snapshot = { ...state, todos: Array.from({ length: 8 }, (_, i) => ({ ...state.todos[0], id: `limit-${i}`, title: `分组验收${i}` })) }
  const groups = search('分组验收', snapshot)
  assert.equal(groups[0].total, 8)
  assert.equal(groups[0].items.length, 5)
  assert.deepEqual(groups[0].items.map((item) => item.key), Array.from({ length: 5 }, (_, i) => `todo:limit-${i}`))
})
check('七类分组均保留全部命中数与原始顺序', () => {
  const snapshot: AppState = {
    ...state,
    cases: Array.from({ length: 8 }, (_, i) => ({ ...state.cases[0], id: `bulk-case-${i}`, clientId: `bulk-client-${i}`, title: '容量验收' })),
    clients: Array.from({ length: 8 }, (_, i) => ({ ...state.clients[0], id: `bulk-client-${i}`, name: '容量验收' })),
    contracts: Array.from({ length: 8 }, (_, i) => ({ ...state.contracts[0], id: `bulk-contract-${i}`, clientId: `bulk-client-${i}`, caseIds: [`bulk-case-${i}`], contractNo: '容量验收' })),
    notes: Array.from({ length: 8 }, (_, i) => ({ ...state.notes[0], id: `bulk-note-${i}`, caseId: `bulk-case-${i}`, title: '容量验收' })),
    todos: Array.from({ length: 8 }, (_, i) => ({ ...state.todos[0], id: `bulk-todo-${i}`, caseId: `bulk-case-${i}`, title: '容量验收' })),
    events: Array.from({ length: 8 }, (_, i) => ({ ...state.events[0], id: `bulk-event-${i}`, caseId: `bulk-case-${i}`, title: '容量验收' })),
    preservations: Array.from({ length: 8 }, (_, i) => ({ ...state.preservations[0], id: `bulk-preservation-${i}`, caseId: 'bulk-case-0' })),
  }
  const groups = search('容量验收', snapshot)
  assert.deepEqual(groups.map((group) => group.label), ['案件', '客户', '合同', '笔记', '待办', '日程', '保全'])
  for (const [index, type] of ['case', 'client', 'contract', 'note', 'todo', 'event', 'preservation'].entries()) {
    assert.equal(groups[index].total, 8)
    assert.deepEqual(groups[index].items.map((item) => item.key), Array.from({ length: 5 }, (_, i) => `${type}:bulk-${type}-${i}`))
  }
})
check('超出展示上限的笔记只参与匹配与计数', () => {
  let formatted = 0
  const snapshot = { ...state, notes: Array.from({ length: 8 }, (_, i) => ({
    ...note, id: `projection-${i}`,
    get updatedAt() {
      assert.ok(i < 5, '不应读取未展示笔记的格式化字段')
      formatted++
      return note.updatedAt
    },
  })) }
  const group = search('摘要独有', snapshot)[0]
  assert.equal(group.total, 8)
  assert.equal(formatted, 5)
  assert.ok(group.items.every((item) => item.snippet?.includes('摘要独有')))
})
check('记录改名后结果即时派生', () => {
  const snapshot = { ...noteState, notes: [{ ...note, title: '修订标题' }] }
  assert.equal(contains('检索标题', 'note:search-note', snapshot), false)
  assert.ok(contains('修订标题', 'note:search-note', snapshot))
})
check('记录删除后结果消失', () => assert.deepEqual(search('摘要独有', { ...noteState, notes: [] }), []))
check('关联案件改名同步更新合同展示名与保全结果', () => {
  const snapshot = { ...state, cases: state.cases.map((item) => item.id === 'case1' ? { ...item, title: '案件改名验收' } : item) }
  assert.ok(contains('案件改名验收', 'contract:ct1', snapshot))
  assert.ok(search('案件改名验收', snapshot).some((group) => group.label === '保全'))
})
check('搜索不读取附件名或路径', () => {
  const snapshot = { ...state, cases: state.cases.map((item) => ({ ...item, files: [{ id: 'private-file', name: '路径独有词.pdf', storedName: '路径独有词.pdf', relPath: '/Users/private/路径独有词.pdf', size: 1, uploadedAt: '' }] })) }
  assert.deepEqual(search('路径独有词', snapshot), [])
  assert.equal(JSON.stringify(search('客户甲', snapshot)).includes('/Users/private'), false)
})
check('七类结果生成正确路由', () => {
  const queries = [
    ['对方甲', 'case:case1', '/cases/case1'], ['CLIENT01', 'client:c1', '/clients/c1'],
    [state.contracts[0].contractNo, `contract:${state.contracts[0].id}`, `/contracts/${state.contracts[0].id}`],
    ['摘要独有', 'note:search-note', '/notes?note=search-note'],
    [state.todos[0].title, `todo:${state.todos[0].id}`, `/todos?edit=${state.todos[0].id}`],
    [state.events[0].title, `event:${state.events[0].id}`, `/calendar?edit=${state.events[0].id}`],
    [state.preservations[0].type, `preservation:${state.preservations[0].id}`, `/preservations?edit=${state.preservations[0].id}`],
  ]
  for (const [query, key, to] of queries) {
    assert.equal(search(query, noteState).flatMap((group) => group.items).find((item) => item.key === key)?.to, to)
  }
})
check('搜索保持输入快照不变', () => assert.deepEqual(state, initial))
console.log(`\n搜索冒烟结果：${passed} 项通过，0 项失败`)
