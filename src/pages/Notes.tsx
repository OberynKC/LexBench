import { confirmAction } from '../lib/dialogs'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import dayjs from 'dayjs'
import { Eye, History, NotebookPen, PencilLine, Plus, Save, Search, Trash2 } from 'lucide-react'
import { useStore } from '../store'
import { cn } from '../lib/utils'
import { Markdown } from '../lib/markdown'
import { useNoteDraft } from '../hooks/useNoteDraft'
import { NoteHistoryDialog } from '../components/NoteHistoryDialog'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Textarea } from '../components/ui/textarea'
import { Select } from '../components/ui/select'
import { Badge } from '../components/ui/badge'
import { EmptyState } from '../components/ui/empty-state'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import type { Note } from '../types'

interface NoteForm {
  caseId: string
  title: string
  content: string
  tags: string
}

export default function Notes() {
  const { state, canWrite, readOnly, dispatch, waitForWrites, getCase, newId, now } = useStore()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()

  const [keyword, setKeyword] = useState('')
  const [caseFilter, setCaseFilter] = useState('')
  const [tagFilter, setTagFilter] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [isNew, setIsNew] = useState(false)
  const [form, setForm] = useState<NoteForm>({ caseId: '', title: '', content: '', tags: '' })
  const [errors, setErrors] = useState<{ title?: string; caseId?: string }>({})
  const [savedTip, setSavedTip] = useState('')
  const [saving, setSaving] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const savingRef = useRef(false)

  const allTags = useMemo(() => Array.from(new Set(state.notes.flatMap((n) => n.tags))).sort(), [state.notes])

  const filtered = useMemo(() => {
    let list = [...state.notes].sort((a, b) => dayjs(b.updatedAt).valueOf() - dayjs(a.updatedAt).valueOf())
    if (caseFilter) list = list.filter((n) => n.caseId === caseFilter)
    if (tagFilter) list = list.filter((n) => n.tags.includes(tagFilter))
    const kw = keyword.trim().toLowerCase()
    if (kw) list = list.filter((n) => n.title.toLowerCase().includes(kw))
    return list
  }, [state.notes, caseFilter, tagFilter, keyword])

  const selected = selectedId ? state.notes.find((n) => n.id === selectedId) : undefined
  const draftValue = useMemo(() => isNew || selected ? {
    noteId: isNew ? '__new__' : selected!.id, caseId: form.caseId,
    title: form.title, content: form.content,
    tags: form.tags.split(/[,，]/).map((tag) => tag.trim()).filter(Boolean),
  } : null, [isNew, selected?.id, form])
  const drafts = useNoteDraft(draftValue, selected?.updatedAt, (draft) => {
    setForm({ caseId: draft.caseId, title: draft.title, content: draft.content, tags: draft.tags.join('，') })
    setSavedTip('')
    setErrors({})
  })
  const editorDisabled = readOnly || saving || drafts.loading || !!drafts.pendingDraft
  const editForm = (patch: Partial<NoteForm>) => {
    setSavedTip('')
    setForm((value) => ({ ...value, ...patch }))
  }

  const loadNote = (n: Note) => {
    if (savingRef.current || (!isNew && selectedId === n.id)) return
    setSelectedId(n.id)
    setIsNew(false)
    setErrors({})
    setSavedTip('')
    setHistoryOpen(false)
    setForm({ caseId: n.caseId, title: n.title, content: n.content, tags: n.tags.join('，') })
  }

  const startCreate = (caseId = '') => {
    if (savingRef.current || isNew) return
    setSelectedId(null)
    setIsNew(true)
    setErrors({})
    setSavedTip('')
    setHistoryOpen(false)
    setForm({ caseId, title: '', content: '', tags: '' })
  }

  // 搜索定位独立于新建入口，保存中保留参数，完成后再切换。
  useEffect(() => {
    const noteParam = searchParams.get('note')
    if (noteParam) {
      // 正式保存完成后再切换，保留现有保存与草稿串行链路。
      if (savingRef.current) return
      const n = state.notes.find((x) => x.id === noteParam)
      if (n) {
        setKeyword('')
        setCaseFilter('')
        setTagFilter('')
        loadNote(n)
      }
      const next = new URLSearchParams(searchParams)
      next.delete('note')
      setSearchParams(next, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, state.notes, saving])

  // 从其他页面通过 state.create 新建。
  useEffect(() => {
    const st = location.state as { create?: boolean; caseId?: string } | null
    if (st?.create) {
      startCreate(st.caseId ?? '')
      window.history.replaceState({}, '')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state])

  const handleSave = async () => {
    if (savingRef.current || !canWrite() || drafts.loading || drafts.pendingDraft) return
    const e: typeof errors = {}
    if (!form.title.trim()) e.title = '请填写笔记标题'
    if (!form.caseId) e.caseId = '请选择所属案件'
    setErrors(e)
    if (Object.keys(e).length > 0) return
    if (!draftValue) return
    savingRef.current = true
    setSaving(true)
    setSavedTip('保存中…')
    // 已登记的草稿先完成；暂停后不会在正式保存成功之后重新写入旧草稿。
    const draftPending = drafts.flush()
    drafts.pause()
    try {
      await draftPending.catch(() => undefined)
      if (!canWrite()) { setSavedTip('当前暂不可保存，请等待数据操作完成'); return }
      const timestamp = now()
      const note: Note = {
        id: isNew ? newId('note') : selected!.id,
        caseId: form.caseId, title: form.title.trim(), content: form.content, tags: draftValue.tags,
        createdAt: isNew ? timestamp : selected!.createdAt, updatedAt: timestamp,
      }
      const accepted = isNew
        ? dispatch({ type: 'addNote', payload: note, clearNewDraft: true })
        : dispatch({ type: 'updateNote', payload: note })
      if (!accepted) { setSavedTip('笔记尚未保存，请稍后重试'); return }
      await waitForWrites()
      drafts.markSaved({ ...draftValue, title: note.title })
      setForm((value) => ({ ...value, title: note.title }))
      setSelectedId(note.id)
      setIsNew(false)
      setSavedTip(`已保存 ${dayjs().format('HH:mm:ss')}`)
    } catch {
      setSavedTip('保存失败')
    } finally {
      drafts.resume()
      savingRef.current = false
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!selected || savingRef.current || !canWrite()) return
    if (!await confirmAction(`确定删除笔记「${selected.title}」吗？`)) return
    if (!canWrite()) return
    const draftPending = drafts.flush()
    drafts.pause()
    savingRef.current = true
    setSaving(true)
    let removed = false
    try {
      // 排空已发送的草稿后再删除，防止其在级联清理后重新写入。
      await draftPending.catch(() => undefined)
      if (!dispatch({ type: 'deleteNote', payload: selected.id })) return
      await waitForWrites()
      removed = true
      setSelectedId(null)
      setIsNew(false)
    } catch {
      setSavedTip('删除失败')
    } finally {
      if (!removed) drafts.resume()
      savingRef.current = false
      setSaving(false)
    }
  }

  return (
    <div className="flex h-full">
      {/* 左侧列表 */}
      <div className="flex w-80 shrink-0 flex-col border-r border-line-1 bg-surface">
        <div className="space-y-2 border-b border-line-1 p-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-4" />
            <Input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="搜索笔记标题" className="pl-8" />
          </div>
          <Select value={caseFilter} onChange={(e) => setCaseFilter(e.target.value)}>
            <option value="">全部案件</option>
            {state.cases.map((c) => (
              <option key={c.id} value={c.id}>{c.title}</option>
            ))}
          </Select>
          {allTags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => setTagFilter('')}
                className={cn(
                  'rounded-full px-2 py-0.5 text-xs transition-colors',
                  !tagFilter ? 'bg-navy-800 text-white' : 'bg-hover text-ink-3 hover:bg-active',
                )}
              >
                全部标签
              </button>
              {allTags.map((t) => (
                <button
                  key={t}
                  onClick={() => setTagFilter(tagFilter === t ? '' : t)}
                  className={cn(
                    'rounded-full px-2 py-0.5 text-xs transition-colors',
                    tagFilter === t ? 'bg-navy-800 text-white' : 'bg-hover text-ink-3 hover:bg-active',
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center justify-between px-3 py-2">
          <span className="text-xs text-ink-3 tnum">{filtered.length} 条笔记</span>
          <Button size="sm" variant="secondary" disabled={saving} onClick={() => startCreate()}>
            <Plus /> 新建
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <EmptyState icon={NotebookPen} title="没有匹配的笔记" className="py-8" />
          ) : (
            filtered.map((n) => {
              const c = getCase(n.caseId)
              const active = !isNew && selectedId === n.id
              return (
                <button
                  key={n.id}
                  disabled={saving}
                  onClick={() => loadNote(n)}
                  className={cn(
                    'block w-full border-b border-line-1 px-3 py-2.5 text-left transition-colors',
                    active ? 'bg-navy-50 dark:bg-navy-950/50' : 'hover:bg-hover',
                  )}
                >
                  <div className="flex items-center gap-2">
                    {active && <span className="h-3.5 w-0.5 rounded bg-navy-700" />}
                    <span className="truncate text-sm font-medium text-ink">{n.title}</span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-ink-3">{c?.title ?? '未关联案件'}</p>
                  <div className="mt-1.5 flex items-center justify-between">
                    <div className="flex gap-1">
                      {n.tags.slice(0, 2).map((t) => (
                        <Badge key={t} variant="gray" className="px-1.5">{t}</Badge>
                      ))}
                    </div>
                    <span className="tnum text-[10px] text-ink-4">{dayjs(n.updatedAt).format('M月D日')}</span>
                  </div>
                </button>
              )
            })
          )}
        </div>
      </div>

      {/* 右侧编辑器 */}
      <div className="flex min-w-0 flex-1 flex-col bg-base">
        {!isNew && !selected ? (
          <div className="flex flex-1 items-center justify-center">
            <EmptyState
              icon={NotebookPen}
              title="选择或新建一条笔记"
              description="左侧选择笔记进行编辑，或点击「新建」开始记录"
              action={<Button size="sm" onClick={() => startCreate()}><Plus /> 新建笔记</Button>}
            />
          </div>
        ) : (
          <>
            {/* 工具区 */}
            <div className="flex flex-wrap items-center gap-2 border-b border-line-1 bg-surface px-4 py-2.5">
              <Input
                value={form.title}
                disabled={editorDisabled}
                onChange={(e) => { editForm({ title: e.target.value }); setErrors((er) => ({ ...er, title: undefined })) }}
                placeholder="笔记标题（必填）"
                aria-invalid={!!errors.title}
                className="w-72 font-medium"
              />
              <Select
                value={form.caseId}
                disabled={editorDisabled}
                onChange={(e) => { editForm({ caseId: e.target.value }); setErrors((er) => ({ ...er, caseId: undefined })) }}
                className="w-56"
              >
                <option value="">选择所属案件（必选）</option>
                {state.cases.map((c) => (
                  <option key={c.id} value={c.id}>{c.title}</option>
                ))}
              </Select>
              <Input
                value={form.tags}
                disabled={editorDisabled}
                onChange={(e) => editForm({ tags: e.target.value })}
                placeholder="标签，用逗号分隔"
                className="w-44"
              />
              <div className="ml-auto flex items-center gap-2">
                {errors.title && <span className="text-xs text-red-500">{errors.title}</span>}
                {errors.caseId && <span className="text-xs text-red-500">{errors.caseId}</span>}
                {selected && (
                  <Button variant="outline" size="sm" disabled={saving} onClick={() => setHistoryOpen(true)}>
                    <History /> 历史
                  </Button>
                )}
                {selected && (
                  <Button mutation disabled={saving} variant="ghost" size="sm" className="text-red-500 hover:bg-red-50 hover:text-red-600 dark:text-red-400 dark:hover:bg-red-950/50 dark:hover:text-red-300" onClick={() => void handleDelete()}>
                    <Trash2 /> 删除
                  </Button>
                )}
                <Button mutation disabled={editorDisabled} size="sm" onClick={() => void handleSave()}>
                  <Save /> {isNew ? '创建笔记' : '保存'}
                </Button>
              </div>
            </div>

            {drafts.pendingDraft && (
              <div className="flex flex-wrap items-center gap-3 border-b border-amber-200 bg-amber-50 px-6 py-3 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                <span>发现未保存的草稿（{dayjs(drafts.pendingDraft.savedAt).format('YYYY-MM-DD HH:mm')}）</span>
                <Button mutation size="sm" variant="outline" onClick={drafts.recover}>恢复草稿</Button>
                <Button mutation size="sm" variant="ghost" onClick={() => void drafts.discard()}>丢弃草稿</Button>
              </div>
            )}

            {/* 元信息 */}
            {selected && (
              <div className="flex items-center gap-4 border-b border-line-1 bg-surface px-4 py-1.5 text-xs text-ink-3 tnum">
                <span>创建于 {dayjs(selected.createdAt).format('YYYY-MM-DD HH:mm')}</span>
                <span>更新于 {dayjs(selected.updatedAt).format('YYYY-MM-DD HH:mm')}</span>
                {form.caseId && getCase(form.caseId) && (
                  <Link to={`/cases/${form.caseId}`} className="text-navy-600 hover:underline dark:text-navy-300">
                    所属案件：{getCase(form.caseId)!.title}
                  </Link>
                )}
              </div>
            )}

            {/* 编辑 / 预览 */}
            <Tabs defaultValue="edit" className="flex min-h-0 flex-1 flex-col">
              <div className="border-b border-line-1 bg-surface px-4 py-1.5">
                <TabsList>
                  <TabsTrigger value="edit"><PencilLine className="h-3.5 w-3.5" /> 编辑</TabsTrigger>
                  <TabsTrigger value="preview"><Eye className="h-3.5 w-3.5" /> 预览</TabsTrigger>
                </TabsList>
              </div>
              <TabsContent value="edit" className="min-h-0 flex-1">
                <Textarea
                  value={form.content}
                  disabled={editorDisabled}
                  aria-label="笔记正文"
                  onChange={(e) => editForm({ content: e.target.value })}
                  placeholder={'支持 Markdown 语法：\n\n# 标题\n**粗体**  *斜体*  `代码`\n- 列表项\n> 引用'}
                  className="h-full resize-none rounded-none border-0 bg-surface font-mono text-[13px] leading-relaxed shadow-none focus-visible:ring-0"
                />
              </TabsContent>
              <TabsContent value="preview" className="min-h-0 flex-1 overflow-y-auto bg-surface px-6 py-4">
                {form.content.trim() ? (
                  <Markdown text={form.content} />
                ) : (
                  <p className="text-sm text-ink-4">暂无内容，切换到「编辑」开始书写</p>
                )}
              </TabsContent>
            </Tabs>
            <div role="status" className="flex min-h-9 items-center gap-4 border-t border-line-1 bg-surface px-4 py-1.5 text-xs tnum">
              {drafts.loading && <span className="text-ink-4">正在检查草稿…</span>}
              {drafts.status && <span className={drafts.failed ? 'text-red-500' : 'text-ink-3'}>{drafts.status}</span>}
              {savedTip && <span className={savedTip.startsWith('已保存') ? 'text-emerald-600 dark:text-emerald-400' : 'text-ink-3'}>{savedTip}</span>}
            </div>
          </>
        )}
      </div>
      {selected && draftValue && <NoteHistoryDialog open={historyOpen} onClose={() => setHistoryOpen(false)}
        note={selected} current={draftValue} onOpenCopy={loadNote} />}
    </div>
  )
}
