import { useEffect, useState } from 'react'
import dayjs from 'dayjs'
import { Copy, Columns2 } from 'lucide-react'
import { useStore } from '../store'
import { cn } from '../lib/utils'
import { Markdown } from '../lib/markdown'
import { errorMessage } from '../lib/dialogs'
import { Button } from './ui/button'
import { Dialog } from './ui/dialog'
import type { Note, NoteDraftInput, NoteVersion } from '../types'

export function NoteHistoryDialog({ open, onClose, note, current, onOpenCopy }: {
  open: boolean
  onClose: () => void
  note: Note
  current: NoteDraftInput
  onOpenCopy: (copy: Note) => void
}) {
  const { dispatch, waitForWrites, canWrite, newId, now } = useStore()
  const [versions, setVersions] = useState<NoteVersion[]>([])
  const [versionId, setVersionId] = useState('')
  const [version, setVersion] = useState<NoteVersion | null>(null)
  const [loading, setLoading] = useState(false)
  const [comparing, setComparing] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [message, setMessage] = useState('')
  const [copy, setCopy] = useState<Note | null>(null)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    setMessage('')
    setCopy(null)
    setComparing(false)
    setVersions([])
    setVersionId('')
    setVersion(null)
    void waitForWrites().then(() => window.api!.notes.listNoteVersions(note.id)).then((items) => {
      if (cancelled) return
      setVersions(items)
      setVersionId(items[0]?.id ?? '')
    }).catch((error) => { if (!cancelled) setMessage(`历史读取失败：${errorMessage(error)}`) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [open, note.id, waitForWrites])

  useEffect(() => {
    if (!open || !versionId) return
    let cancelled = false
    setVersion(null)
    void window.api!.notes.getNoteVersion(versionId).then((item) => {
      if (cancelled) return
      if (!item || item.noteId !== note.id) setMessage('该历史版本已不存在，请重新打开历史')
      else setVersion(item)
    }).catch((error) => { if (!cancelled) setMessage(`版本读取失败：${errorMessage(error)}`) })
    return () => { cancelled = true }
  }, [open, versionId, note.id])

  const restoreCopy = async () => {
    if (!version || restoring || !canWrite()) return
    const timestamp = now()
    const restored: Note = {
      id: newId('note'), caseId: note.caseId,
      title: `${version.title}（恢复自 ${dayjs(version.createdAt).format('YYYY-MM-DD HH:mm')}）`,
      content: version.content, tags: [...version.tags], createdAt: timestamp, updatedAt: timestamp,
    }
    setRestoring(true)
    setMessage('')
    try {
      if (!dispatch({ type: 'addNote', payload: restored })) return
      await waitForWrites()
      setCopy(restored)
    } catch {
      setMessage('副本保存失败，请恢复后重试')
    } finally {
      setRestoring(false)
    }
  }

  const preview = (label: string, item: Pick<NoteVersion, 'title' | 'content' | 'tags'>) => (
    <section className="min-w-0 rounded-lg border border-line-2 p-4">
      <p className="mb-3 text-xs font-medium text-ink-3">{label}</p>
      <h3 className="mb-2 break-words text-base font-semibold">{item.title || '未填写标题'}</h3>
      {item.tags.length > 0 && <p className="mb-3 break-words text-xs text-ink-3">标签：{item.tags.join('、')}</p>}
      <Markdown text={item.content} className="break-words" />
    </section>
  )

  return (
    <Dialog open={open} onClose={onClose} title="笔记历史" description={`${note.title} · 保留最近 20 个版本`}
      className="max-w-6xl" footer={<>
        {version && <Button size="sm" variant="outline" onClick={() => setComparing((value) => !value)}>
          <Columns2 /> {comparing ? '查看版本' : '比较'}
        </Button>}
        <Button mutation size="sm" disabled={!version || restoring} onClick={() => void restoreCopy()}>
          <Copy /> {restoring ? '保存中…' : '恢复为副本'}
        </Button>
      </>}>
      {message && <p role="status" className="mb-3 text-xs text-red-500">{message}</p>}
      {copy && <div role="status" className="mb-3 flex items-center gap-3 text-xs text-emerald-600 dark:text-emerald-400">
        <span>已创建历史副本</span>
        <Button variant="link" size="sm" onClick={() => { onClose(); onOpenCopy(copy) }}>查看副本</Button>
      </div>}
      {loading ? <p className="py-8 text-center text-sm text-ink-3">正在读取历史…</p>
        : versions.length === 0 ? <p className="py-8 text-center text-sm text-ink-3">暂无历史版本。首次修改保存时会保留原文与本次内容。</p>
          : <div className="flex gap-4">
            <div className="w-52 shrink-0 space-y-1">
              {versions.map((item) => <button key={item.id} onClick={() => setVersionId(item.id)}
                className={cn('w-full rounded-lg px-3 py-2 text-left text-xs transition-colors',
                  item.id === versionId ? 'bg-navy-50 text-navy-800 dark:bg-navy-900 dark:text-navy-200' : 'text-ink-3 hover:bg-hover')}>
                <span className="block tnum">{dayjs(item.createdAt).format('YYYY-MM-DD HH:mm:ss')}</span>
                <span className="mt-1 block truncate">{item.title}</span>
              </button>)}
            </div>
            <div className={cn('min-w-0 flex-1 space-y-3', comparing && 'grid grid-cols-2 items-start gap-3 space-y-0')}>
              {version ? <>
                {preview('所选历史版本', version)}
                {comparing && preview('当前编辑内容', current)}
              </> : <p className="text-sm text-ink-3">正在读取版本…</p>}
            </div>
          </div>}
    </Dialog>
  )
}
