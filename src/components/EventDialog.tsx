import { confirmAction } from '../lib/dialogs'
import { useEffect, useState } from 'react'
import dayjs from 'dayjs'
import type { CalendarEvent, EventType } from '../types'
import { useStore } from '../store'
import { Dialog } from './ui/dialog'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Select } from './ui/select'
import { FormField } from './ui/label'

const eventTypes: EventType[] = ['开庭', '会见', '截止期限', '其他']

interface Props {
  open: boolean
  onClose: () => void
  /** 预选关联案件 */
  defaultCaseId?: string
  /** 预选日期（YYYY-MM-DD） */
  defaultDate?: string
  /** 传入则为编辑模式（仅手工事件可编辑；联动事件由调用方拦截） */
  event?: CalendarEvent
}

export function EventDialog({ open, onClose, defaultCaseId, defaultDate, event }: Props) {
  const { state, dispatch, newId, canWrite } = useStore()
  const base = event ? { start: dayjs(event.start).format('YYYY-MM-DDTHH:mm'), end: dayjs(event.end).format('YYYY-MM-DDTHH:mm') }
    : { start: `${defaultDate ?? dayjs().format('YYYY-MM-DD')}T09:00`, end: `${defaultDate ?? dayjs().format('YYYY-MM-DD')}T10:00` }

  const empty = event
    ? {
        title: event.title,
        type: event.type,
        caseId: event.caseId ?? '',
        start: base.start,
        end: base.end,
        location: event.location,
        reminder: event.reminder,
      }
    : {
        title: '',
        type: '开庭' as EventType,
        caseId: defaultCaseId ?? '',
        start: base.start,
        end: base.end,
        location: '',
        reminder: '提前 1 天',
      }
  const [form, setForm] = useState(empty)
  const [errors, setErrors] = useState<{ title?: string; start?: string; end?: string }>({})

  useEffect(() => {
    if (open) {
      setForm(empty)
      setErrors({})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, event])

  const set = (key: keyof typeof empty, value: string) => {
    setForm((f) => ({ ...f, [key]: value }))
    setErrors((e) => ({ ...e, [key]: undefined }))
  }

  const handleSubmit = () => {
    const e: typeof errors = {}
    if (!form.title.trim()) e.title = '请填写事件标题'
    if (!form.start) e.start = '请选择开始时间'
    if (!form.end) e.end = '请选择结束时间'
    else if (form.start && dayjs(form.end).isBefore(dayjs(form.start))) e.end = '结束时间不能早于开始时间'
    setErrors(e)
    if (Object.keys(e).length > 0) return

    // 手工事件不允许绑定 todoId；联动事件由调用方拦截，不会进入此弹窗
    const payload: CalendarEvent = {
      id: event?.id ?? newId('evt'),
      title: form.title.trim(),
      type: form.type,
      caseId: form.caseId || null,
      start: dayjs(form.start).toISOString(),
      end: dayjs(form.end).toISOString(),
      location: form.location.trim(),
      reminder: form.reminder,
    }
    if (!dispatch({ type: event ? 'updateEvent' : 'addEvent', payload })) return
    onClose()
  }

  const handleDelete = async () => {
    if (!event || !canWrite()) return
    if (!await confirmAction(`确定删除日程「${event.title}」吗？`)) return
    if (!dispatch({ type: 'deleteEvent', payload: event.id })) return
    onClose()
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={event ? '编辑日程' : '新建日程'}
      description="带 * 为必填项"
      footer={
        <>
          {event && (
            <Button mutation variant="outline" className="mr-auto text-red-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/50" onClick={handleDelete}>
              删除
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button mutation onClick={handleSubmit}>{event ? '保存修改' : '创建事件'}</Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-4">
        <FormField label="标题" required error={errors.title} className="col-span-2">
          <Input value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="如 某案开庭 / 会见当事人" aria-invalid={!!errors.title} />
        </FormField>
        <FormField label="类型">
          <Select value={form.type} onChange={(e) => set('type', e.target.value)}>
            {eventTypes.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </Select>
        </FormField>
        <FormField label="关联案件">
          <Select value={form.caseId} onChange={(e) => set('caseId', e.target.value)}>
            <option value="">不关联</option>
            {state.cases.map((c) => (
              <option key={c.id} value={c.id}>{c.title}</option>
            ))}
          </Select>
        </FormField>
        <FormField label="开始时间" required error={errors.start}>
          <Input type="datetime-local" value={form.start} onChange={(e) => set('start', e.target.value)} aria-invalid={!!errors.start} />
        </FormField>
        <FormField label="结束时间" required error={errors.end}>
          <Input type="datetime-local" value={form.end} onChange={(e) => set('end', e.target.value)} aria-invalid={!!errors.end} />
        </FormField>
        <FormField label="地点" className="col-span-2">
          <Input value={form.location} onChange={(e) => set('location', e.target.value)} placeholder="如 朝阳法院第 8 法庭" />
        </FormField>
        <FormField label="提醒" className="col-span-2">
          <Select value={form.reminder} onChange={(e) => set('reminder', e.target.value)}>
            {['不提醒', '提前 15 分钟', '提前 30 分钟', '提前 1 天', '提前 3 天'].map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </Select>
        </FormField>
      </div>
    </Dialog>
  )
}
