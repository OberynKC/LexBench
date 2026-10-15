import { useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import dayjs from 'dayjs'
import {
  ArrowLeft,
  FileSignature,
  FileText,
  Files,
  Landmark,
  NotebookPen,
  Pencil,
  Phone,
  Plus,
  ShieldCheck,
  CalendarDays,
  MapPin,
  User,
} from 'lucide-react'
import { useStore } from '../store'
import { cn, formatAmount, formatAmountFull, formatDate, formatDateTime, formatTime } from '../lib/utils'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { Card, CardContent } from '../components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import { EmptyState } from '../components/ui/empty-state'
import {
  CaseTypeBadge,
  ContractStatusBadge,
  DeadlineBadge,
  EventTypeBadge,
  PreservationStatusBadge,
  PreservationTypeBadge,
  StageBadge,
} from '../components/badges'
import { CaseFormDrawer } from '../components/CaseFormDrawer'
import { ContractDialog } from '../components/ContractDialog'
import { EventDialog } from '../components/EventDialog'
import { PreservationDialog } from '../components/PreservationDialog'
import { TodoDialog } from '../components/TodoDialog'
import { FilePicker } from '../components/FilePicker'
import { getTemplate, stageOf, stageProgress } from '../lib/stageTemplates'

function InfoItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-ink-3">{label}</dt>
      <dd className="mt-1 text-sm text-ink">{children}</dd>
    </div>
  )
}

export default function CaseDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const store = useStore()
  const { state } = store
  const c = store.getCase(id ?? '')

  const [editOpen, setEditOpen] = useState(false)
  const [presDialog, setPresDialog] = useState<{ open: boolean; edit?: string }>({ open: false })
  const [eventOpen, setEventOpen] = useState(false)
  const [todoOpen, setTodoOpen] = useState(false)
  const [contractOpen, setContractOpen] = useState(false)

  if (!c) {
    return (
      <div className="p-5">
        <EmptyState
          icon={FileText}
          title="未找到该案件"
          description="案件可能已被删除"
          action={<Button size="sm" onClick={() => navigate('/cases')}>返回案件列表</Button>}
        />
      </div>
    )
  }

  const client = store.getClient(c.clientId)
  const notes = store.notesOfCase(c.id)
  const preservations = store.preservationsOfCase(c.id)
  const caseEvents = store.eventsOfCase(c.id)
  const contracts = store.contractsOfCase(c.id)
  const caseFiles = c.files
  const template = getTemplate(c.templateId)
  const { main: mainStages, activeIndex: stageIndex, branch: branchStage } = stageProgress(template, c.stageId)
  const currentHint = stageOf(c.templateId, c.stageId)?.hint
  // 关联案件：本案件主动关联的 + 反向关联到本案件的（衍生诉讼、上诉、执行等程序实例）
  const relatedCases = [
    ...c.relatedCaseIds.map((rid) => store.getCase(rid)),
    ...state.cases.filter((x) => x.relatedCaseIds.includes(c.id)),
  ].filter((x, i, arr): x is NonNullable<typeof x> => !!x && arr.findIndex((y) => y?.id === x.id) === i)

  return (
    <div className="space-y-4 p-5">
      {/* 返回 + 标题 */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="返回">
          <ArrowLeft />
        </Button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-lg font-semibold text-ink">{c.title}</h2>
            <CaseTypeBadge type={c.type} />
            {template && <Badge variant="outline">{template.name}</Badge>}
            <StageBadge templateId={c.templateId} stageId={c.stageId} />
            <Badge variant="gray">{c.side}</Badge>
          </div>
          <p className="mt-0.5 font-mono text-xs text-ink-3 tnum">{c.caseNumber || '暂无案号（可立案后补录）'}</p>
        </div>
        <Button variant="outline" onClick={() => setEditOpen(true)}>
          <Pencil /> 编辑案件
        </Button>
      </div>

      {/* 基本信息卡 */}
      <Card>
        <CardContent className="space-y-5">
          {/* 阶段步骤条（主干链；分支阶段单独标注） */}
          <div className="flex items-center">
            {mainStages.map((s, i) => {
              const done = stageIndex >= 0 && i < stageIndex
              const active = i === stageIndex
              return (
                <div key={s.id} className="flex flex-1 items-center last:flex-none">
                  <div className="flex flex-col items-center gap-1.5">
                    <div
                      className={cn(
                        'flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium tnum',
                        active
                          ? 'bg-navy-800 text-white ring-4 ring-navy-100 dark:ring-navy-900'
                          : done
                            ? 'bg-navy-100 text-navy-700 dark:bg-navy-900 dark:text-navy-200'
                            : 'bg-hover text-ink-4',
                      )}
                    >
                      {i + 1}
                    </div>
                    <span className={cn('text-xs', active ? 'font-semibold text-navy-800 dark:text-navy-200' : 'text-ink-4')}>{s.label}</span>
                  </div>
                  {i < mainStages.length - 1 && (
                    <div className={cn('mx-2 mb-5 h-0.5 flex-1 rounded', stageIndex >= 0 && i < stageIndex ? 'bg-navy-300' : 'bg-line-3')} />
                  )}
                </div>
              )
            })}
          </div>
          {(branchStage || currentHint) && (
            <div className="space-y-1 text-xs text-ink-3">
              {branchStage && (
                <p>
                  当前处于分支阶段：<span className="font-medium text-amber-600 dark:text-amber-400">{branchStage.label}</span>
                  {branchStage.hint && <span>（{branchStage.hint}）</span>}
                </p>
              )}
              {!branchStage && currentHint && <p>阶段提示：{currentHint}</p>}
            </div>
          )}

          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 md:grid-cols-4">
            <InfoItem label="委托人">
              {client ? (
                <Link to={`/clients/${client.id}`} className="inline-flex items-center gap-1 text-navy-700 hover:underline dark:text-navy-300">
                  <User className="h-3.5 w-3.5" /> {client.name}
                </Link>
              ) : '-'}
            </InfoItem>
            <InfoItem label="对方当事人">{c.opposingParty || '-'}</InfoItem>
            <InfoItem label="受理法院 / 仲裁委">
              <span className="inline-flex items-center gap-1"><Landmark className="h-3.5 w-3.5 text-ink-4" />{c.court || '-'}</span>
            </InfoItem>
            <InfoItem label="承办法官 / 仲裁员">
              {c.judge || '-'}
              {c.judgePhone && (
                <span className="ml-2 inline-flex items-center gap-1 tnum text-xs text-ink-3">
                  <Phone className="h-3 w-3" />{c.judgePhone}
                </span>
              )}
            </InfoItem>
            <InfoItem label="标的金额">
              <span className="tnum font-semibold text-navy-800 dark:text-navy-200" title={formatAmountFull(c.amount)}>
                {c.amount ? formatAmount(c.amount) : '-'}
              </span>
            </InfoItem>
            <InfoItem label="收案日期"><span className="tnum">{formatDate(c.acceptedAt)}</span></InfoItem>
            <InfoItem label="下次关键节点">
              <span className="tnum">{formatDate(c.nextDeadline)}</span>
              <span className="ml-2">
                <DeadlineBadge deadline={c.nextDeadline} />
              </span>
            </InfoItem>
            <InfoItem label="备注">{c.note || '-'}</InfoItem>
          </dl>

          {/* 关联案件：衍生诉讼、上诉、执行等以独立程序实例相互关联 */}
          {relatedCases.length > 0 && (
            <div className="border-t border-line-1 pt-4">
              <p className="mb-2 text-xs text-ink-3">关联案件（上诉 / 执行 / 衍生诉讼等）</p>
              <div className="space-y-1.5">
                {relatedCases.map((rc) => (
                  <Link key={rc.id} to={`/cases/${rc.id}`} className="flex items-center gap-2 text-sm text-navy-700 hover:underline dark:text-navy-300">
                    <span className="truncate">{rc.title}</span>
                    <StageBadge templateId={rc.templateId} stageId={rc.stageId} />
                    <span className="font-mono text-xs text-ink-4 tnum">{rc.caseNumber || '暂无案号'}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tab 页签 */}
      <Tabs defaultValue="notes">
        <TabsList>
          <TabsTrigger value="notes"><NotebookPen className="h-3.5 w-3.5" /> 办案笔记 <Badge variant="gray">{notes.length}</Badge></TabsTrigger>
          <TabsTrigger value="preservations"><ShieldCheck className="h-3.5 w-3.5" /> 保全执行 <Badge variant="gray">{preservations.length}</Badge></TabsTrigger>
          <TabsTrigger value="events"><CalendarDays className="h-3.5 w-3.5" /> 日程与开庭 <Badge variant="gray">{caseEvents.length}</Badge></TabsTrigger>
          <TabsTrigger value="contracts"><FileSignature className="h-3.5 w-3.5" /> 合同费用 <Badge variant="gray">{contracts.length}</Badge></TabsTrigger>
          <TabsTrigger value="docs"><Files className="h-3.5 w-3.5" /> 案件文档 <Badge variant="gray">{caseFiles.length}</Badge></TabsTrigger>
        </TabsList>

        {/* 办案笔记 */}
        <TabsContent value="notes" className="mt-3">
          <div className="mb-3 flex justify-end gap-2">
            <Button size="sm" variant="outline" onClick={() => setTodoOpen(true)}>
              <Plus /> 新建待办
            </Button>
            <Button size="sm" onClick={() => navigate('/notes', { state: { create: true, caseId: c.id } })}>
              <Plus /> 新建笔记
            </Button>
          </div>
          {notes.length === 0 ? (
            <Card><EmptyState icon={NotebookPen} title="暂无办案笔记" description="记录庭审要点、客户沟通、法律研究等" /></Card>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {notes.map((n) => (
                <Card key={n.id} className="cursor-pointer transition-colors hover:border-line-2" onClick={() => navigate(`/notes?note=${n.id}`)}>
                  <CardContent>
                    <p className="font-medium text-ink">{n.title}</p>
                    <p className="mt-1 line-clamp-2 text-xs text-ink-3">
                      {n.content.replace(/[#*>`\-[\]]/g, '').slice(0, 80)}
                    </p>
                    <div className="mt-2.5 flex items-center justify-between">
                      <div className="flex flex-wrap gap-1">
                        {n.tags.map((t) => (
                          <Badge key={t} variant="secondary">{t}</Badge>
                        ))}
                      </div>
                      <span className="tnum shrink-0 text-[11px] text-ink-4">{dayjs(n.updatedAt).format('M月D日 HH:mm')} 更新</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* 保全执行 */}
        <TabsContent value="preservations" className="mt-3">
          <div className="mb-3 flex justify-end">
            <Button size="sm" onClick={() => setPresDialog({ open: true })}>
              <Plus /> 新建记录
            </Button>
          </div>
          {preservations.length === 0 ? (
            <Card><EmptyState icon={ShieldCheck} title="暂无保全 / 执行记录" /></Card>
          ) : (
            <div className="space-y-2.5">
              {preservations.map((p) => (
                <Card key={p.id}>
                  <CardContent className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <PreservationTypeBadge type={p.type} />
                      <div>
                        <p className="text-sm text-ink">{p.note || '（无备注）'}</p>
                        <p className="mt-0.5 tnum text-xs text-ink-3">{p.deadline ? `到期日 ${formatDate(p.deadline)}` : '未设定到期日'}</p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <PreservationStatusBadge preservation={p} />
                      {p.deadline && <DeadlineBadge deadline={p.deadline} />}
                      <Button variant="ghost" size="sm" onClick={() => setPresDialog({ open: true, edit: p.id })}>编辑</Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* 日程与开庭 */}
        <TabsContent value="events" className="mt-3">
          <div className="mb-3 flex justify-end">
            <Button size="sm" onClick={() => setEventOpen(true)}>
              <Plus /> 新建日程
            </Button>
          </div>
          {caseEvents.length === 0 ? (
            <Card><EmptyState icon={CalendarDays} title="暂无相关日程" /></Card>
          ) : (
            <div className="space-y-2.5">
              {caseEvents.map((e) => {
                const past = dayjs(e.end).isBefore(dayjs())
                return (
                  <Card key={e.id} className={cn(past && 'opacity-60')}>
                    <CardContent className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <EventTypeBadge type={e.type} />
                        <div>
                          <p className="text-sm font-medium text-ink">{e.title}</p>
                          <p className="mt-0.5 flex items-center gap-3 text-xs text-ink-3">
                            <span className="tnum">{formatDateTime(e.start)} - {formatTime(e.end)}</span>
                            {e.location && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{e.location}</span>}
                          </p>
                        </div>
                      </div>
                      {e.reminder && <span className="shrink-0 text-xs text-ink-3">提醒：{e.reminder}</span>}
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </TabsContent>

        {/* 案件文档 */}
        <TabsContent value="docs" className="mt-3">
          <Card>
            <CardContent>
              <FilePicker
                owner={{ type: 'case', id: c.id }}
                files={caseFiles}
                emptyText="暂无案件文档，可上传起诉状、证据材料、裁判文书等文件"
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* 合同费用：应收 / 实收 / 发票均挂在合同层，案件只读引用，避免多案件合同重复统计 */}
        <TabsContent value="contracts" className="mt-3">
          <div className="mb-3 flex justify-end">
            <Button size="sm" onClick={() => setContractOpen(true)}>
              <Plus /> 新建合同
            </Button>
          </div>
          {contracts.length === 0 ? (
            <Card><EmptyState icon={FileSignature} title="暂无关联合同" description="新建委托代理合同并关联本案件" /></Card>
          ) : (
            <div className="space-y-2.5">
              {contracts.map((ct) => {
                const sum = store.feeSummary(ct.id)
                const otherCount = ct.caseIds.filter((cid) => cid !== c.id).length
                return (
                  <Card key={ct.id} className="cursor-pointer transition-colors hover:border-line-2" onClick={() => navigate(`/contracts/${ct.id}`, { state: { contractReturnTo: location.pathname + location.search } })}>
                    <CardContent className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <FileSignature className="h-4 w-4 shrink-0 text-ink-4" />
                        <div>
                          <p className="text-sm font-medium text-navy-700 dark:text-navy-300">{ct.contractNo}</p>
                          <p className="mt-0.5 text-xs text-ink-3">
                            {ct.feeMode} · 约定 <span className="tnum">{formatAmount(ct.totalFee)}</span> · 签约 {formatDate(ct.signedAt)}
                          </p>
                          {otherCount > 0 && (
                            <p className="mt-0.5 text-xs text-amber-600 dark:text-amber-400">该合同还关联 {otherCount} 个其他案件，费用按合同整体计算</p>
                          )}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <span className="tnum text-xs text-ink-3">
                          实收 {formatAmount(sum.received)} / 应收 {formatAmount(sum.receivable)}
                        </span>
                        <ContractStatusBadge status={ct.status} />
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <CaseFormDrawer open={editOpen} onClose={() => setEditOpen(false)} caseData={c} />
      <PreservationDialog
        open={presDialog.open}
        onClose={() => setPresDialog({ open: false })}
        caseId={c.id}
        preservation={presDialog.edit ? state.preservations.find((p) => p.id === presDialog.edit) : undefined}
      />
      <EventDialog open={eventOpen} onClose={() => setEventOpen(false)} defaultCaseId={c.id} />
      <TodoDialog open={todoOpen} onClose={() => setTodoOpen(false)} fixedCaseId={c.id} />
      <ContractDialog open={contractOpen} onClose={() => setContractOpen(false)} fixedClientId={c.clientId} preselectCaseId={c.id} />
    </div>
  )
}
