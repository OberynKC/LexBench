import { useCallback, useEffect, useReducer, useRef } from 'react'
import dayjs from 'dayjs'
import { useStore } from '../store'
import type { NoteDraft, NoteDraftInput } from '../types'

interface Session {
  key: string
  value: NoteDraftInput
  baseline: string
  persisted: string | null
  pending?: Promise<void>
  pendingFingerprint?: string
  draft: NoteDraft | null
  loading: boolean
  paused: boolean
  status: string
  failed: boolean
}

const fingerprint = (value: NoteDraftInput) => JSON.stringify(value)

/** 每次打开编辑器独立管理草稿；串行写入避免切换、自动保存和正式保存互相覆盖。 */
export function useNoteDraft(value: NoteDraftInput | null, updatedAt: string | undefined, onRestore: (draft: NoteDraft) => void) {
  const { trackWrite, canWrite, readOnly } = useStore()
  const [, render] = useReducer((n: number) => n + 1, 0)
  const sessionRef = useRef<Session | null>(null)
  const queueRef = useRef<Promise<void>>(Promise.resolve())
  const mountedRef = useRef(false)
  const restoreRef = useRef(onRestore)
  restoreRef.current = onRestore

  if (sessionRef.current?.key !== value?.noteId) {
    sessionRef.current = value ? {
      key: value.noteId, value, baseline: fingerprint(value), persisted: null,
      draft: null, loading: true, paused: false, status: '', failed: false,
    } : null
  }
  const session = sessionRef.current
  if (session && value) session.value = value

  const notify = useCallback((target: Session) => {
    if (mountedRef.current && sessionRef.current === target) render()
  }, [])

  const persist = useCallback((target: Session): Promise<void> => {
    if (target.loading || target.draft || target.paused) return Promise.resolve()
    const snapshot = target.value
    const next = fingerprint(snapshot)
    if (target.pendingFingerprint === next && target.pending) return target.pending
    // 仍有不同内容正在写入时，即使改回此前内容，也须排队保存最新表单。
    if (!target.pending && (next === target.persisted || (next === target.baseline && target.persisted === null))) return queueRef.current
    const previous = queueRef.current
    const pending = trackWrite(async () => {
      await previous
      if (next === target.baseline) {
        // 用户把内容改回正式版本时，删除此前自动保存的草稿。
        await window.api!.notes.deleteNoteDraft(target.key)
        target.status = ''
      } else {
        const saved = await window.api!.notes.saveNoteDraft(snapshot)
        target.status = `草稿已保存 ${dayjs(saved.savedAt).format('HH:mm:ss')}`
      }
      target.persisted = next
      target.failed = false
      notify(target)
    }).catch((error) => {
      target.failed = true
      target.status = '草稿保存失败'
      notify(target)
      throw error
    })
    target.pending = pending
    target.pendingFingerprint = next
    queueRef.current = pending.catch(() => undefined)
    void pending.finally(() => {
      if (target.pending === pending) {
        target.pending = undefined
        target.pendingFingerprint = undefined
      }
    }).catch(() => undefined)
    return pending
  }, [notify, trackWrite])

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  useEffect(() => {
    if (!session) return
    let cancelled = false
    void queueRef.current.then(() => window.api!.notes.getNoteDraft(session.key)).then((draft) => {
      if (cancelled) return
      if (draft && (session.key === '__new__' || dayjs(draft.savedAt).isAfter(updatedAt))) session.draft = draft
      session.loading = false
      notify(session)
    }).catch(() => {
      if (cancelled) return
      session.loading = false
      session.failed = true
      session.status = '草稿读取失败，请重新打开笔记'
      notify(session)
    })
    return () => {
      cancelled = true
      void persist(session).catch(() => undefined)
    }
    // updatedAt 只在打开笔记时用于判断；正式保存不会重新加载编辑器。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, notify, persist])

  useEffect(() => {
    if (!session || session.loading || session.draft || session.paused || readOnly) return
    const timer = window.setTimeout(() => { void persist(session).catch(() => undefined) }, 1500)
    return () => window.clearTimeout(timer)
  }, [session, session?.loading, session?.draft, session?.paused, value, readOnly, persist])

  const flush = useCallback(async () => {
    if (session) await persist(session)
    await queueRef.current
  }, [persist, session])
  const pause = () => { if (session) session.paused = true }
  const resume = () => { if (session) { session.paused = false; notify(session) } }
  const markSaved = (saved: NoteDraftInput) => {
    if (!session) return
    session.baseline = fingerprint(saved)
    session.persisted = null
    session.status = ''
    session.failed = false
    notify(session)
  }
  const recover = () => {
    if (!session?.draft || !canWrite()) return
    const draft = session.draft
    session.persisted = fingerprint({ noteId: draft.noteId, caseId: draft.caseId,
      title: draft.title, content: draft.content, tags: draft.tags })
    session.draft = null
    session.status = `草稿已保存 ${dayjs(draft.savedAt).format('HH:mm:ss')}`
    restoreRef.current(draft)
    notify(session)
  }
  const discard = async () => {
    if (!session?.draft || !canWrite()) return
    try {
      await trackWrite(() => window.api!.notes.deleteNoteDraft(session.key))
      session.draft = null
      session.status = ''
      session.failed = false
      notify(session)
    } catch {
      session.failed = true
      session.status = '草稿丢弃失败，请重试'
      notify(session)
    }
  }

  const waiting = session && !session.loading && !session.draft && !session.failed
    && fingerprint(session.value) !== session.baseline && fingerprint(session.value) !== session.persisted
  return {
    pendingDraft: session?.draft ?? null,
    loading: session?.loading ?? false,
    failed: session?.failed ?? false,
    status: waiting ? '草稿待保存' : session?.status ?? '',
    flush, pause, resume, markSaved, recover, discard,
  }
}
