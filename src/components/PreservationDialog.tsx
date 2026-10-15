import { useEffect, useState } from 'react'
import type { Preservation, PreservationStatus, PreservationType } from '../types'
import { useStore } from '../store'
import { Dialog } from './ui/dialog'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Textarea } from './ui/textarea'
import { Select } from './ui/select'
import { FormField } from './ui/label'

const types: PreservationType[] = ['财产保全', '行为保全', '证据保全', '先予执行', '查封扣押']
/** 存储状态（人工维护）；临期 / 超期由到期日自动派生，不在此处选择 */
const statuses: PreservationStatus[] = ['申请', '生效', '结束']

interface Props {
  open: boolean
  onClose: () => void
  caseId?: string
  /** 传入则为编辑模式 */
  preservation?: Preservation
}

export function PreservationDialog({ open, onClose, caseId, preservation }: Props) {
  const { state, dispatch, newId } = useStore()
  const [form, setForm] = useState({
    caseId: caseId ?? '',
    type: '财产保全' as PreservationType,
    deadline: '',
    status: '申请' as PreservationStatus,
    note: '',
  })
  const [errors, setErrors] = useState<{ caseId?: string; deadline?: string }>({})

  useEffect(() => {
    if (!open) return
    setErrors({})
    if (preservation) {
      setForm({
        caseId: preservation.caseId,
        type: preservation.type,
        deadline: preservation.deadline ?? '',
        status: preservation.status,
        note: preservation.note,
      })
    } else {
      setForm({
        caseId: caseId ?? '',
        type: '财产保全',
        deadline: '',
        status: '申请',
        note: '',
      })
    }
  }, [open, caseId, preservation])

  const handleSubmit = () => {
    const e: typeof errors = {}
    if (!form.caseId) e.caseId = '请选择所属案件'
    if (form.status === '生效' && !form.deadline) e.deadline = '措施已生效，请填写到期日'
    setErrors(e)
    if (Object.keys(e).length > 0) return

    const payload: Preservation = {
      id: preservation?.id ?? newId('prv'),
      caseId: form.caseId,
      type: form.type,
      deadline: form.deadline || null,
      status: form.status,
      note: form.note.trim(),
    }
    if (!dispatch({ type: preservation ? 'updatePreservation' : 'addPreservation', payload })) return
    onClose()
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={preservation ? '编辑保全 / 执行记录' : '新建保全 / 执行记录'}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button mutation onClick={handleSubmit}>{preservation ? '保存修改' : '创建记录'}</Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-4">
        <FormField label="所属案件" required error={errors.caseId} className="col-span-2">
          <Select value={form.caseId} onChange={(e) => { setForm((f) => ({ ...f, caseId: e.target.value })); setErrors((er) => ({ ...er, caseId: undefined })) }}>
            <option value="">请选择案件</option>
            {state.cases.map((c) => (
              <option key={c.id} value={c.id}>{c.title}</option>
            ))}
          </Select>
        </FormField>
        <FormField label="类型">
          <Select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as PreservationType }))}>
            {types.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </Select>
        </FormField>
        <FormField label="进展状态">
          <Select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as PreservationStatus }))}>
            {statuses.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </Select>
          <p className="text-xs text-ink-3">生效后按到期日自动进入临期（≤60 天）/ 超期</p>
        </FormField>
        <FormField label="保全 / 执行到期日" required={form.status === '生效'} error={errors.deadline} className="col-span-2">
          <Input type="date" value={form.deadline} onChange={(e) => { setForm((f) => ({ ...f, deadline: e.target.value })); setErrors((er) => ({ ...er, deadline: undefined })) }} />
          {form.status !== '生效' && <p className="text-xs text-ink-3">申请阶段或无固定期限的措施可留空</p>}
        </FormField>
        <FormField label="备注" className="col-span-2">
          <Textarea value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} rows={3} placeholder="进展说明、待办事项等" />
        </FormField>
      </div>
    </Dialog>
  )
}
