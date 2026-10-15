import { useEffect, useState } from 'react'
import dayjs from 'dayjs'
import type { Invoice } from '../types'
import { useStore } from '../store'
import { Dialog } from './ui/dialog'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Textarea } from './ui/textarea'
import { Select } from './ui/select'
import { FormField } from './ui/label'

interface Props {
  open: boolean
  onClose: () => void
  contractId: string
  /** 传入则为编辑模式 */
  invoice?: Invoice
}

export function InvoiceDialog({ open, onClose, contractId, invoice }: Props) {
  const { dispatch, newId } = useStore()
  const [form, setForm] = useState({
    invoiceNo: '',
    kind: '增值税普通发票' as Invoice['kind'],
    amount: '',
    issuedAt: dayjs().format('YYYY-MM-DD'),
    note: '',
  })
  const [errors, setErrors] = useState<{ invoiceNo?: string; amount?: string }>({})

  useEffect(() => {
    if (!open) return
    setErrors({})
    setForm(
      invoice
        ? { invoiceNo: invoice.invoiceNo, kind: invoice.kind, amount: String(invoice.amount || ''), issuedAt: invoice.issuedAt, note: invoice.note }
        : { invoiceNo: '', kind: '增值税普通发票', amount: '', issuedAt: dayjs().format('YYYY-MM-DD'), note: '' },
    )
  }, [open, invoice])

  const handleSubmit = () => {
    const e: typeof errors = {}
    if (!form.invoiceNo.trim()) e.invoiceNo = '请填写发票号码'
    const amount = Number(form.amount)
    if (form.amount === '' || !Number.isFinite(amount) || amount <= 0) e.amount = '请填写有效的开票金额'
    setErrors(e)
    if (Object.keys(e).length > 0) return

    const payload: Invoice = {
      id: invoice?.id ?? newId('inv'),
      contractId,
      invoiceNo: form.invoiceNo.trim(),
      kind: form.kind,
      amount,
      issuedAt: form.issuedAt,
      files: invoice?.files ?? [],
      note: form.note.trim(),
    }
    if (!dispatch({ type: invoice ? 'updateInvoice' : 'addInvoice', payload })) return
    onClose()
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={invoice ? '编辑发票' : '登记发票'}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>取消</Button>
          <Button mutation onClick={handleSubmit}>{invoice ? '保存修改' : '登记发票'}</Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-4">
        <FormField label="发票号码" required error={errors.invoiceNo}>
          <Input value={form.invoiceNo} onChange={(e) => { setForm((f) => ({ ...f, invoiceNo: e.target.value })); setErrors((er) => ({ ...er, invoiceNo: undefined })) }} aria-invalid={!!errors.invoiceNo} />
        </FormField>
        <FormField label="发票种类">
          <Select value={form.kind} onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value as Invoice['kind'] }))}>
            <option value="增值税普通发票">增值税普通发票</option>
            <option value="增值税专用发票">增值税专用发票</option>
          </Select>
        </FormField>
        <FormField label="开票金额（元）" required error={errors.amount}>
          <Input type="number" min={0} value={form.amount} onChange={(e) => { setForm((f) => ({ ...f, amount: e.target.value })); setErrors((er) => ({ ...er, amount: undefined })) }} aria-invalid={!!errors.amount} />
        </FormField>
        <FormField label="开票日期">
          <Input type="date" value={form.issuedAt} onChange={(e) => setForm((f) => ({ ...f, issuedAt: e.target.value }))} />
        </FormField>
        <FormField label="备注" className="col-span-2">
          <Textarea value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} rows={2} placeholder="寄送情况、对应收款期次等" />
        </FormField>
      </div>
    </Dialog>
  )
}
