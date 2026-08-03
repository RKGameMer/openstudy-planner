import type { Task } from '../models'
import { useTaskStore } from '../app/taskStoreContext'
import { useFeedback } from './feedbackContext'

type TaskCardProps = {
  task: Task
  isTodayPriority: boolean
  onEdit: (task: Task) => void
}

export function TaskCard({ task, isTodayPriority, onEdit }: TaskCardProps) {
  const store = useTaskStore()
  const feedback = useFeedback()

  function handleResult(
    result: { ok: true; value: unknown } | { ok: false; message: string },
    successText: string,
    retry?: () => void,
  ) {
    if (result.ok) {
      feedback.showSuccess(successText)
      return
    }

    feedback.showError(result.message, retry)
  }

  function addToToday() {
    const currentPriorityCount = store.getTodayPriority().length
    const save = () => handleResult(store.addToTodayPriority(task.id), '已加入今日重点', save)
    if (currentPriorityCount >= 3) {
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

  function permanentlyDelete() {
    feedback.requestConfirmation({
      title: '永久删除这个任务？',
      description: '删除后，任务将不再出现在任务库、今日重点或已移除列表中。此操作无法通过应用恢复。',
      confirmLabel: '永久删除',
      danger: true,
      onConfirm: () => {
        const remove = () => handleResult(store.permanentlyDelete(task.id), '任务已永久删除', remove)
        remove()
      },
    })
  }

  return (
    <article className="task-card">
      <div className="task-card__summary">
        <button className="task-card__title" onClick={() => onEdit(task)} type="button">
          {task.name}
        </button>
        <div className="task-card__meta">
          {task.subject !== null && <span className="tag">{task.subject}</span>}
          {task.studyFormat !== null && <span className="tag">{task.studyFormat}</span>}
          <span className="tag tag--status">状态：{task.status}</span>
          {task.plannedDate !== null && <span>计划：{task.plannedDate}</span>}
          {isTodayPriority && <span className="tag tag--priority">今日重点</span>}
        </div>
        {task.nextStep !== null && <p>下一步：{task.nextStep}</p>}
        {task.completionCriteria !== null && <p>完成标准：{task.completionCriteria}</p>}
      </div>
      <div aria-label={`${task.name}的操作`} className="task-card__actions" role="group">
        {task.status === '待处理' && (
          <button className="button" onClick={() => {
            const start = () => handleResult(store.transitionTask(task.id, '进行中'), '任务已开始', start)
            start()
          }} type="button">
            开始
          </button>
        )}
        {task.status === '进行中' && (
          <>
            <button className="button button--secondary" onClick={() => {
              const markPartial = () => handleResult(store.transitionTask(task.id, '部分完成'), '已标记为部分完成', markPartial)
              markPartial()
            }} type="button">
              标记部分完成
            </button>
            <button className="button" onClick={() => {
              const complete = () => handleResult(store.transitionTask(task.id, '已完成'), '已标记完成', complete)
              complete()
            }} type="button">
              标记完成
            </button>
          </>
        )}
        {task.status === '部分完成' && (
          <>
            <button className="button" onClick={() => {
              const resume = () => handleResult(store.transitionTask(task.id, '进行中'), '任务已继续', resume)
              resume()
            }} type="button">
              继续
            </button>
            <button className="button button--secondary" onClick={() => {
              const complete = () => handleResult(store.transitionTask(task.id, '已完成'), '已标记完成', complete)
              complete()
            }} type="button">
              标记完成
            </button>
          </>
        )}
        {task.status === '已完成' && (
          <button className="button" onClick={() => {
            const reopen = () => handleResult(store.transitionTask(task.id, '待处理'), '任务已重新打开', reopen)
            reopen()
          }} type="button">
            重新打开
          </button>
        )}
        {task.status === '已移除' && (
          <button className="button" onClick={() => {
            const restore = () => handleResult(store.transitionTask(task.id, '待处理'), '任务已恢复为待处理', restore)
            restore()
          }} type="button">
            恢复
          </button>
        )}

        {task.status !== '已移除' && !isTodayPriority && task.status !== '已完成' && (
          <button className="button button--secondary" onClick={addToToday} type="button">
            加入今日重点
          </button>
        )}
        {isTodayPriority && (
          <button className="button button--secondary" onClick={() => {
            const remove = () => handleResult(store.removeFromTodayPriority(task.id), '已移出今日重点', remove)
            remove()
          }} type="button">
            移出今日重点
          </button>
        )}
        <details className="task-card__more-actions">
          <summary>更多操作</summary>
          <div className="task-card__more-actions-content">
            <button className="button button--quiet" onClick={() => onEdit(task)} type="button">
              编辑
            </button>
            {task.status === '待处理' && (
              <button className="button button--quiet" onClick={() => {
                const complete = () => handleResult(store.transitionTask(task.id, '已完成'), '已标记完成', complete)
                complete()
              }} type="button">
                标记完成
              </button>
            )}
            {task.status === '进行中' && (
              <button className="button button--quiet" onClick={() => {
                const reset = () => handleResult(store.transitionTask(task.id, '待处理'), '已恢复为待处理', reset)
                reset()
              }} type="button">
                标记为待处理
              </button>
            )}
            {task.status !== '已移除' && (
              <button className="button button--quiet" onClick={() => {
                const remove = () => handleResult(
                  store.transitionTask(task.id, '已移除'),
                  '任务已移除，可在已移除筛选中恢复',
                  remove,
                )
                remove()
              }} type="button">
                移除任务
              </button>
            )}
            <button className="button button--danger-outline" onClick={permanentlyDelete} type="button">
              永久删除
            </button>
          </div>
        </details>
      </div>
    </article>
  )
}
