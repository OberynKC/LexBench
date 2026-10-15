import { confirmAction } from '../lib/dialogs'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CalendarDays, CheckCircle2, CircleDashed, ListTodo, Plus, Search } from 'lucide-react'
import { useStore } from '../store'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Badge } from '../components/ui/badge'
import { EmptyState } from '../components/ui/empty-state'
import { TodoItem, sortTodos } from '../components/TodoItem'
import { TodoDialog } from '../components/TodoDialog'
import type { Todo } from '../types'

export default function Todos() {
  const { state, dispatch, canWrite } = useStore()
  const [keyword, setKeyword] = useState('')
  const [dialog, setDialog] = useState<{ open: boolean; edit?: Todo }>({ open: false })
  const [searchParams, setSearchParams] = useSearchParams()

  useEffect(() => {
    const id = searchParams.get('edit')
    if (!id) return
    const todo = state.todos.find((value) => value.id === id)
    if (todo) {
      setKeyword('')
      setDialog({ open: true, edit: todo })
    }
    const next = new URLSearchParams(searchParams)
    next.delete('edit')
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams, state.todos])

  const { pending, done } = useMemo(() => {
    let list = sortTodos(state.todos)
    const kw = keyword.trim().toLowerCase()
    if (kw) list = list.filter((t) => t.title.toLowerCase().includes(kw))
    return {
      pending: list.filter((t) => !t.done),
      done: list.filter((t) => t.done),
    }
  }, [state.todos, keyword])

  const handleDelete = async (todo: Todo) => {
    if (!canWrite()) return
    if (!await confirmAction(`确定删除待办「${todo.title}」吗？关联的日程事件会一并删除。`)) return
    dispatch({ type: 'deleteTodo', payload: todo.id })
  }

  const empty = pending.length === 0 && done.length === 0

  return (
    <div className="space-y-3 p-5">
      {/* 工具栏 */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-4" />
          <Input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="搜索待办标题"
            className="w-56 pl-8"
          />
        </div>
        <span className="text-xs text-ink-3 tnum">
          未完成 {pending.length} 条 · 已完成 {done.length} 条
        </span>
        <div className="ml-auto">
          <Button size="sm" onClick={() => setDialog({ open: true })}>
            <Plus /> 新建待办
          </Button>
        </div>
      </div>

      {/* 同步说明 */}
      <Card className="flex items-center gap-2 px-4 py-2.5 text-xs text-ink-3">
        <CalendarDays className="h-3.5 w-3.5 shrink-0 text-ink-4" />
        设定了期限的待办会同步出现在日程表中，勾选完成后对应日程会标记「已完成：」前缀
      </Card>

      {empty ? (
        <Card>
          <EmptyState
            icon={ListTodo}
            title={keyword ? '没有符合条件的待办' : '还没有待办事项'}
            description={keyword ? '换个关键词试试' : '点击右上角「新建待办」添加一条'}
            action={
              !keyword && (
                <Button size="sm" onClick={() => setDialog({ open: true })}>
                  <Plus /> 新建待办
                </Button>
              )
            }
          />
        </Card>
      ) : (
        <>
          {/* 进行中 */}
          {(pending.length > 0 || !keyword) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CircleDashed className="h-4 w-4 text-amber-500" /> 进行中
                  <Badge variant="gray">{pending.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="py-2">
                {pending.length === 0 ? (
                  <EmptyState
                    icon={ListTodo}
                    title="没有未完成的待办"
                    description="点击右上角「新建待办」添加一条"
                    className="py-8"
                  />
                ) : (
                  <div className="divide-y divide-line-1">
                    {pending.map((t) => (
                      <TodoItem key={t.id} todo={t} onEdit={(todo) => setDialog({ open: true, edit: todo })} onDelete={handleDelete} />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* 已完成 */}
          {done.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" /> 已完成
                  <Badge variant="gray">{done.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="py-2">
                <div className="divide-y divide-line-1">
                  {done.map((t) => (
                    <TodoItem key={t.id} todo={t} onEdit={(todo) => setDialog({ open: true, edit: todo })} onDelete={handleDelete} />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      <TodoDialog open={dialog.open} onClose={() => setDialog({ open: false })} todo={dialog.edit} />
    </div>
  )
}
