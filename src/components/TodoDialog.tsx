import { useEffect, useState } from 'react'
import type { Todo } from '../types'
import { useStore } from '../store'
import { Dialog } from './ui/dialog'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Select } from './ui/select'
import { FormField } from './ui/label'

interface Props {
  open: boolean
  onClose: () => void
  /** 传入则强制关联该案件（下拉禁用），如案件详情页入口 */
  fixedCaseId?: string
  /** 传入则为编辑模式 */
  todo?: Todo
}

export function TodoDialog({ open, onClose, fixedCaseId, todo }: Props) {
  const { state, dispatch, newId, now } = useStore()
  const [form, setForm] = useState({ title: '', caseId: '', deadline: '' })
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setError('')
    if (todo) {
      setForm({ title: todo.title, caseId: todo.caseId ?? '', deadline: todo.deadline ?? '' })
    } else {
      setForm({ title: '', caseId: fixedCaseId ?? '', deadline: '' })
    }
  }, [open, todo, fixedCaseId])

  const handleSubmit = () => {
    if (!form.title.trim()) {
      setError('请填写待办标题')
      return
    }
    const base: Todo = todo ?? {
      id: newId('todo'),
      done: false,
      createdAt: now(),
      title: '',
      caseId: null,
      deadline: null,
    }
    const payload: Todo = {
      ...base,
      title: form.title.trim(),
      caseId: fixedCaseId ?? (form.caseId || null),
      deadline: form.deadline || null,
    }
    // 设定期限的待办会在 store 内自动生成/更新一条「截止期限」日程事件
    if (!dispatch({ type: todo ? 'updateTodo' : 'addTodo', payload })) return
    onClose()
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={todo ? '编辑待办' : '新建待办'}
      description="设置期限后会自动在日程表生成「截止期限」事件"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>取消</Button>
          <Button mutation onClick={handleSubmit}>{todo ? '保存修改' : '创建待办'}</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <FormField label="标题" required error={error}>
          <Input
            value={form.title}
            onChange={(e) => { setForm((f) => ({ ...f, title: e.target.value })); setError('') }}
            placeholder="如 联系客户确认担保函"
            aria-invalid={!!error}
          />
        </FormField>
        <FormField label="关联案件">
          <Select
            value={fixedCaseId ?? form.caseId}
            disabled={!!fixedCaseId}
            onChange={(e) => setForm((f) => ({ ...f, caseId: e.target.value }))}
          >
            <option value="">不关联</option>
            {state.cases.map((c) => (
              <option key={c.id} value={c.id}>{c.title}</option>
            ))}
          </Select>
        </FormField>
        <FormField label="期限">
          <Input
            type="date"
            value={form.deadline}
            onChange={(e) => setForm((f) => ({ ...f, deadline: e.target.value }))}
          />
        </FormField>
      </div>
    </Dialog>
  )
}
