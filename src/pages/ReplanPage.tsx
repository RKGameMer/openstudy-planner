import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTaskStore } from '../app/taskStoreContext'
import { useFeedback } from '../components/feedbackContext'
import type { Task } from '../models'
import type { ReplanAction, ReplanDecision, ReplanPreview, SplitTaskDraft } from '../services'

const actionLabels: Record<ReplanAction, string> = {
  continue: '今天继续',
  reduce: '缩小范围',
  split: '拆分任务',
  postpone: '改到其他日期',
  'return-to-library': '移回任务库',
  remove: '移除任务',
}

export function ReplanPage() {
  const store = useTaskStore()
  const feedback = useFeedback()
  const navigate = useNavigate()
  const candidates = store.getReplanCandidates()
  const [decisions, setDecisions] = useState<Record<string, ReplanDecision | undefined>>({})
  const [preview, setPreview] = useState<ReplanPreview | null>(null)
  const heading = (
    <div className="page-heading">
      <div>
        <h1 id="replan-page-title">从现在重新安排</h1>
        <p>根据现在的情况，重新决定每项未完成任务怎么处理。你可以暂时跳过，系统不会自动延期。</p>
      </div>
      <button className="button button--secondary" onClick={() => navigate('/')} type="button">返回今日</button>
    </div>
  )

  function selectAction(task: Task, action: ReplanAction) {
    setPreview(null)
    setDecisions((current) => ({ ...current, [task.id]: initialDecision(task, action) }))
  }

  function clearDecision(id: string) {
    setPreview(null)
    setDecisions((current) => ({ ...current, [id]: undefined }))
  }

  function updateDecision(id: string, decision: ReplanDecision) {
    setPreview(null)
    setDecisions((current) => ({ ...current, [id]: decision }))
  }

  function createPreview(): boolean {
    const result = store.previewReplan({ decisions })
    if (!result.ok) {
      feedback.showError(result.message)
      return false
    }

    setPreview(result.value)
    return true
  }

  function save() {
    if (preview === null) {
      createPreview()
      return
    }

    const result = store.applyReplan({ decisions })
    if (!result.ok) {
      feedback.showError(`重新安排没有保存成功。${result.message}`, save)
      return
    }

    feedback.showSuccess('重新安排已保存')
    navigate('/')
  }

  if (store.isLoading) {
    return (
      <section aria-labelledby="replan-page-title" className="page-section">
        {heading}
        <div className="empty-state" role="status">正在读取当前浏览器中的任务数据。</div>
      </section>
    )
  }

  if (store.loadError !== null) {
    return (
      <section aria-labelledby="replan-page-title" className="page-section">
        {heading}
        <div className="inline-error" role="alert">
          <p>无法读取当前浏览器中的任务数据。现有数据不会被自动覆盖。{store.loadError}</p>
          <button className="button button--secondary" onClick={() => store.reload()} type="button">重新加载</button>
        </div>
      </section>
    )
  }

  return (
    <section aria-labelledby="replan-page-title" className="page-section">
      {heading}

      {candidates.length === 0 ? (
        <div className="empty-state">
          <h2>当前没有需要重新安排的任务</h2>
          <p>已完成和已移除任务不会进入这里。</p>
          <button className="button" onClick={() => navigate('/')} type="button">返回今日</button>
        </div>
      ) : (
        <>
          <div className="replan-list">
            {candidates.map((task) => (
              <ReplanTaskEditor
                decision={decisions[task.id]}
                key={task.id}
                onClear={() => clearDecision(task.id)}
                onSelect={(action) => selectAction(task, action)}
                onUpdate={(decision) => updateDecision(task.id, decision)}
                task={task}
              />
            ))}
          </div>

          <section aria-labelledby="replan-preview-title" className="replan-preview">
            <div className="section-heading">
              <div>
                <h2 id="replan-preview-title">结果预览</h2>
                <p>只有你已选择的处理方式会在确认后保存。</p>
              </div>
              <button className="button button--secondary" onClick={createPreview} type="button">查看结果预览</button>
            </div>
            {preview === null ? (
              <p>请选择一项或多项处理方式后查看结果。未选择的任务保持原状。</p>
            ) : (
              <ul className="preview-list">
                {preview.items.map((item) => (
                  <li key={item.taskId}><strong>{item.title}</strong><span>{item.description}</span></li>
                ))}
              </ul>
            )}
          </section>

          <div className="button-row">
            <button className="button button--secondary" onClick={() => navigate('/')} type="button">取消</button>
            <button className="button" onClick={save} type="button">确认保存结果</button>
          </div>
        </>
      )}
    </section>
  )
}

function ReplanTaskEditor({
  decision,
  onClear,
  onSelect,
  onUpdate,
  task,
}: {
  decision: ReplanDecision | undefined
  onClear: () => void
  onSelect: (action: ReplanAction) => void
  onUpdate: (decision: ReplanDecision) => void
  task: Task
}) {
  return (
    <article className="replan-task">
      <div>
        <h2>{task.name}</h2>
        <p>{task.status}{task.subject !== null ? ` · ${task.subject}` : ''}{task.studyFormat !== null ? ` · ${task.studyFormat}` : ''}</p>
        {task.completionCriteria !== null && <p>完成标准：{task.completionCriteria}</p>}
      </div>
      <div aria-label={`${task.name}的重新安排方式`} className="filter-row" role="group">
        {(Object.keys(actionLabels) as ReplanAction[]).map((action) => (
          <button
            aria-pressed={decision?.action === action}
            className={`filter-button${decision?.action === action ? ' filter-button--selected' : ''}`}
            key={action}
            onClick={() => onSelect(action)}
            type="button"
          >
            {actionLabels[action]}
          </button>
        ))}
        {decision !== undefined && <button className="text-button" onClick={onClear} type="button">暂不处理</button>}
      </div>
      {decision !== undefined && <DecisionFields decision={decision} onUpdate={onUpdate} task={task} />}
    </article>
  )
}

function DecisionFields({
  decision,
  onUpdate,
  task,
}: {
  decision: ReplanDecision
  onUpdate: (decision: ReplanDecision) => void
  task: Task
}) {
  if (decision.action === 'continue') {
    return <p className="form-help">任务会保留原内容，并加入今天的重点；不会自动开始。</p>
  }

  if (decision.action === 'reduce') {
    return (
      <div className="form-details">
        <p className="form-help">请至少修改任务名称、内容范围或完成标准中的一项。</p>
        <InputField id={`${task.id}-reduced-name`} label="缩小后的任务名称" value={decision.name} onChange={(name) => onUpdate({ ...decision, name })} />
        <InputField id={`${task.id}-reduced-scope`} label="缩小后的内容范围" value={decision.contentScope ?? ''} onChange={(contentScope) => onUpdate({ ...decision, contentScope: emptyToNull(contentScope) })} />
        <InputField id={`${task.id}-reduced-criteria`} label="缩小后的完成标准" value={decision.completionCriteria ?? ''} onChange={(completionCriteria) => onUpdate({ ...decision, completionCriteria: emptyToNull(completionCriteria) })} />
        {task.status === '进行中' && (
          <label className="checkbox-field">
            <input checked={decision.resetInProgress === true} onChange={(event) => onUpdate({ ...decision, resetInProgress: event.target.checked })} type="checkbox" />
            <span>同时恢复为待处理</span>
          </label>
        )}
      </div>
    )
  }

  if (decision.action === 'split') {
    return (
      <div className="form-details">
        <p className="form-help">至少填写两个新任务名称。新任务默认待处理，不会自动全部加入今日重点。</p>
        {decision.tasks.map((splitTask, index) => (
          <SplitTaskFields
            draft={splitTask}
            index={index}
            key={index}
            taskId={task.id}
            onChange={(nextTask) => onUpdate({
              ...decision,
              tasks: decision.tasks.map((candidate, candidateIndex) => candidateIndex === index ? nextTask : candidate),
            })}
            onRemove={decision.tasks.length > 2 ? () => onUpdate({ ...decision, tasks: decision.tasks.filter((_, candidateIndex) => candidateIndex !== index) }) : undefined}
          />
        ))}
        <button className="button button--secondary" onClick={() => onUpdate({
          ...decision,
          tasks: [...decision.tasks, { name: '', inheritCategory: true, addToToday: false }],
        })} type="button">
          添加一个任务
        </button>
      </div>
    )
  }

  if (decision.action === 'postpone') {
    return (
      <div className="form-details">
        <label className="form-field" htmlFor={`${task.id}-postpone-date`}>
          <span>新的计划日期</span>
          <input id={`${task.id}-postpone-date`} onChange={(event) => onUpdate({ ...decision, plannedDate: event.target.value })} type="date" value={decision.plannedDate} />
        </label>
        <p className="form-help">日期必须晚于今天。任务不会自动加入目标日期的今日重点。</p>
      </div>
    )
  }

  if (decision.action === 'return-to-library') {
    return <p className="form-help">任务将移出今日重点并清除计划日期，保留在任务库。</p>
  }

  return <p className="form-help">任务将进入已移除列表，之后仍可恢复或永久删除。</p>
}

function SplitTaskFields({
  draft,
  index,
  onChange,
  onRemove,
  taskId,
}: {
  draft: SplitTaskDraft
  index: number
  onChange: (draft: SplitTaskDraft) => void
  onRemove?: () => void
  taskId: string
}) {
  return (
    <fieldset className="split-task-fields">
      <legend>新任务 {index + 1}</legend>
      <InputField id={`${taskId}-split-${index}-name`} label={`新任务 ${index + 1} 名称`} value={draft.name} onChange={(name) => onChange({ ...draft, name })} />
      <label className="checkbox-field">
        <input checked={draft.inheritCategory} onChange={(event) => onChange({ ...draft, inheritCategory: event.target.checked })} type="checkbox" />
        <span>继承原任务的科目和学习形式</span>
      </label>
      <label className="checkbox-field">
        <input checked={draft.addToToday} onChange={(event) => onChange({ ...draft, addToToday: event.target.checked })} type="checkbox" />
        <span>加入今天的重点</span>
      </label>
      {onRemove !== undefined && <button className="text-button" onClick={onRemove} type="button">移除此新任务</button>}
    </fieldset>
  )
}

function InputField({ id, label, onChange, value }: { id: string; label: string; onChange: (value: string) => void; value: string }) {
  return (
    <label className="form-field" htmlFor={id}>
      <span>{label}</span>
      <input id={id} onChange={(event) => onChange(event.target.value)} value={value} />
    </label>
  )
}

function initialDecision(task: Task, action: ReplanAction): ReplanDecision {
  switch (action) {
    case 'continue':
      return { action }
    case 'reduce':
      return {
        action,
        name: task.name,
        contentScope: task.contentScope,
        completionCriteria: task.completionCriteria,
      }
    case 'split':
      return {
        action,
        tasks: [
          { name: '', inheritCategory: true, addToToday: false },
          { name: '', inheritCategory: true, addToToday: false },
        ],
      }
    case 'postpone':
      return { action, plannedDate: '' }
    case 'return-to-library':
      return { action }
    case 'remove':
      return { action }
  }
}

function emptyToNull(value: string): string | null {
  return value.trim().length === 0 ? null : value
}
