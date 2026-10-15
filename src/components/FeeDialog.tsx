import { useEffect, useState } from 'react'
import dayjs from 'dayjs'
import type { FeeRecord } from '../types'
import { useStore } from '../store'
import { Dialog } from './ui/dialog'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Textarea } from './ui/textarea'
import { FormField } from './ui/label'

interface Props {
  open: boolean
  onClose: () => void
  contractId: string
  /** 传入则为编辑模式 */
  fee?: FeeRecord
}

export function FeeDialog({ open, onClose, contractId, fee }: Props) {
  const { dispatch, newId } = useStore()
  const [form, setForm] = useState({
    label: '',
    amount: '',
    dueDate: dayjs().format('YYYY-MM-DD'),
    receivedAmount: '',
    receivedAt: '',
    note: '',
  })
  const [errors, setErrors] = useState<{ label?: string; amount?: string; receivedAmount?: string }>({})

  useEffect(() => {
    if (!open) return
    setErrors({})
    setForm(
      fee
        ? {
            label: fee.label,
            amount: String(fee.amount || ''),
            dueDate: fee.dueDate,
            receivedAmount: fee.receivedAmount ? String(fee.receivedAmount) : '',
            receivedAt: fee.receivedAt,
            note: fee.note,
          }
        : { label: '', amount: '', dueDate: dayjs().format('YYYY-MM-DD'), receivedAmount: '', receivedAt: '', note: '' },
    )
  }, [open, fee])

  const handleSubmit = () => {
    const e: typeof errors = {}
    if (!form.label.trim()) e.label = '请填写期次名称'
    const amount = Number(form.amount)
    if (form.amount === '' || !Number.isFinite(amount) || amount < 0) e.amount = '请填写有效的应收金额'
    const received = form.receivedAmount === '' ? 0 : Number(form.receivedAmount)
    if (!Number.isFinite(received) || received < 0) e.receivedAmount = '请填写有效的实收金额'
    setErrors(e)
    if (Object.keys(e).length > 0) return

    const payload: FeeRecord = {
      id: fee?.id ?? newId('fee'),
      contractId,
      label: form.label.trim(),
      amount,
      dueDate: form.dueDate,
      receivedAmount: received,
      receivedAt: received > 0 ? form.receivedAt || dayjs().format('YYYY-MM-DD') : '',
      note: form.note.trim(),
    }
    if (!dispatch({ type: fee ? 'updateFee' : 'addFee', payload })) return
    onClose()
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={fee ? '编辑收费期次' : '新建收费期次'}
      description="一行对应一个收费期次；实收小于应收即显示为部分收 / 未收"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>取消</Button>
          <Button mutation onClick={handleSubmit}>{fee ? '保存修改' : '创建期次'}</Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-4">
        <FormField label="期次名称" required error={errors.label}>
          <Input value={form.label} onChange={(e) => { setForm((f) => ({ ...f, label: e.target.value })); setErrors((er) => ({ ...er, label: undefined })) }} placeholder="如 首期款 / 尾款 / 风险提成" aria-invalid={!!errors.label} />
        </FormField>
        <FormField label="应收日期">
          <Input type="date" value={form.dueDate} onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))} />
        </FormField>
        <FormField label="应收金额（元）" required error={errors.amount}>
          <Input type="number" min={0} value={form.amount} onChange={(e) => { setForm((f) => ({ ...f, amount: e.target.value })); setErrors((er) => ({ ...er, amount: undefined })) }} aria-invalid={!!errors.amount} />
        </FormField>
        <FormField label="实收金额（元）" error={errors.receivedAmount}>
          <Input type="number" min={0} value={form.receivedAmount} onChange={(e) => { setForm((f) => ({ ...f, receivedAmount: e.target.value })); setErrors((er) => ({ ...er, receivedAmount: undefined })) }} placeholder="未收款留空" aria-invalid={!!errors.receivedAmount} />
        </FormField>
        <FormField label="收款日期" className="col-span-2">
          <Input type="date" value={form.receivedAt} onChange={(e) => setForm((f) => ({ ...f, receivedAt: e.target.value }))} />
        </FormField>
        <FormField label="备注" className="col-span-2">
          <Textarea value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} rows={2} placeholder="到账方式、分批说明等" />
        </FormField>
      </div>
    </Dialog>
  )
}
