import { useState, type ChangeEvent, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTaskStore } from '../app/taskStoreContext'
import { useFeedback } from '../components/feedbackContext'
import { BackupValidationError, parseTaskBackup, serializeTaskBackup, type TaskBackup } from '../services'

type ImportPreview = {
  fileName: string
  backup: TaskBackup
}

export function DataInfoPage() {
  const store = useTaskStore()
  const feedback = useFeedback()
  const navigate = useNavigate()
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const heading = (
    <div className="page-heading">
      <div>
        <h1 id="data-info-page-title">数据与说明</h1>
        <p>管理当前浏览器中的本地备份，并了解数据边界。</p>
      </div>
    </div>
  )

  function exportBackup() {
    const result = store.exportBackup()
    if (!result.ok) {
      feedback.showError(`备份文件没有生成成功。当前应用数据没有变化。${result.message}`, exportBackup)
      return
    }

    try {
      downloadBackup(result.value)
      feedback.showSuccess('备份文件已生成')
    } catch (error) {
      const message = error instanceof Error ? error.message : '无法生成本地备份文件。'
      feedback.showError(`备份文件没有生成成功。当前应用数据没有变化。${message}`, exportBackup)
    }
  }

  async function selectImportFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (file === undefined) {
      return
    }

    setPreview(null)
    try {
      const serialized = await file.text()
      const backup = parseTaskBackup(serialized)
      setPreview({ fileName: file.name, backup })
    } catch (error) {
      const message = error instanceof BackupValidationError
        ? error.message
        : '无法读取这个文件。请选择由兼容版本 OpenStudy Planner 导出的备份文件，当前数据没有变化。'
      feedback.showError(message)
    } finally {
      event.target.value = ''
    }
  }

  function confirmImport() {
    if (preview === null) {
      return
    }

    const selectedPreview = preview
    const applyImport = () => {
      const result = store.importBackup(selectedPreview.backup)
      if (!result.ok) {
        feedback.showError(`导入没有完成。${result.message}`, applyImport)
        return
      }

      setPreview(null)
      feedback.showSuccess('数据已恢复')
      navigate('/')
    }

    feedback.requestConfirmation({
      title: '使用这个备份替换当前数据？',
      description: `将使用“${selectedPreview.fileName}”替换当前浏览器中的应用数据。第一版不支持自动合并。`,
      confirmLabel: '确认导入',
      danger: true,
      onConfirm: applyImport,
    })
  }

  function confirmClear() {
    const clearData = () => {
      const result = store.clearAppData()
      if (!result.ok) {
        feedback.showError(`本地数据没有清除成功。${result.message}`, clearData)
        return
      }

      feedback.showSuccess('当前浏览器中的应用数据已清除')
    }

    feedback.requestConfirmation({
      title: '清除当前浏览器中的应用数据？',
      description: '此操作只清除 OpenStudy Planner 在当前浏览器保存的任务数据。已经导出的文件、系统备份和其他位置的数据不会被删除。建议先导出备份。',
      confirmLabel: '确认清除',
      danger: true,
      onConfirm: clearData,
    })
  }

  const hasTasks = store.tasks.length > 0

  if (store.isLoading) {
    return (
      <section aria-labelledby="data-info-page-title" className="page-section">
        {heading}
        <div className="empty-state" role="status">正在读取当前浏览器中的任务数据。</div>
      </section>
    )
  }

  if (store.loadError !== null) {
    return (
      <section aria-labelledby="data-info-page-title" className="page-section">
        {heading}
        <div className="inline-error" role="alert">
          <p>无法读取当前浏览器中的任务数据。现有数据不会被自动覆盖。{store.loadError}</p>
          <button className="button button--secondary" onClick={() => store.reload()} type="button">重新加载</button>
        </div>
      </section>
    )
  }

  return (
    <section aria-labelledby="data-info-page-title" className="page-section">
      {heading}

      <InfoSection title="本地数据">
        <p>学习任务默认保存在当前浏览器中，产品服务器不主动接收任务正文。清除浏览器数据、更换设备或浏览器环境可能导致记录丢失。</p>
        <p>本地保存不等于绝对安全或完全匿名。共用设备、浏览器扩展、设备丢失和导出文件泄露仍可能带来风险。</p>
      </InfoSection>

      <InfoSection title="导出备份">
        <p>备份包含全部任务及任务字段，可能包含学习计划、成绩信息和个人备注。文件不会自动上传，请自行妥善保管。</p>
        {!hasTasks && <p className="form-help">当前没有可导出的任务数据。</p>}
        <button className="button" disabled={!hasTasks} onClick={exportBackup} type="button">导出备份</button>
      </InfoSection>

      <InfoSection title="导入备份">
        <p>导入会替换当前浏览器中的应用数据，不会自动合并。选择文件后会先校验和预览，不会立即写入。</p>
        <label className="button button--secondary" htmlFor="backup-file-input">
          选择备份文件
        </label>
        <input accept="application/json,.json" className="visually-hidden" id="backup-file-input" onChange={selectImportFile} type="file" />
        {preview !== null && (
          <section aria-labelledby="import-preview-title" className="import-preview">
            <h2 id="import-preview-title">导入备份预览</h2>
            <dl>
              <dt>文件名</dt><dd>{preview.fileName}</dd>
              <dt>备份格式版本</dt><dd>v{preview.backup.backupFormatVersion}</dd>
              <dt>本地数据格式版本</dt><dd>v{preview.backup.storageFormatVersion}</dd>
              <dt>导出时间</dt><dd>{formatTimestamp(preview.backup.exportedAt)}</dd>
              <dt>任务数量</dt><dd>{preview.backup.tasks.length}</dd>
            </dl>
            <p><strong>确认导入后会完整替换当前应用数据，第一版不支持合并。</strong></p>
            <div className="button-row">
              <button className="button button--secondary" onClick={() => setPreview(null)} type="button">取消导入</button>
              <button className="button button--danger" onClick={confirmImport} type="button">确认导入</button>
            </div>
          </section>
        )}
      </InfoSection>

      <InfoSection title="清除本地数据">
        <p>此操作只清除当前浏览器中由本应用保存的数据，不能删除已经导出的文件、系统备份或其他位置的副本。</p>
        {!hasTasks && <p className="form-help">当前没有需要清除的任务数据。</p>}
        <button className="button button--danger-outline" disabled={!hasTasks} onClick={confirmClear} type="button">清除本地数据</button>
      </InfoSection>

      <InfoSection title="隐私、安全和版权边界">
        <p>无需注册；默认不上传任务正文。公共网页托管平台仍可能产生基础访问日志。本应用不要求医学、情绪或健康信息，也不使用羞辱或惩罚性文案。</p>
        <p>你可以记录课程名称、章节、页码、题号和自己的总结；本应用不提供付费课程内容、教材正文、完整题库、培训机构内容抓取或绕过登录和付费限制的能力。</p>
      </InfoSection>

      <InfoSection title="第一版范围">
        <p>第一版用于创建任务、选择今日重点、开始执行、标记结果，以及对未完成任务重新决策。</p>
        <p>不包含 AI 规划、云同步、复杂统计、社交排行榜、自动批改或录取概率预测。</p>
      </InfoSection>
    </section>
  )
}

function InfoSection({ children, title }: { children: ReactNode; title: string }) {
  return (
    <section className="data-info-section">
      <h2>{title}</h2>
      {children}
    </section>
  )
}

function downloadBackup(backup: TaskBackup): void {
  const blob = new Blob([serializeTaskBackup(backup)], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  const date = backup.exportedAt.slice(0, 10)
  anchor.href = url
  anchor.download = `OpenStudy-Planner-Backup-${date}.json`
  anchor.click()
  URL.revokeObjectURL(url)
}

function formatTimestamp(timestamp: string): string {
  return new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(timestamp))
}
