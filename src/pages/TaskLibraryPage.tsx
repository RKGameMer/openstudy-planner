import { useState } from 'react'
import { useTaskStore } from '../app/taskStoreContext'
import { TaskCard } from '../components/TaskCard'
import { TaskForm } from '../components/TaskForm'
import type { Task } from '../models'
import type { TaskListFilter } from '../services'

const filters: readonly TaskListFilter[] = ['活跃', '待处理', '进行中', '部分完成', '已完成', '已移除']

export function TaskLibraryPage() {
  const store = useTaskStore()
  const [filter, setFilter] = useState<TaskListFilter>('活跃')
  const [formTask, setFormTask] = useState<Task | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const tasks = store.getTasksByFilter(filter)
  const todayIds = new Set(store.getTodayPriority().map((task) => task.id))
  const canCreate = !store.isLoading && store.loadError === null
  const heading = (
    <div className="page-heading">
      <div>
        <h1 id="task-library-page-title">任务库</h1>
        <p>集中查看活跃、已完成和已移除的任务。</p>
      </div>
      {canCreate && (
        <button className="button" onClick={() => {
          setFormTask(null)
          setIsCreating(true)
        }} type="button">
          新建任务
        </button>
      )}
    </div>
  )

  if (store.isLoading) {
    return (
      <section aria-labelledby="task-library-page-title" className="page-section">
        {heading}
        <div className="empty-state" role="status">正在读取当前浏览器中的任务数据。</div>
      </section>
    )
  }

  if (store.loadError !== null) {
    return (
      <section aria-labelledby="task-library-page-title" className="page-section">
        {heading}
        <div className="inline-error" role="alert">
          <p>无法读取任务列表。现有数据不会被自动覆盖。{store.loadError}</p>
          <button className="button button--secondary" onClick={() => store.reload()} type="button">重新加载</button>
        </div>
      </section>
    )
  }

  return (
    <section aria-labelledby="task-library-page-title" className="page-section">
      {heading}

      {(isCreating || formTask !== null) && (
        <TaskForm
          defaultAddToToday={false}
          onCancel={() => {
            setFormTask(null)
            setIsCreating(false)
          }}
          onSaved={() => {
            setFormTask(null)
            setIsCreating(false)
          }}
          priorityCount={todayIds.size}
          isTodayPriority={formTask !== null && todayIds.has(formTask.id)}
          task={formTask ?? undefined}
        />
      )}

      <div aria-label="按任务状态筛选" className="filter-row" role="group">
        {filters.map((item) => (
          <button
            aria-pressed={filter === item}
            className={`filter-button${filter === item ? ' filter-button--selected' : ''}`}
            key={item}
            onClick={() => setFilter(item)}
            type="button"
          >
            {item}
          </button>
        ))}
      </div>

      {tasks.length > 0 ? (
        <div className="task-list">
          {tasks.map((task) => (
            <TaskCard
              isTodayPriority={todayIds.has(task.id)}
              key={task.id}
              onEdit={(selectedTask) => {
                setFormTask(selectedTask)
                setIsCreating(false)
              }}
              task={task}
            />
          ))}
        </div>
      ) : (
        <LibraryEmptyState
          filter={filter}
          hasAnyTasks={store.tasks.length > 0}
          onCreate={() => setIsCreating(true)}
          onShowActive={() => setFilter('活跃')}
        />
      )}
    </section>
  )
}

function LibraryEmptyState({
  filter,
  hasAnyTasks,
  onCreate,
  onShowActive,
}: {
  filter: TaskListFilter
  hasAnyTasks: boolean
  onCreate: () => void
  onShowActive: () => void
}) {
  if (filter === '已移除') {
    return (
      <div className="empty-state">
        <h2>暂无已移除任务</h2>
        <p>被移除的任务会保留在这里，直到你恢复或永久删除。</p>
      </div>
    )
  }

  if (filter === '活跃' && !hasAnyTasks) {
    return (
      <div className="empty-state">
        <h2>任务库还是空的</h2>
        <p>创建一个任务，只需要填写任务名称。</p>
        <button className="button" onClick={onCreate} type="button">新建第一个任务</button>
      </div>
    )
  }

  return (
    <div className="empty-state">
      <h2>暂无{filter}任务</h2>
      <p>可以切换筛选查看其他任务。</p>
      <button className="button button--secondary" onClick={onShowActive} type="button">查看活跃任务</button>
    </div>
  )
}
