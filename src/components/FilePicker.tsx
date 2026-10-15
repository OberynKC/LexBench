import { errorMessage, showAlert } from '../lib/dialogs'
import { useState } from 'react'
import { ExternalLink, FileText, FolderOpen, Paperclip, Trash2 } from 'lucide-react'
import type { FileMeta, FileOwner } from '../types'
import { formatFileSize } from '../lib/utils'
import { useStore } from '../store'
import { Button } from './ui/button'

interface Props {
  owner: FileOwner
  files: FileMeta[]
  emptyText?: string
  compact?: boolean
}

/** 统一的真实附件上传与管理入口；文件选择、复制、打开和删除均由 Electron 主进程完成。 */
export function FilePicker({ owner, files, emptyText = '暂无附件', compact = false }: Props) {
  const store = useStore()
  const [uploading, setUploading] = useState(false)
  const [workingId, setWorkingId] = useState<string | null>(null)

  const upload = async () => {
    setUploading(true)
    try {
      await store.selectAndStoreFiles(owner)
    } catch (error) {
      await showAlert(errorMessage(error), '上传附件失败', 'error')
    } finally {
      setUploading(false)
    }
  }

  const run = async (file: FileMeta, operation: 'open' | 'reveal' | 'remove') => {
    setWorkingId(file.id)
    try {
      if (operation === 'open') await store.openFile(file.id)
      else if (operation === 'reveal') await store.revealFile(file.id)
      else await store.removeFile(file.id)
    } catch (error) {
      const label = operation === 'open' ? '打开' : operation === 'reveal' ? '显示' : '删除'
      await showAlert(errorMessage(error), `${label}附件失败`, 'error')
    } finally {
      setWorkingId(null)
    }
  }

  return (
    <div className="space-y-2">
      <Button mutation type="button" variant="outline" size="sm" disabled={uploading} onClick={() => void upload()}>
        <Paperclip /> {uploading ? '正在上传…' : '上传文件'}
      </Button>
      {files.length === 0 ? (
        <p className="text-xs text-ink-3">{emptyText}</p>
      ) : (
        <ul className="space-y-1.5">
          {files.map((f) => (
            <li key={f.id} className="rounded-md border border-line-2 px-2.5 py-1.5 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <FileText className="h-3.5 w-3.5 shrink-0 text-ink-4" />
                <span className="min-w-0 flex-1 truncate text-ink-2">{f.name}</span>
                <span className="tnum shrink-0 text-ink-4">{formatFileSize(f.size)}</span>
                {!f.relPath && <span className="shrink-0 text-amber-600 dark:text-amber-400">旧版仅元数据</span>}
                <div className={compact ? 'flex w-full justify-end gap-1' : 'flex shrink-0 gap-1'}>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={workingId === f.id || !f.relPath}
                    title={!f.relPath ? '旧版记录没有保存文件内容' : undefined}
                    onClick={() => void run(f, 'open')}
                  >
                    <ExternalLink /> 打开
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={workingId === f.id || !f.relPath}
                    title={!f.relPath ? '旧版记录没有保存文件内容' : undefined}
                    onClick={() => void run(f, 'reveal')}
                  >
                    <FolderOpen /> 打开所在文件夹
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    mutation
                    disabled={workingId === f.id}
                    className="text-red-500 hover:text-red-600 dark:text-red-400"
                    onClick={() => void run(f, 'remove')}
                  >
                    <Trash2 /> 删除
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
