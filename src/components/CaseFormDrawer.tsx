import { useEffect, useState } from 'react'
import dayjs from 'dayjs'
import type { Case, CaseType, PartySide } from '../types'
import { firstEntryStage, getTemplate, templatesOfType } from '../lib/stageTemplates'
import { useStore } from '../store'
import { Drawer } from './ui/drawer'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Textarea } from './ui/textarea'
import { Select } from './ui/select'
import { FormField } from './ui/label'

const caseTypes: CaseType[] = ['民事', '刑事', '行政', '仲裁', '非诉']

interface Props {
  open: boolean
  onClose: () => void
  /** 传入则为编辑模式 */
  caseData?: Case
  /** 新建成功后的回调（如跳转详情） */
  onSaved?: (c: Case) => void
}

const defaultTemplate = getTemplate('civil-first-instance')!

const emptyForm = {
  caseNumber: '',
  title: '',
  type: '民事' as CaseType,
  templateId: defaultTemplate.id,
  stageId: firstEntryStage(defaultTemplate).id,
  side: defaultTemplate.sides[0] as PartySide,
  clientId: '',
  opposingParty: '',
  court: '',
  judge: '',
  judgePhone: '',
  amount: '',
  acceptedAt: dayjs().format('YYYY-MM-DD'),
  nextDeadline: '',
  note: '',
}

type FormState = typeof emptyForm

export function CaseFormDrawer({ open, onClose, caseData, onSaved }: Props) {
  const { state, dispatch, newId } = useStore()
  const [form, setForm] = useState<FormState>(emptyForm)
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({})

  useEffect(() => {
    if (!open) return
    setErrors({})
    if (caseData) {
      setForm({
        caseNumber: caseData.caseNumber ?? '',
        title: caseData.title,
        type: caseData.type,
        templateId: caseData.templateId,
        stageId: caseData.stageId,
        side: caseData.side,
        clientId: caseData.clientId,
        opposingParty: caseData.opposingParty,
        court: caseData.court,
        judge: caseData.judge,
        judgePhone: caseData.judgePhone,
        amount: caseData.amount ? String(caseData.amount) : '',
        acceptedAt: caseData.acceptedAt,
        nextDeadline: caseData.nextDeadline,
        note: caseData.note,
      })
    } else {
      setForm(emptyForm)
    }
  }, [open, caseData])

  const template = getTemplate(form.templateId)

  const set = (key: keyof FormState, value: string) => {
    setForm((f) => ({ ...f, [key]: value }))
    setErrors((e) => ({ ...e, [key]: undefined }))
  }

  /** 切换案件类型：级联重置为该类型下的第一个模板、默认立场与收案入口阶段 */
  const setType = (type: CaseType) => {
    const t = templatesOfType(type)[0]
    setForm((f) => ({ ...f, type, templateId: t.id, side: t.sides[0], stageId: firstEntryStage(t).id }))
  }

  /** 切换程序模板：立场与当前阶段随之重置 */
  const setTemplate = (templateId: string) => {
    const t = getTemplate(templateId)
    if (!t) return
    setForm((f) => ({ ...f, templateId, side: t.sides[0], stageId: firstEntryStage(t).id }))
  }

  const validate = (): boolean => {
    const e: typeof errors = {}
    if (!form.title.trim()) e.title = '请填写案件名称'
    if (!form.clientId) e.clientId = '请选择委托人'
    if (!form.acceptedAt) e.acceptedAt = '请选择收案日期'
    if (form.amount && (isNaN(Number(form.amount)) || Number(form.amount) < 0)) e.amount = '标的金额需为不小于 0 的数字'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = () => {
    if (!validate()) return
    const payload: Case = {
      id: caseData?.id ?? newId('case'),
      caseNumber: form.caseNumber.trim() || undefined,
      title: form.title.trim(),
      type: form.type,
      templateId: form.templateId,
      stageId: form.stageId,
      side: form.side,
      relatedCaseIds: caseData?.relatedCaseIds ?? [],
      clientId: form.clientId,
      opposingParty: form.opposingParty.trim(),
      court: form.court.trim(),
      judge: form.judge.trim(),
      judgePhone: form.judgePhone.trim(),
      amount: form.amount ? Number(form.amount) : 0,
      acceptedAt: form.acceptedAt,
      nextDeadline: form.nextDeadline || form.acceptedAt,
      note: form.note.trim(),
      files: caseData?.files ?? [],
    }
    if (!dispatch({ type: caseData ? 'updateCase' : 'addCase', payload })) return
    onSaved?.(payload)
    onClose()
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={caseData ? '编辑案件' : '新建案件'}
      description={caseData ? `编辑 ${caseData.caseNumber ?? caseData.title}` : '带 * 为必填项；案号可留空，立案后补录'}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button mutation onClick={handleSubmit}>{caseData ? '保存修改' : '创建案件'}</Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-4">
        <FormField label="案号" error={errors.caseNumber} className="col-span-2">
          <Input
            value={form.caseNumber}
            onChange={(e) => set('caseNumber', e.target.value)}
            placeholder="如 (2025)京0105民初1234号"
            aria-invalid={!!errors.caseNumber}
          />
        </FormField>
        <FormField label="案件名称" required error={errors.title} className="col-span-2">
          <Input
            value={form.title}
            onChange={(e) => set('title', e.target.value)}
            placeholder="如 张三诉李四买卖合同纠纷"
            aria-invalid={!!errors.title}
          />
        </FormField>
        <FormField label="案件类型" required>
          <Select value={form.type} onChange={(e) => setType(e.target.value as CaseType)}>
            {caseTypes.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </Select>
        </FormField>
        <FormField label="程序模板" required>
          <Select value={form.templateId} onChange={(e) => setTemplate(e.target.value)}>
            {templatesOfType(form.type).map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </Select>
        </FormField>
        <FormField label="代理立场" required>
          <Select value={form.side} onChange={(e) => set('side', e.target.value)}>
            {(template?.sides ?? []).map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </Select>
        </FormField>
        <FormField label="当前阶段" required>
          <Select value={form.stageId} onChange={(e) => set('stageId', e.target.value)}>
            {(caseData ? (template?.stages ?? []) : (template?.stages ?? []).filter((s) => s.entry)).map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </Select>
        </FormField>
        <FormField label="委托人" required error={errors.clientId} className="col-span-2">
          <Select value={form.clientId} onChange={(e) => set('clientId', e.target.value)}>
            <option value="">请选择客户</option>
            {state.clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}（{c.type}）
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="对方当事人" className="col-span-2">
          <Input value={form.opposingParty} onChange={(e) => set('opposingParty', e.target.value)} placeholder="姓名 / 单位名称" />
        </FormField>
        <FormField label="受理法院 / 仲裁委" className="col-span-2">
          <Input value={form.court} onChange={(e) => set('court', e.target.value)} placeholder="如 北京市朝阳区人民法院" />
        </FormField>
        <FormField label="承办法官 / 仲裁员">
          <Input value={form.judge} onChange={(e) => set('judge', e.target.value)} />
        </FormField>
        <FormField label="联系方式">
          <Input value={form.judgePhone} onChange={(e) => set('judgePhone', e.target.value)} placeholder="办公电话" />
        </FormField>
        <FormField label="标的金额（元）" error={errors.amount}>
          <Input
            value={form.amount}
            onChange={(e) => set('amount', e.target.value)}
            inputMode="numeric"
            placeholder="如 860000"
            aria-invalid={!!errors.amount}
          />
        </FormField>
        <FormField label="收案日期" required error={errors.acceptedAt}>
          <Input type="date" value={form.acceptedAt} onChange={(e) => set('acceptedAt', e.target.value)} aria-invalid={!!errors.acceptedAt} />
        </FormField>
        <FormField label="下次关键节点" className="col-span-2">
          <Input type="date" value={form.nextDeadline} onChange={(e) => set('nextDeadline', e.target.value)} />
        </FormField>
        <FormField label="备注" className="col-span-2">
          <Textarea value={form.note} onChange={(e) => set('note', e.target.value)} placeholder="办案要点、注意事项等" rows={3} />
        </FormField>
      </div>
    </Drawer>
  )
}
