import { useMutationDisabled } from '../lib/mutationState'
import { Link } from 'react-router-dom'
import dayjs from 'dayjs'
import { Check, Pencil, Trash2 } from 'lucide-react'
import type { Todo } from '../types'
import { useStore } from '../store'
import { cn, daysUntil } from '../lib/utils'
import { DeadlineBadge } from './badges'

/** 待办排序：未完成在前（有期限的按期限升序，无期限在后），已完成按创建时间倒序 */
export function sortTodos(todos: Todo[]): Todo[] {
  return [...todos].sort((a, b) => {
    if (a.done !== b.done) return Number(a.done) - Number(b.done)
    if (!a.done) {
      if (a.deadline && b.deadline) return daysUntil(a.deadline) - daysUntil(b.deadline)
      if (a.deadline) return -1
      if (b.deadline) return 1
      return dayjs(b.createdAt).valueOf() - dayjs(a.createdAt).valueOf()
    }
    return dayjs(b.createdAt).valueOf() - dayjs(a.createdAt).valueOf()
  })
}

export function TodoCheckbox({ done, onToggle }: { done: boolean; onToggle: () => void }) {
  const readOnly = useMutationDisabled()
  return (
    <button
      disabled={readOnly}
      onClick={onToggle}
      aria-label={done ? '标记为未完成' : '标记为完成'}
      className={cn(
        'flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[4px] border transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-400',
        done
          ? 'border-navy-700 bg-navy-700 text-white dark:border-navy-500 dark:bg-navy-500'
          : 'border-line-3 bg-field hover:border-navy-500',
      )}
    >
      {done && <Check className="h-3 w-3" strokeWidth={3} />}
    </button>
  )
}

interface TodoItemProps {
  todo: Todo
  onEdit?: (todo: Todo) => void
  onDelete?: (todo: Todo) => void
}

export function TodoItem({ todo, onEdit, onDelete }: TodoItemProps) {
  const { dispatch, getCase, readOnly } = useStore()
  const c = todo.caseId ? getCase(todo.caseId) : undefined

  // 勾选完成时，对应日程事件保留但标题加「已完成：」前缀（见 store 中 syncTodoEvents）
  const toggle = () => dispatch({ type: 'updateTodo', payload: { ...todo, done: !todo.done } })

  return (
    <div className="group flex items-center gap-2.5 px-1 py-1.5">
      <TodoCheckbox done={todo.done} onToggle={toggle} />
      {onEdit ? (
        <button
          type="button"
          onClick={() => onEdit(todo)}
          title={todo.title}
          className={cn(
            'min-w-0 flex-1 truncate text-left text-[13px] transition-colors hover:text-navy-600 hover:underline dark:hover:text-navy-300',
            todo.done ? 'text-ink-4 line-through' : 'text-ink',
          )}
        >
          {todo.title}
        </button>
      ) : (
        <span
          title={todo.title}
          className={cn(
            'min-w-0 flex-1 truncate text-[13px]',
            todo.done ? 'text-ink-4 line-through' : 'text-ink',
          )}
        >
          {todo.title}
        </span>
      )}
      {c && (
        <Link
          to={`/cases/${c.id}`}
          title={c.title}
          className="hidden min-w-0 max-w-[min(150px,30%)] truncate rounded-full bg-navy-50 px-2 py-0.5 text-[11px] text-navy-700 hover:bg-navy-100 dark:bg-navy-950 dark:text-navy-300 dark:hover:bg-navy-900 sm:block"
        >
          {c.title}
        </Link>
      )}
      {todo.deadline && <DeadlineBadge deadline={todo.deadline} />}
      {(onEdit || onDelete) && (
        <span className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          {onEdit && (
            <button className="rounded p-1 text-ink-4 hover:bg-hover hover:text-ink-2" onClick={() => onEdit(todo)} aria-label="编辑">
              <Pencil className="h-3.5 w-3.5" />
            </button>
          )}
          {onDelete && (
            <button disabled={readOnly} className="rounded p-1 text-ink-4 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/50" onClick={() => onDelete(todo)} aria-label="删除">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </span>
      )}
    </div>
  )
}
