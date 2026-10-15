import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Plus, ShieldCheck } from 'lucide-react'
import { useStore } from '../store'
import { daysUntil, formatDate } from '../lib/utils'
import { Button } from '../components/ui/button'
import { Select } from '../components/ui/select'
import { EmptyState } from '../components/ui/empty-state'
import { Card, CardContent } from '../components/ui/card'
import { DeadlineBadge, PreservationStatusBadge, PreservationTypeBadge, preservationStatusOf } from '../components/badges'
import { PreservationDialog } from '../components/PreservationDialog'
import type { PreservationDisplayStatus, PreservationType } from '../types'

const types: PreservationType[] = ['财产保全', '行为保全', '证据保全', '先予执行', '查封扣押']
/** 筛选项为展示状态（含派生的临期 / 超期） */
const statuses: PreservationDisplayStatus[] = ['申请', '生效', '临期', '超期', '结束']

export default function Preservations() {
  const { state, getCase } = useStore()
  const [typeFilter, setTypeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [dialog, setDialog] = useState<{ open: boolean; edit?: string }>({ open: false })
  const [searchParams, setSearchParams] = useSearchParams()

  useEffect(() => {
    const id = searchParams.get('edit')
    if (!id) return
    if (state.preservations.some((value) => value.id === id)) {
      setTypeFilter('')
      setStatusFilter('')
      setDialog({ open: true, edit: id })
    }
    const next = new URLSearchParams(searchParams)
    next.delete('edit')
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams, state.preservations])

  const filtered = useMemo(() => {
    let list = [...state.preservations]
    if (typeFilter) list = list.filter((p) => p.type === typeFilter)
    if (statusFilter) list = list.filter((p) => preservationStatusOf(p) === statusFilter)
    // 无到期日（申请阶段 / 无固定期限）排在最后
    return list.sort((a, b) => (a.deadline ? daysUntil(a.deadline) : Infinity) - (b.deadline ? daysUntil(b.deadline) : Infinity))
  }, [state.preservations, typeFilter, statusFilter])

  return (
    <div className="space-y-3 p-5">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="w-36">
          <option value="">全部类型</option>
          {types.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </Select>
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-36">
          <option value="">全部状态</option>
          {statuses.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </Select>
        <span className="text-xs text-ink-3 tnum">共 {filtered.length} 条</span>
        <div className="ml-auto">
          <Button size="sm" onClick={() => setDialog({ open: true })}>
            <Plus /> 新建记录
          </Button>
        </div>
      </div>

      {/* 分级说明 */}
      <Card className="flex flex-wrap items-center gap-4 px-4 py-2.5 text-xs text-ink-3">
        <span className="font-medium text-ink-2">倒计时颜色规则：</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-red-500" /> 剩余 ≤ 7 天</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-500" /> 剩余 ≤ 60 天（临期）</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-gray-400" /> 剩余 &gt; 60 天（生效）</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-red-600 ring-2 ring-red-200 dark:ring-red-900" /> 超期</span>
        <span className="ml-auto">临期 / 超期随日期自动调整，续期请编辑到期日</span>
      </Card>

      {filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={ShieldCheck}
            title="没有符合条件的记录"
            description="调整筛选条件，或新建一条保全 / 执行记录"
            action={<Button size="sm" onClick={() => setDialog({ open: true })}><Plus /> 新建记录</Button>}
          />
        </Card>
      ) : (
        <div className="space-y-2.5">
          {filtered.map((p) => {
            const c = getCase(p.caseId)
            return (
              <Card
                key={p.id}
                className="cursor-pointer transition-colors hover:border-line-2"
                onClick={() => setDialog({ open: true, edit: p.id })}
              >
                <CardContent className="flex items-center gap-4">
                  <div className="w-20 shrink-0">
                    <PreservationTypeBadge type={p.type} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-center gap-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setDialog({ open: true, edit: p.id })
                        }}
                        className="min-w-0 truncate text-left text-sm font-medium text-navy-700 hover:underline dark:text-navy-300"
                      >
                        {c?.title ?? '未知案件'}
                      </button>
                      {c && (
                        <Link
                          to={`/cases/${c.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="shrink-0 text-xs text-ink-4 hover:text-navy-700 hover:underline dark:hover:text-navy-300"
                        >
                          查看案件
                        </Link>
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-xs text-ink-3">{p.note || '（无备注）'}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="tnum text-xs text-ink-3">{p.deadline ? `到期日 ${formatDate(p.deadline)}` : '未设定到期日'}</p>
                    <div className="mt-1 flex items-center justify-end gap-2">
                      <PreservationStatusBadge preservation={p} />
                      {p.deadline && <DeadlineBadge deadline={p.deadline} />}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <PreservationDialog
        open={dialog.open}
        onClose={() => setDialog({ open: false })}
        preservation={dialog.edit ? state.preservations.find((p) => p.id === dialog.edit) : undefined}
      />
    </div>
  )
}
