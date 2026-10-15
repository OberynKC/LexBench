import { useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Building2, FileSignature, Mail, MapPin, Pencil, Phone, Plus, User, Users } from 'lucide-react'
import { useStore } from '../store'
import { formatAmount, formatDate } from '../lib/utils'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { EmptyState } from '../components/ui/empty-state'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table'
import { CaseTypeBadge, ContractStatusBadge, StageBadge } from '../components/badges'
import { ClientDialog } from '../components/ClientDialog'
import { ContractDialog } from '../components/ContractDialog'

export default function ClientDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const { getClient, casesOfClient, contractsOfClient, feeSummary } = useStore()
  const [editOpen, setEditOpen] = useState(false)
  const [contractOpen, setContractOpen] = useState(false)
  const client = getClient(id ?? '')

  if (!client) {
    return (
      <div className="p-5">
        <EmptyState
          icon={Users}
          title="未找到该客户"
          action={<Button size="sm" onClick={() => navigate('/clients')}>返回客户列表</Button>}
        />
      </div>
    )
  }

  const cases = casesOfClient(client.id)
  const contracts = contractsOfClient(client.id)

  return (
    <div className="space-y-4 p-5">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="返回">
          <ArrowLeft />
        </Button>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-navy-100 text-navy-700 dark:bg-navy-900 dark:text-navy-200">
            {client.type === '企业' ? <Building2 className="h-5 w-5" /> : <User className="h-5 w-5" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-ink">{client.name}</h2>
              <Badge variant={client.type === '企业' ? 'blue' : 'gray'}>{client.type}</Badge>
            </div>
          </div>
        </div>
        <Button variant="outline" className="ml-auto" onClick={() => setEditOpen(true)}>
          <Pencil /> 编辑客户
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* 联系信息 */}
        <Card>
          <CardHeader>
            <CardTitle>联系信息</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="flex items-center gap-2.5 text-ink-2">
              <Phone className="h-4 w-4 shrink-0 text-ink-4" />
              <span className="tnum">{client.phone || '-'}</span>
            </p>
            <p className="flex items-center gap-2.5 text-ink-2">
              <Mail className="h-4 w-4 shrink-0 text-ink-4" />
              {client.email || '-'}
            </p>
            <p className="flex items-start gap-2.5 text-ink-2">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-ink-4" />
              {client.address || '-'}
            </p>
            {client.note && (
              <div className="rounded-md bg-hover px-3 py-2 text-xs text-ink-3">
                备注：{client.note}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 名下案件 */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              名下案件
              <Badge variant="secondary">{cases.length} 件</Badge>
            </CardTitle>
          </CardHeader>
          {cases.length === 0 ? (
            <EmptyState icon={Users} title="该客户暂无案件" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>案件名称</TableHead>
                  <TableHead>类型</TableHead>
                  <TableHead>阶段</TableHead>
                  <TableHead className="text-right">标的额</TableHead>
                  <TableHead>收案日期</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cases.map((c) => (
                  <TableRow key={c.id} className="cursor-pointer" onClick={() => navigate(`/cases/${c.id}`)}>
                    <TableCell>
                      <Link to={`/cases/${c.id}`} className="block max-w-[280px] truncate font-medium text-navy-700 hover:underline dark:text-navy-300" onClick={(e) => e.stopPropagation()}>
                        {c.title}
                      </Link>
                      <span className="font-mono text-[11px] text-ink-4 tnum">{c.caseNumber || '暂无案号'}</span>
                    </TableCell>
                    <TableCell><CaseTypeBadge type={c.type} /></TableCell>
                    <TableCell><StageBadge templateId={c.templateId} stageId={c.stageId} /></TableCell>
                    <TableCell className="tnum text-right text-ink-2">{c.amount ? formatAmount(c.amount) : '-'}</TableCell>
                    <TableCell className="tnum text-ink-3">{formatDate(c.acceptedAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      </div>

      {/* 委托代理合同 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            委托代理合同
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{contracts.length} 份</Badge>
              <Button size="sm" onClick={() => setContractOpen(true)}>
                <Plus /> 新建合同
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        {contracts.length === 0 ? (
          <EmptyState icon={FileSignature} title="暂无委托代理合同" description="记录合同扫描件、收费方式与应收实收" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>合同编号</TableHead>
                <TableHead>收费方式</TableHead>
                <TableHead className="text-right">约定律师费</TableHead>
                <TableHead className="text-right">应收 / 实收</TableHead>
                <TableHead className="text-center">关联案件</TableHead>
                <TableHead>签约日期</TableHead>
                <TableHead>状态</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contracts.map((ct) => {
                const sum = feeSummary(ct.id)
                return (
                  <TableRow key={ct.id} className="cursor-pointer" onClick={() => navigate(`/contracts/${ct.id}`, { state: { contractReturnTo: location.pathname + location.search } })}>
                    <TableCell className="font-medium text-navy-700 dark:text-navy-300">{ct.contractNo}</TableCell>
                    <TableCell className="text-ink-2">{ct.feeMode}</TableCell>
                    <TableCell className="tnum text-right text-ink-2">{formatAmount(ct.totalFee)}</TableCell>
                    <TableCell className="tnum text-right text-ink-3">
                      {formatAmount(sum.receivable)} / {formatAmount(sum.received)}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary">{ct.caseIds.length > 0 ? `${ct.caseIds.length} 件` : '未关联'}</Badge>
                    </TableCell>
                    <TableCell className="tnum text-ink-3">{formatDate(ct.signedAt)}</TableCell>
                    <TableCell><ContractStatusBadge status={ct.status} /></TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      <ClientDialog open={editOpen} onClose={() => setEditOpen(false)} client={client} />
      <ContractDialog open={contractOpen} onClose={() => setContractOpen(false)} fixedClientId={client.id} />
    </div>
  )
}
