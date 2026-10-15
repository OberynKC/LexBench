import { useEffect, useMemo, useState } from 'react'
import dayjs from 'dayjs'
import type { Contract, ContractStatus, FeeMode } from '../types'
import { useStore } from '../store'
import { Dialog } from './ui/dialog'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Textarea } from './ui/textarea'
import { Select } from './ui/select'
import { FormField } from './ui/label'

const feeModes: FeeMode[] = ['固定收费', '风险代理', '半风险代理', '计时收费']
const statuses: ContractStatus[] = ['履行中', '已完结', '已解除']

interface Props {
  open: boolean
  onClose: () => void
  onSaved?: (c: Contract) => void
  /** 传入则为编辑模式 */
  contract?: Contract
  /** 从客户详情页进入时锁定委托人；不传则显示可选的客户下拉框 */
  fixedClientId?: string
  /** 从案件详情页进入时预选该案件（并将其委托人作为默认委托人） */
  preselectCaseId?: string
}

export function ContractDialog({ open, onClose, onSaved, contract, fixedClientId, preselectCaseId }: Props) {
  const { state, dispatch, newId } = useStore()
  const preselectCase = preselectCaseId ? state.cases.find((c) => c.id === preselectCaseId) : undefined
  const lockedClientId = fixedClientId ?? contract?.clientId ?? preselectCase?.clientId

  const [form, setForm] = useState({
    contractNo: '',
    clientId: '',
    caseIds: [] as string[],
    signedAt: dayjs().format('YYYY-MM-DD'),
    feeMode: '固定收费' as FeeMode,
    totalFee: '',
    status: '履行中' as ContractStatus,
    note: '',
  })
  const [showAllCases, setShowAllCases] = useState(false)
  const [errors, setErrors] = useState<{ contractNo?: string; clientId?: string; totalFee?: string }>({})

  useEffect(() => {
    if (!open) return
    setErrors({})
    setShowAllCases(false)
    if (contract) {
      setForm({
        contractNo: contract.contractNo,
        clientId: contract.clientId,
        caseIds: contract.caseIds,
        signedAt: contract.signedAt,
        feeMode: contract.feeMode,
        totalFee: String(contract.totalFee || ''),
        status: contract.status,
        note: contract.note,
      })
    } else {
      setForm({
        contractNo: '',
        clientId: lockedClientId ?? '',
        caseIds: preselectCaseId ? [preselectCaseId] : [],
        signedAt: dayjs().format('YYYY-MM-DD'),
        feeMode: '固定收费',
        totalFee: '',
        status: '履行中',
        note: '',
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, contract, fixedClientId, preselectCaseId])

  // 默认只列出当前委托人名下案件；切换「显示全部案件」后可跨客户勾选（如实务中的代付 / 集团主体）
  const visibleCases = useMemo(
    () => (showAllCases ? state.cases : state.cases.filter((c) => c.clientId === form.clientId)),
    [state.cases, showAllCases, form.clientId],
  )
  const hiddenCheckedCount = form.caseIds.filter((id) => !visibleCases.some((c) => c.id === id)).length

  const toggleCase = (caseId: string) =>
    setForm((f) => ({
      ...f,
      caseIds: f.caseIds.includes(caseId) ? f.caseIds.filter((id) => id !== caseId) : [...f.caseIds, caseId],
    }))

  const handleSubmit = () => {
    const e: typeof errors = {}
    if (!form.contractNo.trim()) e.contractNo = '请填写合同编号'
    if (!form.clientId) e.clientId = '请选择委托人'
    const fee = Number(form.totalFee)
    if (form.totalFee === '' || !Number.isFinite(fee) || fee < 0) e.totalFee = '请填写有效的律师费金额'
    setErrors(e)
    if (Object.keys(e).length > 0) return

    const payload: Contract = {
      id: contract?.id ?? newId('ct'),
      contractNo: form.contractNo.trim(),
      clientId: form.clientId,
      caseIds: form.caseIds,
      signedAt: form.signedAt,
      feeMode: form.feeMode,
      totalFee: fee,
      status: form.status,
      files: contract?.files ?? [],
      note: form.note.trim(),
    }
    if (!dispatch({ type: contract ? 'updateContract' : 'addContract', payload })) return
    onSaved?.(payload)
    onClose()
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={contract ? '编辑委托代理合同' : '新建委托代理合同'}
      className="max-w-xl"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>取消</Button>
          <Button mutation onClick={handleSubmit}>{contract ? '保存修改' : '创建合同'}</Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-4">
        <FormField label="合同编号" required error={errors.contractNo}>
          <Input value={form.contractNo} onChange={(e) => { setForm((f) => ({ ...f, contractNo: e.target.value })); setErrors((er) => ({ ...er, contractNo: undefined })) }} placeholder="如 (2025)律民代字第018号" aria-invalid={!!errors.contractNo} />
        </FormField>
        <FormField label="委托人" required error={errors.clientId}>
          <Select
            value={form.clientId}
            disabled={!!lockedClientId}
            onChange={(e) => { setForm((f) => ({ ...f, clientId: e.target.value })); setErrors((er) => ({ ...er, clientId: undefined })) }}
          >
            <option value="">请选择客户</option>
            {state.clients.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
        </FormField>
        <FormField label="签约日期">
          <Input type="date" value={form.signedAt} onChange={(e) => setForm((f) => ({ ...f, signedAt: e.target.value }))} />
        </FormField>
        <FormField label="收费方式">
          <Select value={form.feeMode} onChange={(e) => setForm((f) => ({ ...f, feeMode: e.target.value as FeeMode }))}>
            {feeModes.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </Select>
        </FormField>
        <FormField label="约定律师费（元）" required error={errors.totalFee}>
          <Input type="number" min={0} value={form.totalFee} onChange={(e) => { setForm((f) => ({ ...f, totalFee: e.target.value })); setErrors((er) => ({ ...er, totalFee: undefined })) }} aria-invalid={!!errors.totalFee} />
        </FormField>
        <FormField label="合同状态">
          <Select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as ContractStatus }))}>
            {statuses.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </Select>
        </FormField>

        <FormField label="关联案件（可多选）" className="col-span-2">
          <div className="rounded-md border border-line-2">
            <div className="max-h-36 space-y-1 overflow-y-auto p-2">
              {visibleCases.length === 0 && (
                <p className="px-1 py-2 text-xs text-ink-3">该客户名下暂无案件，可勾选下方「显示全部案件」</p>
              )}
              {visibleCases.map((c) => (
                <label key={c.id} className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm transition-colors hover:bg-hover">
                  <input type="checkbox" checked={form.caseIds.includes(c.id)} onChange={() => toggleCase(c.id)} className="h-3.5 w-3.5 accent-navy-700" />
                  <span className="min-w-0 flex-1 truncate text-ink-2">{c.title}</span>
                  <span className="tnum shrink-0 font-mono text-[11px] text-ink-4">{c.caseNumber || '暂无案号'}</span>
                </label>
              ))}
            </div>
            <div className="flex items-center justify-between border-t border-line-1 px-2 py-1.5">
              <label className="flex cursor-pointer items-center gap-1.5 text-xs text-ink-3">
                <input type="checkbox" checked={showAllCases} onChange={(e) => setShowAllCases(e.target.checked)} className="h-3 w-3 accent-navy-700" />
                显示全部案件
              </label>
              <span className="text-xs text-ink-3">
                已选 {form.caseIds.length} 件{hiddenCheckedCount > 0 && `（${hiddenCheckedCount} 件不在当前列表）`}
              </span>
            </div>
          </div>
        </FormField>

        <FormField label="备注" className="col-span-2">
          <Textarea value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} rows={2} placeholder="收费安排、风险告知等" />
        </FormField>
      </div>
    </Dialog>
  )
}
