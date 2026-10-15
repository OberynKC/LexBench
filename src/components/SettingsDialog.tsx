import { confirmAction, errorMessage, showAlert } from '../lib/dialogs'
import { useEffect, useState } from 'react'
import { Download, Archive, RotateCcw } from 'lucide-react'
import { useStore } from '../store'
import { Dialog } from './ui/dialog'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { FormField, Label } from './ui/label'
import { Switch } from './ui/switch'

interface Props {
  open: boolean
  onClose: () => void
}

export function SettingsDialog({ open, onClose }: Props) {
  const { state, dispatch, importDemoData, exportData, backupData, restoreData, canWrite } = useStore()
  const [surname, setSurname] = useState(state.userName)
  const [givenName, setGivenName] = useState(state.userGivenName)
  const [nameSaved, setNameSaved] = useState(false)
  const [importing, setImporting] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [backupOperation, setBackupOperation] = useState<'backup' | 'restore' | null>(null)

  // 仅在打开时把输入重置为当前已存姓名；不随外部 userName 变更覆盖编辑中的输入
  useEffect(() => {
    if (!open) return
    setSurname(state.userName)
    setGivenName(state.userGivenName)
    setNameSaved(false)
    setImporting(false)
    setExporting(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const handleSaveName = () => {
    const surnameValue = surname.trim()
    if (!surnameValue) return
    if (!dispatch({ type: 'setUserName', payload: surnameValue })) return
    dispatch({ type: 'setUserGivenName', payload: givenName.trim() })
    setNameSaved(true)
  }

  const handleImportDemo = async () => {
    if (!canWrite() || !await confirmAction('将先自动备份当前数据，再导入演示数据（示例案件 / 客户 / 待办 / 日程等）。确定继续吗？', '导入')) return
    if (!canWrite()) return
    setImporting(true)
    try { await importDemoData() } catch (error) { await showAlert(errorMessage(error), '导入演示数据失败', 'error') } finally { setImporting(false) }
  }

  const handleExportData = async () => {
    setExporting(true)
    try {
      await exportData()
    } catch (error) {
      await showAlert(errorMessage(error), '数据导出失败', 'error')
    } finally {
      setExporting(false)
    }
  }

  const handleBackupOperation = async (operation: 'backup' | 'restore') => {
    setBackupOperation(operation)
    try { await (operation === 'backup' ? backupData() : restoreData()) } catch (error) {
      await showAlert(errorMessage(error), operation === 'backup' ? '备份数据失败' : '恢复数据失败', 'error')
    } finally { setBackupOperation(null) }
  }

  return (
    <Dialog open={open} onClose={onClose} title="设置" description="偏好保存到本机 SQLite，重启不丢失">
      <div className="flex flex-col gap-5">
        {/* 测试模式开关（即改即生效，无需重启） */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <Label>测试模式</Label>
            <p className="mt-0.5 text-xs text-ink-3">开启后应用内可见「导入演示数据」入口</p>
          </div>
          <Switch disabled={!canWrite()} checked={state.testMode} onCheckedChange={(on) => dispatch({ type: 'setTestMode', payload: on })} />
        </div>

        {/* 姓 / 名修改 */}
        <div className="grid grid-cols-2 gap-3">
          <FormField label="姓" required>
            <Input
              value={surname}
              onChange={(e) => {
                setSurname(e.target.value)
                setNameSaved(false)
              }}
              placeholder="如 王"
            />
          </FormField>
          <FormField label="名">
            <Input
              value={givenName}
              onChange={(e) => {
                setGivenName(e.target.value)
                setNameSaved(false)
              }}
              placeholder="如 建国"
            />
          </FormField>
        </div>
        <div className="flex justify-end">
          <Button mutation size="sm" onClick={handleSaveName} disabled={!surname.trim()}>
            {nameSaved ? '已保存' : '保存'}
          </Button>
        </div>

        {/* 演示数据：仅测试模式开启时可见；从未导入时提供入口 */}
        {state.testMode && (
          <div className="border-t border-line-1 pt-4">
            {state.demoImported ? (
              <p className="text-xs text-ink-3">演示数据已导入，为避免重复不再提供入口。</p>
            ) : (
              <div className="flex items-center justify-between gap-4">
                <p className="text-xs text-ink-3">导入演示数据，快速熟悉各项功能。</p>
                <Button mutation variant="outline" size="sm" onClick={handleImportDemo} disabled={importing}>
                  {importing ? '导入中…' : '导入演示数据'}
                </Button>
              </div>
            )}
          </div>
        )}

        {/* 数据导出：由主进程选择目录并生成 Excel / 附件 ZIP */}
        <div className="border-t border-line-1 pt-4">
          <Button mutation
            variant="outline"
            size="sm"
            disabled={exporting}
            className="w-full"
            onClick={() => void handleExportData()}
          >
            <Download /> {exporting ? '正在导出…' : '数据导出'}
          </Button>
        </div>
        <div className="border-t border-line-1 pt-4">
          <div className="grid grid-cols-2 gap-3">
            <Button mutation variant="outline" size="sm" disabled={backupOperation !== null}
              onClick={() => void handleBackupOperation('backup')}>
              <Archive /> {backupOperation === 'backup' ? '正在备份…' : '备份数据'}
            </Button>
            <Button mutation variant="outline" size="sm" disabled={backupOperation !== null}
              onClick={() => void handleBackupOperation('restore')}>
              <RotateCcw /> {backupOperation === 'restore' ? '正在恢复…' : '恢复数据'}
            </Button>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-ink-3">备份包含全部数据和附件。恢复将覆盖当前数据并自动重启；恢复前及导入演示数据前会自动备份当前数据，保留最近 3 份恢复点。</p>
        </div>
        <div className="space-y-3 border-t border-line-1 pt-4">
          <Label>期限提醒</Label>
          <div className="flex items-center justify-between gap-4">
            <label htmlFor="reminder-system" className="text-sm text-ink-2">系统通知</label>
            <Switch id="reminder-system" disabled={!canWrite()} checked={state.reminderSystem}
              onCheckedChange={(on) => dispatch({ type: 'setReminderSystem', payload: on })} />
          </div>
          <div className="flex items-center justify-between gap-4">
            <label htmlFor="reminder-badge" className="text-sm text-ink-2">应用内红点</label>
            <Switch id="reminder-badge" disabled={!canWrite()} checked={state.reminderBadge}
              onCheckedChange={(on) => dispatch({ type: 'setReminderBadge', payload: on })} />
          </div>
          <p className="text-xs leading-relaxed text-ink-3">待办与保全进入 7 天内或逾期时提醒。系统通知仅在应用运行期间发送，需系统允许通知；关闭应用期间的到期事项在下次启动时检查。期限由您手工录入，请核对具体日期。</p>
        </div>
      </div>
    </Dialog>
  )
}
