import { useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { FileText, Plus, Search } from 'lucide-react'
import type { Contract } from '../types'
import { useStore } from '../store'
import { formatAmount } from '../lib/utils'
import { contractDisplayName } from '../lib/contractName'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Select } from '../components/ui/select'
import { Card } from '../components/ui/card'
import { EmptyState } from '../components/ui/empty-state'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table'
import { ContractStatusBadge } from '../components/badges'
import { ContractDialog } from '../components/ContractDialog'

export default function Contracts() {
  const store = useStore()
  const navigate = useNavigate()
  const location = useLocation()
  const [keyword, setKeyword] = useState('')
  const [clientFilter, setClientFilter] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)

  const contractName = (contract: Contract) => contractDisplayName(contract, store.getCase, store.getClient)

  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase()
    return sortBySignedAtDesc(
      store.state.contracts.filter((contract) => {
        if (clientFilter && contract.clientId !== clientFilter) return false
        if (!kw) return true
        const clientName = store.getClient(contract.clientId)?.name ?? ''
        const caseNames = contract.caseIds.map((id) => store.getCase(id)?.title ?? '').join(' ')
        return [contractName(contract), contract.contractNo, clientName, caseNames]
          .some((value) => value.toLowerCase().includes(kw))
      }),
    )
  }, [clientFilter, keyword, store])

  return (
    <div className="space-y-3 p-5">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-4" />
          <Input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="搜索合同名称 / 编号"
            className="w-56 pl-8"
          />
        </div>
        <Select value={clientFilter} onChange={(event) => setClientFilter(event.target.value)} className="w-48">
          <option value="">全部客户</option>
          {store.state.clients.map((client) => (
            <option key={client.id} value={client.id}>{client.name}</option>
          ))}
        </Select>
        <span className="text-xs text-ink-3 tnum">共 {filtered.length} 份合同</span>
        <div className="ml-auto">
          <Button size="sm" onClick={() => setDialogOpen(true)}>
            <Plus /> 新建合同
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden">
        {filtered.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="没有符合条件的合同"
            description="调整筛选条件，或新建一份委托代理合同"
            action={<Button size="sm" onClick={() => setDialogOpen(true)}><Plus /> 新建合同</Button>}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>合同名称 / 编号</TableHead>
                <TableHead>所属客户</TableHead>
                <TableHead>关联案件</TableHead>
                <TableHead className="text-right">总金额</TableHead>
                <TableHead className="text-right">收费进度（已收 / 应收）</TableHead>
                <TableHead>状态</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((contract) => {
                const client = store.getClient(contract.clientId)
                const linkedCases = contract.caseIds
                  .map((id) => store.getCase(id))
                  .filter((value) => value !== undefined)
                const summary = store.feeSummary(contract.id)

                return (
                  <TableRow key={contract.id} className="cursor-pointer" onClick={() => navigate(`/contracts/${contract.id}`, { state: { contractReturnTo: location.pathname + location.search } })}>
                    <TableCell className="max-w-[300px]">
                      <span className="block truncate font-medium text-ink">{contractName(contract)}</span>
                      <span className="tnum block truncate font-mono text-[11px] text-ink-4">{contract.contractNo}</span>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {client ? (
                        <Link
                          to={`/clients/${client.id}`}
                          className="font-medium text-navy-700 hover:underline dark:text-navy-300"
                          onClick={(event) => event.stopPropagation()}
                        >
                          {client.name}
                        </Link>
                      ) : (
                        <span className="text-ink-4">客户已删除</span>
                      )}
                    </TableCell>
                    <TableCell className="min-w-56 max-w-[360px]">
                      {linkedCases.length === 0 ? (
                        <span className="text-ink-4">未关联案件</span>
                      ) : (
                        <div className="flex flex-wrap gap-x-3 gap-y-1">
                          {linkedCases.map((caseItem) => (
                            <Link
                              key={caseItem.id}
                              to={`/cases/${caseItem.id}`}
                              className="max-w-64 truncate text-navy-700 hover:underline dark:text-navy-300"
                              title={caseItem.caseNumber ? `${caseItem.title}（${caseItem.caseNumber}）` : caseItem.title}
                              onClick={(event) => event.stopPropagation()}
                            >
                              {caseItem.title}
                            </Link>
                          ))}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="tnum whitespace-nowrap text-right font-medium text-ink">
                      {formatAmount(contract.totalFee)}
                    </TableCell>
                    <TableCell className="tnum whitespace-nowrap text-right text-ink-2">
                      <span className="font-medium text-emerald-600 dark:text-emerald-400">{formatAmount(summary.received)}</span>
                      {' / '}{formatAmount(summary.receivable)}
                    </TableCell>
                    <TableCell><ContractStatusBadge status={contract.status} /></TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      <ContractDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSaved={(contract) => navigate(`/contracts/${contract.id}`, { state: { contractReturnTo: location.pathname + location.search } })}
      />
    </div>
  )
}

function sortBySignedAtDesc(contracts: Contract[]): Contract[] {
  return [...contracts].sort((a, b) => b.signedAt.localeCompare(a.signedAt))
}
