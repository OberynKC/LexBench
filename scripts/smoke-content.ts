/** 虚构示例、程序结构及农历回归；全部在内存运行。 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import dayjs from 'dayjs'
import { lunarDayText } from '../src/lib/lunar'
import { STAGE_TEMPLATES, stageOf } from '../src/lib/stageTemplates'
import * as mock from '../src/mock/data'

let passed = 0
function check(label: string, run: () => void) {
  run(); passed++; console.log(`  ✓ ${label}`)
}
const dates = [
  ['1900-01-31', '正月'], ['2024-02-09', '三十'], ['2024-02-10', '正月'],
  ['2024-02-24', '十五'], ['2025-01-29', '正月'], ['2026-02-17', '正月'],
  ['2023-03-22', '闰二月'], ['2023-03-23', '初二'],
  ['2025-07-25', '闰六月'], ['2025-07-26', '初二'],
  ['2024-12-01', '冬月'], ['2024-12-31', '腊月'], ['2100-12-31', '腊月'],
]
for (const [date, expected] of dates) check(`农历 ${date}`, () => assert.equal(lunarDayText(dayjs(date)), expected))
for (const date of ['1899-12-31', '1900-01-30', '2101-01-01', 'invalid']) {
  check(`农历范围 ${date}`, () => assert.equal(lunarDayText(dayjs(date)), ''))
}
check('同一日历日期的时刻不影响农历显示', () => {
  for (const hour of [0, 12, 23]) assert.equal(lunarDayText(dayjs('2025-07-25').hour(hour)), '闰六月')
})
check('1900—2100 年逐日换算输出有效日名', () => {
  const valid = /^(闰)?(正|二|三|四|五|六|七|八|九|十|冬|腊)月$|^(初[二三四五六七八九十]|十[一二三四五六七八九]|二十|廿[一二三四五六七八九]|三十)$/
  for (let date = dayjs('1900-01-31'); date.isBefore('2101-01-01'); date = date.add(1, 'day')) {
    assert.match(lunarDayText(date), valid, date.format('YYYY-MM-DD'))
  }
})
check('演示实体规模完整', () => assert.deepEqual(
  [mock.clients.length, mock.cases.length, mock.notes.length, mock.preservations.length, mock.events.length, mock.todos.length, mock.contracts.length, mock.fees.length, mock.invoices.length],
  [8, 15, 20, 10, 18, 9, 4, 5, 3],
))
check('演示身份和联系方式使用占位值', () => {
  for (const client of mock.clients) {
    assert.match(client.name, /^(客户[甲乙丙丁]|公司[甲乙丙丁]（示例）)$/)
    assert.match(client.phone, /^示例电话-\d+$/)
    assert.match(client.email, /^client\d+@example\.com$/)
    assert.match(client.address, /^示例地址-\d+$/)
  }
  for (const c of mock.cases) {
    if (c.caseNumber) assert.match(c.caseNumber, /^演示案号\(\d+\)$/)
    if (c.judgePhone) assert.match(c.judgePhone, /^示例电话-/)
    if (c.court) assert.match(c.court, /^示例受理机构-/)
  }
})
check('演示关联和程序阶段完整', () => {
  const cases = new Set(mock.cases.map((v) => v.id)), clients = new Set(mock.clients.map((v) => v.id)), contracts = new Set(mock.contracts.map((v) => v.id))
  for (const c of mock.cases) {
    assert.ok(clients.has(c.clientId)); assert.ok(stageOf(c.templateId, c.stageId))
    for (const id of c.relatedCaseIds) assert.ok(cases.has(id))
  }
  for (const row of [...mock.notes, ...mock.events, ...mock.todos, ...mock.preservations]) if (row.caseId) assert.ok(cases.has(row.caseId))
  for (const row of mock.contracts) { assert.ok(clients.has(row.clientId)); row.caseIds.forEach((id) => assert.ok(cases.has(id))) }
  for (const row of [...mock.fees, ...mock.invoices]) assert.ok(contracts.has(row.contractId))
  assert.ok(mock.events.every((row) => !row.todoId))
})
check('演示附件仅为明确的元数据样例', () => {
  for (const file of [...mock.contracts, ...mock.invoices].flatMap((v) => v.files)) {
    assert.equal(file.relPath, ''); assert.equal(file.storedName, '')
  }
})
check('22 个程序模板及阶段引用有效', () => {
  assert.equal(STAGE_TEMPLATES.length, 22)
  assert.equal(new Set(STAGE_TEMPLATES.map((t) => t.id)).size, 22)
  for (const t of STAGE_TEMPLATES) {
    const ids = new Set(t.stages.map((s) => s.id))
    assert.equal(ids.size, t.stages.length); assert.ok(t.stages.some((s) => s.entry))
    for (const s of t.stages) s.next.forEach((id) => assert.ok(ids.has(id)))
  }
})
check('阶段清单及示例笔记保持人工核对口径', () => {
  const content = [...STAGE_TEMPLATES.flatMap((t) => t.stages.map((s) => s.hint ?? '')), ...mock.notes.map((n) => n.content)].join('\n')
  assert.doesNotMatch(content, /\d+\s*(日内|年内|个月内)|民初.*号|平均判赔|量刑建议可能|黄金.*天/)
})
// 子进程重复验证同一组日期与完整日期范围，覆盖各时区的夏令时切换。
if (!process.env.LEXBENCH_CONTENT_TIMEZONE_CHILD) {
  for (const tz of ['Asia/Shanghai', 'America/Los_Angeles', 'Pacific/Kiritimati']) check(`时区 ${tz}`, () => {
    const result = spawnSync(process.execPath, [__filename], {
      env: { ...process.env, TZ: tz, LEXBENCH_CONTENT_TIMEZONE_CHILD: '1' }, encoding: 'utf8', timeout: 30000,
    })
    assert.ifError(result.error); assert.equal(result.status, 0, result.stderr)
  })
}
console.log(`\n内容与农历冒烟结果：${passed} 项通过，0 项失败`)
