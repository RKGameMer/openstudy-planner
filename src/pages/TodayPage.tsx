import { useState, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useTaskStore } from '../app/taskStoreContext'
import { TaskCard } from '../components/TaskCard'
import { TaskForm } from '../components/TaskForm'
import { useFeedback } from '../components/feedbackContext'
import type { Task } from '../models'

export function TodayPage() {
  const store = useTaskStore()
  const feedback = useFeedback()
  const [quickName, setQuickName] = useState('')
  const [quickError, setQuickError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [formTask, setFormTask] = useState<Task | null>(null)
  const todayPriority = store.getTodayPriority()
  const pastUnresolved = store.getPastUnresolvedPriorities()

  function submitQuickCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (quickName.trim().length === 0) {
      setQuickError('请填写任务名称。')
      return
    }

    const save = () => {
      const result = store.createTask({ name: quickName }, true)
      if (!result.ok) {
        feedback.showError(`任务没有保存成功。${result.message}`, save)
        return
      }

      setQuickName('')
      setQuickError(null)
      feedback.showSuccess('任务已创建并加入今日重点')
    }

    if (todayPriority.length >= 3) {
      feedback.requestConfirmation({
        title: '当前重点已超过建议数量',
        description: '建议保留1—3项当前重点，你仍然可以继续添加。',
        confirmLabel: '继续添加',
        cancelLabel: '返回查看当前重点',
        onConfirm: save,
      })
      return
    }

    save()
  }

  return (
    <section aria-labelledby="today-page-title" className="page-section">
      <div className="page-heading">
        <div>
          <h1 id="today-page-title">今日</h1>
          <p>{formatToday()} · 先处理当前最重要的任务。</p>
        </div>
      </div>

      {store.loadError !== null && <LoadError message={store.loadError} onRetry={() => store.reload()} />}

      <form aria-label="快速新建任务" className="quick-create" onSubmit={submitQuickCreate}>
        <label htmlFor="quick-task-name">快速新建任务</label>
        <div className="quick-create__controls">
          <input
            aria-describedby={quickError === null ? undefined : 'quick-task-error'}
            id="quick-task-name"
            onChange={(event) => {
              setQuickName(event.target.value)
              setQuickError(null)
            }}
            placeholder="写下下一件需要完成的事"
            value={quickName}
          />
          <button className="button" type="submit">添加</button>
        </div>
        {quickError !== null && <small className="field-error" id="quick-task-error">{quickError}</small>}
        <div className="quick-create__help">
          <span>保存后加入今日重点</span>
          <button className="text-button" onClick={() => {
            setFormTask(null)
            setShowForm(true)
          }} type="button">补充信息</button>
        </div>
      </form>

      {showForm && (
        <TaskForm
          defaultAddToToday
          defaultName={quickName}
          onCancel={() => {
            setFormTask(null)
            setShowForm(false)
          }}
          onSaved={() => {
            setFormTask(null)
            setQuickName('')
            setShowForm(false)
          }}
          priorityCount={todayPriority.length}
          isTodayPriority={formTask === null || todayPriority.some((task) => task.id === formTask.id)}
          task={formTask ?? undefined}
        />
      )}

      {pastUnresolved.length > 0 && (
        <aside className="past-priority-notice">
          <strong>有 {pastUnresolved.length} 项过往重点仍未处理</strong>
          <p>这些任务保持原状态和原重点日期，不会自动加入今天或延期。</p>
          <Link className="button button--secondary" to="/replan">去处理</Link>
        </aside>
      )}

      <div className="section-heading">
        <div>
          <h2>今日重点</h2>
          <p>建议保留1—3项；你仍可根据需要添加更多。</p>
        </div>
      </div>

      {todayPriority.length > 0 ? (
        <div className="task-list">
          {todayPriority.map((task) => (
            <TaskCard key={task.id} isTodayPriority onEdit={(selectedTask) => {
              setFormTask(selectedTask)
              setShowForm(true)
            }} task={task} />
          ))}
        </div>
      ) : store.tasks.length === 0 ? (
        <EmptyState
          description="先写下一件需要完成的事，只填写任务名称也可以。"
          title="还没有学习任务"
        />
      ) : (
        <EmptyState
          action={<Link className="button button--secondary" to="/tasks">从任务库选择</Link>}
          description="你可以从任务库选择任务，或直接创建一个新任务。"
          title="今天还没有选择重点"
        />
      )}
      {todayPriority.length > 0 && (
        <Link className="button button--secondary" to="/replan">从现在重新安排</Link>
      )}
    </section>
  )
}

function EmptyState({ action, description, title }: { action?: ReactNode; description: string; title: string }) {
  return (
    <div className="empty-state">
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  )
}

function LoadError({ message, onRetry }: { message: string; onRetry: () => unknown }) {
  return (
    <div className="inline-error" role="alert">
      <p>无法读取当前浏览器中的任务数据。{message}</p>
      <button className="button button--secondary" onClick={() => onRetry()} type="button">重新加载</button>
    </div>
  )
}

function formatToday(): string {
  return new Intl.DateTimeFormat('zh-CN', { dateStyle: 'long' }).format(new Date())
}
