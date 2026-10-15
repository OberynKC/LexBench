import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowDown, ArrowUp, Briefcase, Plus, Search } from 'lucide-react'
import dayjs from 'dayjs'
import { useStore } from '../store'
import { formatAmount, formatDate } from '../lib/utils'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Select } from '../components/ui/select'
import { EmptyState } from '../components/ui/empty-state'
import { Card } from '../components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table'
import { CaseTypeBadge, StageBadge } from '../components/badges'
import { CaseFormDrawer } from '../components/CaseFormDrawer'
import { STAGE_TEMPLATES } from '../lib/stageTemplates'
import type { CaseType } from '../types'

const types: CaseType[] = ['民事', '刑事', '行政', '仲裁', '非诉']

export default function CaseList() {
  const { state, getClient } = useStore()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [keyword, setKeyword] = useState('')
  const [sortAsc, setSortAsc] = useState(true)
  const [drawerOpen, setDrawerOpen] = useState(false)

  const templateFilter = searchParams.get('template') ?? ''
  const typeFilter = searchParams.get('type') ?? ''

  const setFilter = (key: 'template' | 'type', value: string) => {
    const next = new URLSearchParams(searchParams)
    if (value) next.set(key, value)
    else next.delete(key)
    setSearchParams(next, { replace: true })
  }

  const filtered = useMemo(() => {
    let list = state.cases
    if (templateFilter) list = list.filter((c) => c.templateId === templateFilter)
    if (typeFilter) list = list.filter((c) => c.type === typeFilter)
    const kw = keyword.trim().toLowerCase()
    if (kw) list = list.filter((c) => (c.caseNumber ?? '').toLowerCase().includes(kw) || c.title.toLowerCase().includes(kw))
    return [...list].sort((a, b) => {
      const diff = dayjs(a.nextDeadline).valueOf() - dayjs(b.nextDeadline).valueOf()
      return sortAsc ? diff : -diff
    })
  }, [state.cases, templateFilter, typeFilter, keyword, sortAsc])

  return (
    <div className="space-y-3 p-5">
      {/* 工具栏 */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-4" />
          <Input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="搜索案号 / 案件名称"
            className="w-56 pl-8"
          />
        </div>
        <Select value={templateFilter} onChange={(e) => setFilter('template', e.target.value)} className="w-36">
          <option value="">全部程序</option>
          {STAGE_TEMPLATES.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </Select>
        <Select value={typeFilter} onChange={(e) => setFilter('type', e.target.value)} className="w-28">
          <option value="">全部类型</option>
          {types.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </Select>
        <span className="text-xs text-ink-3 tnum">共 {filtered.length} 件</span>
        <div className="ml-auto">
          <Button size="sm" onClick={() => setDrawerOpen(true)}>
            <Plus /> 新建案件
          </Button>
        </div>
      </div>

      {/* 表格 */}
      <Card className="overflow-hidden">
        {filtered.length === 0 ? (
          <EmptyState
            icon={Briefcase}
            title="没有符合条件的案件"
            description="调整筛选条件，或新建一个案件"
            action={<Button size="sm" onClick={() => setDrawerOpen(true)}><Plus /> 新建案件</Button>}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>案件名称 / 案号</TableHead>
                <TableHead>类型</TableHead>
                <TableHead>委托人</TableHead>
                <TableHead>受理法院 / 仲裁委</TableHead>
                <TableHead>阶段</TableHead>
                <TableHead className="text-right">标的额</TableHead>
                <TableHead>
                  <button
                    className="inline-flex items-center gap-1 transition-colors hover:text-navy-700 dark:hover:text-navy-300"
                    onClick={() => setSortAsc((v) => !v)}
                  >
                    下次节点
                    {sortAsc ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />}
                  </button>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((c) => (
                <TableRow key={c.id} className="cursor-pointer" onClick={() => navigate(`/cases/${c.id}`)}>
                  <TableCell className="max-w-[300px]">
                    <span className="block truncate font-medium text-ink">{c.title}</span>
                    <span className="tnum mt-0.5 block truncate font-mono text-xs text-ink-3">
                      {c.caseNumber || <span className="font-sans text-ink-4">暂无案号</span>}
                    </span>
                  </TableCell>
                  <TableCell><CaseTypeBadge type={c.type} /></TableCell>
                  <TableCell className="max-w-[160px]"><span className="block truncate text-ink-2">{getClient(c.clientId)?.name ?? '-'}</span></TableCell>
                  <TableCell className="max-w-[200px]"><span className="block truncate text-ink-2">{c.court || '-'}</span></TableCell>
                  <TableCell><StageBadge templateId={c.templateId} stageId={c.stageId} /></TableCell>
                  <TableCell className="tnum whitespace-nowrap text-right font-medium text-ink">
                    {c.amount ? formatAmount(c.amount) : '-'}
                  </TableCell>
                  <TableCell className="tnum whitespace-nowrap text-ink-2">
                    {formatDate(c.nextDeadline)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <CaseFormDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} onSaved={(c) => navigate(`/cases/${c.id}`)} />
    </div>
  )
}
