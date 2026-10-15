import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Users } from 'lucide-react'
import { useStore } from '../store'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Badge } from '../components/ui/badge'
import { EmptyState } from '../components/ui/empty-state'
import { Card } from '../components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table'
import { ClientDialog } from '../components/ClientDialog'

export default function Clients() {
  const { state, casesOfClient } = useStore()
  const navigate = useNavigate()
  const [keyword, setKeyword] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)

  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase()
    if (!kw) return state.clients
    return state.clients.filter((c) => c.name.toLowerCase().includes(kw) || c.phone.includes(kw))
  }, [state.clients, keyword])

  return (
    <div className="space-y-3 p-5">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-4" />
          <Input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="搜索客户名称 / 电话" className="w-56 pl-8" />
        </div>
        <span className="text-xs text-ink-3 tnum">共 {filtered.length} 位客户</span>
        <div className="ml-auto">
          <Button size="sm" onClick={() => setDialogOpen(true)}>
            <Plus /> 新建客户
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden">
        {filtered.length === 0 ? (
          <EmptyState
            icon={Users}
            title="没有匹配的客户"
            action={<Button size="sm" onClick={() => setDialogOpen(true)}><Plus /> 新建客户</Button>}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>名称</TableHead>
                <TableHead>类型</TableHead>
                <TableHead>电话</TableHead>
                <TableHead>邮箱</TableHead>
                <TableHead className="text-center">名下案件</TableHead>
                <TableHead>备注</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((c) => {
                const count = casesOfClient(c.id).length
                return (
                  <TableRow key={c.id} className="cursor-pointer" onClick={() => navigate(`/clients/${c.id}`)}>
                    <TableCell className="font-medium text-ink">{c.name}</TableCell>
                    <TableCell>
                      <Badge variant={c.type === '企业' ? 'blue' : 'gray'}>{c.type}</Badge>
                    </TableCell>
                    <TableCell className="tnum text-ink-2">{c.phone || '-'}</TableCell>
                    <TableCell className="text-ink-2">{c.email || '-'}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary">{count} 件</Badge>
                    </TableCell>
                    <TableCell className="max-w-[200px]"><span className="block truncate text-xs text-ink-4">{c.note || '-'}</span></TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      <ClientDialog open={dialogOpen} onClose={() => setDialogOpen(false)} onSaved={(c) => navigate(`/clients/${c.id}`)} />
    </div>
  )
}
