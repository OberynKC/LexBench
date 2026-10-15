import { useEffect, useState } from 'react'
import type { Client } from '../types'
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
  onSaved?: (c: Client) => void
  /** 传入则为编辑模式 */
  client?: Client
}

export function ClientDialog({ open, onClose, onSaved, client }: Props) {
  const { dispatch, newId } = useStore()
  const empty = { name: '', type: '个人' as Client['type'], phone: '', email: '', address: '', note: '' }
  const [form, setForm] = useState(empty)
  const [errors, setErrors] = useState<{ name?: string; email?: string }>({})

  useEffect(() => {
    if (open) {
      setForm(
        client
          ? { name: client.name, type: client.type, phone: client.phone, email: client.email, address: client.address, note: client.note }
          : empty,
      )
      setErrors({})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, client])

  const handleSubmit = () => {
    const e: typeof errors = {}
    if (!form.name.trim()) e.name = '请填写姓名 / 名称'
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = '邮箱格式不正确'
    setErrors(e)
    if (Object.keys(e).length > 0) return
    const payload: Client = { id: client?.id ?? newId('cli'), ...form, name: form.name.trim() }
    if (!dispatch({ type: client ? 'updateClient' : 'addClient', payload })) return
    onSaved?.(payload)
    onClose()
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={client ? '编辑客户' : '新建客户'}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>取消</Button>
          <Button mutation onClick={handleSubmit}>{client ? '保存修改' : '创建客户'}</Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-4">
        <FormField label="姓名 / 名称" required error={errors.name}>
          <Input value={form.name} onChange={(e) => { setForm((f) => ({ ...f, name: e.target.value })); setErrors((er) => ({ ...er, name: undefined })) }} aria-invalid={!!errors.name} />
        </FormField>
        <FormField label="类型">
          <Select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as Client['type'] }))}>
            <option value="个人">个人</option>
            <option value="企业">企业</option>
          </Select>
        </FormField>
        <FormField label="电话">
          <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
        </FormField>
        <FormField label="邮箱" error={errors.email}>
          <Input value={form.email} onChange={(e) => { setForm((f) => ({ ...f, email: e.target.value })); setErrors((er) => ({ ...er, email: undefined })) }} aria-invalid={!!errors.email} />
        </FormField>
        <FormField label="地址" className="col-span-2">
          <Input value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
        </FormField>
        <FormField label="备注" className="col-span-2">
          <Textarea value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} rows={2} />
        </FormField>
      </div>
    </Dialog>
  )
}
