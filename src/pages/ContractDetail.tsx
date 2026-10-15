import { contractReturnPath } from '../lib/contractNavigation'
import { confirmAction } from '../lib/dialogs'
import { useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, FileSignature, Pencil, Plus, Receipt, Trash2, User } from 'lucide-react'
import { useStore } from '../store'
import { formatAmount, formatAmountFull, formatDate } from '../lib/utils'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { EmptyState } from '../components/ui/empty-state'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table'
import { ContractStatusBadge, FeeStatusBadge } from '../components/badges'
import { ContractDialog } from '../components/ContractDialog'
import { FeeDialog } from '../components/FeeDialog'
import { InvoiceDialog } from '../components/InvoiceDialog'
import { FilePicker } from '../components/FilePicker'

function InfoItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-ink-3">{label}</dt>
      <dd className="mt-1 text-sm text-ink">{children}</dd>
    </div>
  )
}

export default function ContractDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const store = useStore()
  const contract = store.getContract(id ?? '')

  const [editOpen, setEditOpen] = useState(false)
  const [feeDialog, setFeeDialog] = useState<{ open: boolean; editId?: string }>({ open: false })
  const [invDialog, setInvDialog] = useState<{ open: boolean; editId?: string }>({ open: false })

  if (!contract) {
    return (
      <div className="p-5">
        <EmptyState
          icon={FileSignature}
          title="未找到该合同"
          description="合同可能已被删除"
          action={<Button size="sm" onClick={() => navigate('/contracts')}>返回合同列表</Button>}
        />
      </div>
    )
  }

  const client = store.getClient(contract.clientId)
  // 悬空引用兜底：合同关联的案件可能已被删除
  const linkedCases = contract.caseIds.map((cid) => store.getCase(cid)).filter((c): c is NonNullable<typeof c> => !!c)
  const fees = store.feesOfContract(contract.id)
  const invoices = store.invoicesOfContract(contract.id)
  const summary = store.feeSummary(contract.id)

  const handleDelete = async () => {
    if (!store.canWrite()) return
    if (!await confirmAction(`确定删除合同「${contract.contractNo}」？\n其下的收费期次（${fees.length} 条）与发票（${invoices.length} 条）将一并删除。`)) return
    if (!store.dispatch({ type: 'deleteContract', payload: contract.id })) return
    navigate(contractReturnPath(location.state?.contractReturnTo, store.state), { replace: true })
  }

  return (
    <div className="space-y-4 p-5">
      {/* 返回 + 标题 */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="返回">
          <ArrowLeft />
        </Button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-lg font-semibold text-ink">{contract.contractNo}</h2>
            <Badge variant="outline">{contract.feeMode}</Badge>
            <ContractStatusBadge status={contract.status} />
          </div>
          <p className="mt-0.5 text-xs text-ink-3">委托代理合同 · 签约于 {formatDate(contract.signedAt)}</p>
        </div>
        <Button variant="outline" onClick={() => setEditOpen(true)}>
          <Pencil /> 编辑合同
        </Button>
        <Button mutation variant="destructive" onClick={handleDelete}>
          <Trash2 /> 删除
        </Button>
      </div>

      {/* 基本信息 */}
      <Card>
        <CardContent>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 md:grid-cols-4">
            <InfoItem label="委托人">
              {client ? (
                <Link to={`/clients/${client.id}`} className="inline-flex items-center gap-1 text-navy-700 hover:underline dark:text-navy-300">
                  <User className="h-3.5 w-3.5" /> {client.name}
                </Link>
              ) : '-'}
            </InfoItem>
            <InfoItem label="收费方式">{contract.feeMode}</InfoItem>
            <InfoItem label="约定律师费">
              <span className="tnum font-semibold text-navy-800 dark:text-navy-200" title={formatAmountFull(contract.totalFee)}>
                {contract.totalFee ? formatAmount(contract.totalFee) : '-'}
              </span>
            </InfoItem>
            <InfoItem label="签约日期"><span className="tnum">{formatDate(contract.signedAt)}</span></InfoItem>
            <InfoItem label="备注">{contract.note || '-'}</InfoItem>
          </dl>

          <div className="mt-4 border-t border-line-1 pt-4">
            <p className="mb-2 text-xs text-ink-3">关联案件</p>
            {linkedCases.length === 0 ? (
              <p className="text-sm text-ink-4">未关联案件</p>
            ) : (
              <div className="space-y-1.5">
                {linkedCases.map((c) => (
                  <Link key={c.id} to={`/cases/${c.id}`} className="flex items-center gap-2 text-sm text-navy-700 hover:underline dark:text-navy-300">
                    <span className="truncate">{c.title}</span>
                    <span className="font-mono text-xs text-ink-4 tnum">{c.caseNumber || '暂无案号'}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="mt-4 border-t border-line-1 pt-4">
            <p className="mb-2 text-xs text-ink-3">合同扫描件</p>
            <FilePicker
              owner={{ type: 'contract', id: contract.id }}
              files={contract.files}
              emptyText="暂无合同扫描件，可上传一个或多个文件"
            />
          </div>
        </CardContent>
      </Card>

      {/* 费用 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-3">
              应收 / 实收
              <span className="tnum text-sm font-normal text-ink-3">
                应收 {formatAmount(summary.receivable)} · 实收 <span className="font-medium text-emerald-600 dark:text-emerald-400">{formatAmount(summary.received)}</span>
                {summary.receivable - summary.received > 0 && (
                  <span className="text-red-500 dark:text-red-400"> · 未收 {formatAmount(summary.receivable - summary.received)}</span>
                )}
              </span>
            </span>
            <Button size="sm" onClick={() => setFeeDialog({ open: true })}>
              <Plus /> 新建期次
            </Button>
          </CardTitle>
        </CardHeader>
        {fees.length === 0 ? (
          <EmptyState icon={Receipt} title="暂无收费期次" description={contract.feeMode.includes('风险') ? '风险代理可在回款后登记提成期次' : '按收费安排登记应收期次与实收'} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>期次</TableHead>
                <TableHead className="text-right">应收金额</TableHead>
                <TableHead>应收日期</TableHead>
                <TableHead className="text-right">实收金额</TableHead>
                <TableHead>收款日期</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>备注</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fees.map((f) => (
                <TableRow key={f.id}>
                  <TableCell className="font-medium text-ink">{f.label}</TableCell>
                  <TableCell className="tnum text-right text-ink-2">{formatAmount(f.amount)}</TableCell>
                  <TableCell className="tnum text-ink-3">{formatDate(f.dueDate)}</TableCell>
                  <TableCell className="tnum text-right text-ink-2">{f.receivedAmount ? formatAmount(f.receivedAmount) : '-'}</TableCell>
                  <TableCell className="tnum text-ink-3">{formatDate(f.receivedAt)}</TableCell>
                  <TableCell><FeeStatusBadge fee={f} /></TableCell>
                  <TableCell className="max-w-[160px]"><span className="block truncate text-xs text-ink-4">{f.note || '-'}</span></TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => setFeeDialog({ open: true, editId: f.id })}>编辑</Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300"
                      mutation
                      onClick={async () => {
                        if (store.canWrite() && await confirmAction(`确定删除期次「${f.label}」？`)) store.dispatch({ type: 'deleteFee', payload: f.id })
                      }}
                    >
                      删除
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* 发票 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            发票
            <Button size="sm" onClick={() => setInvDialog({ open: true })}>
              <Plus /> 登记发票
            </Button>
          </CardTitle>
        </CardHeader>
        {invoices.length === 0 ? (
          <EmptyState icon={Receipt} title="暂无发票记录" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>发票号码</TableHead>
                <TableHead>种类</TableHead>
                <TableHead className="text-right">开票金额</TableHead>
                <TableHead>开票日期</TableHead>
                <TableHead>扫描件</TableHead>
                <TableHead>备注</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell className="tnum font-medium text-ink">{inv.invoiceNo}</TableCell>
                  <TableCell className="text-ink-2">{inv.kind}</TableCell>
                  <TableCell className="tnum text-right text-ink-2">{formatAmount(inv.amount)}</TableCell>
                  <TableCell className="tnum text-ink-3">{formatDate(inv.issuedAt)}</TableCell>
                  <TableCell>
                    <div className="min-w-72">
                      <FilePicker
                        owner={{ type: 'invoice', id: inv.id }}
                        files={inv.files}
                        emptyText="暂无扫描件"
                        compact
                      />
                    </div>
                  </TableCell>
                  <TableCell className="max-w-[160px]"><span className="block truncate text-xs text-ink-4">{inv.note || '-'}</span></TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => setInvDialog({ open: true, editId: inv.id })}>编辑</Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300"
                      mutation
                      onClick={async () => {
                        if (store.canWrite() && await confirmAction(`确定删除发票「${inv.invoiceNo}」？`)) store.dispatch({ type: 'deleteInvoice', payload: inv.id })
                      }}
                    >
                      删除
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <ContractDialog open={editOpen} onClose={() => setEditOpen(false)} contract={contract} />
      <FeeDialog
        open={feeDialog.open}
        onClose={() => setFeeDialog({ open: false })}
        contractId={contract.id}
        fee={feeDialog.editId ? fees.find((f) => f.id === feeDialog.editId) : undefined}
      />
      <InvoiceDialog
        open={invDialog.open}
        onClose={() => setInvDialog({ open: false })}
        contractId={contract.id}
        invoice={invDialog.editId ? invoices.find((i) => i.id === invDialog.editId) : undefined}
      />
    </div>
  )
}
