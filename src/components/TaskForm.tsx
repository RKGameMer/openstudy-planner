import { useState, type FormEvent } from 'react'
import { STUDY_FORMATS, TASK_SUBJECTS, type Task, type TaskSubject, type StudyFormat } from '../models'
import { useTaskStore } from '../app/taskStoreContext'
import { useFeedback } from './feedbackContext'

type TaskFormProps = {
  task?: Task
  defaultAddToToday?: boolean
  defaultName?: string
  isTodayPriority?: boolean
  onCancel: () => void
  onSaved: () => void
  priorityCount: number
}

type TaskFormValues = {
  name: string
  subject: TaskSubject | null
  studyFormat: StudyFormat | null
  contentScope: string
  nextStep: string
  completionCriteria: string
  plannedDate: string
  notes: string
  actualDurationMinutes: string
  actualCompletion: string
  addToToday: boolean
}

export function TaskForm({
  task,
  defaultAddToToday = false,
  defaultName = '',
  isTodayPriority = false,
  onCancel,
  onSaved,
  priorityCount,
}: TaskFormProps) {
  const store = useTaskStore()
  const feedback = useFeedback()
  const [showDetails, setShowDetails] = useState(task !== undefined)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [values, setValues] = useState<TaskFormValues>(() =>
    initialValues(task, defaultName, defaultAddToToday, isTodayPriority),
  )
  const isEditing = task !== undefined

  function setValue<Key extends keyof TaskFormValues>(key: Key, value: TaskFormValues[Key]) {
    setValues((current) => ({ ...current, [key]: value }))
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextFieldErrors = validate(values)
    setFieldErrors(nextFieldErrors)
    if (Object.keys(nextFieldErrors).length > 0) {
      return
    }

    const performSave = () => {
      const input = toTaskInput(values)
      const result = isEditing
        ? store.updateTask(task.id, {
            ...input,
            todayPriority: values.addToToday === isTodayPriority ? undefined : values.addToToday,
          })
        : store.createTask(input, values.addToToday)

      if (!result.ok) {
        feedback.showError(`任务没有保存成功。${result.message}`, performSave)
        return
      }

      feedback.showSuccess(isEditing ? '任务已保存' : '任务已创建')
      onSaved()
    }

    const isNewTodayPriority = values.addToToday && (!isEditing || !isTodayPriority)
    if (isNewTodayPriority && priorityCount >= 3) {
      feedback.requestConfirmation({
        title: '当前重点已超过建议数量',
        description: '建议保留1—3项当前重点，你仍然可以继续添加。',
        confirmLabel: '继续添加',
        cancelLabel: '返回查看当前重点',
        onConfirm: performSave,
      })
      return
    }

    performSave()
  }

  return (
    <section aria-labelledby="task-form-title" className="task-form-panel">
      <div className="section-heading">
        <div>
          <h2 id="task-form-title">{isEditing ? '任务详情' : '新建任务'}</h2>
          <p>{isEditing ? `当前状态：${task.status}` : '只需要填写任务名称，其他信息均可跳过。'}</p>
        </div>
        <button className="button button--secondary" onClick={onCancel} type="button">
          取消
        </button>
      </div>
      <form onSubmit={submit}>
        <label className="form-field" htmlFor="task-name">
          <span>任务名称 <strong aria-label="必填">*</strong></span>
          <input
            aria-describedby={fieldErrors.name === undefined ? undefined : 'task-name-error'}
            autoFocus
            id="task-name"
            onChange={(event) => setValue('name', event.target.value)}
            value={values.name}
          />
          {fieldErrors.name !== undefined && <small className="field-error" id="task-name-error">{fieldErrors.name}</small>}
        </label>

        <fieldset className="choice-group">
          <legend>科目（可选）</legend>
          <div className="choice-row">
            {TASK_SUBJECTS.map((subject) => (
              <button
                aria-pressed={values.subject === subject}
                className={`choice-button${values.subject === subject ? ' choice-button--selected' : ''}`}
                key={subject}
                onClick={() => setValue('subject', subject)}
                type="button"
              >
                {subject}
              </button>
            ))}
            {values.subject !== null && (
              <button className="choice-button" onClick={() => setValue('subject', null)} type="button">
                清除
              </button>
            )}
          </div>
        </fieldset>

        <fieldset className="choice-group">
          <legend>学习形式（可选）</legend>
          <div className="choice-row">
            {STUDY_FORMATS.map((studyFormat) => (
              <button
                aria-pressed={values.studyFormat === studyFormat}
                className={`choice-button${values.studyFormat === studyFormat ? ' choice-button--selected' : ''}`}
                key={studyFormat}
                onClick={() => setValue('studyFormat', studyFormat)}
                type="button"
              >
                {studyFormat}
              </button>
            ))}
            {values.studyFormat !== null && (
              <button className="choice-button" onClick={() => setValue('studyFormat', null)} type="button">
                清除
              </button>
            )}
          </div>
        </fieldset>

        <button className="text-button" onClick={() => setShowDetails((visible) => !visible)} type="button">
          {showDetails ? '收起补充信息' : '补充信息（可选）'}
        </button>

        {showDetails && (
          <div className="form-details">
            <TextField label="内容范围" onChange={(value) => setValue('contentScope', value)} value={values.contentScope} />
            <TextField label="下一步先做什么" onChange={(value) => setValue('nextStep', value)} value={values.nextStep} />
            <TextField
              label="做到什么程度算完成"
              onChange={(value) => setValue('completionCriteria', value)}
              value={values.completionCriteria}
            />
            <label className="form-field" htmlFor="planned-date">
              <span>计划日期（可选）</span>
              <input id="planned-date" onChange={(event) => setValue('plannedDate', event.target.value)} type="date" value={values.plannedDate} />
            </label>
            <TextField label="备注" multiline onChange={(value) => setValue('notes', value)} value={values.notes} />
            {isEditing && (
              <>
                <label className="form-field" htmlFor="actual-duration">
                  <span>实际用时（分钟，可选）</span>
                  <input
                    aria-describedby={fieldErrors.actualDurationMinutes === undefined ? undefined : 'duration-error'}
                    id="actual-duration"
                    min="1"
                    onChange={(event) => setValue('actualDurationMinutes', event.target.value)}
                    type="number"
                    value={values.actualDurationMinutes}
                  />
                  {fieldErrors.actualDurationMinutes !== undefined && (
                    <small className="field-error" id="duration-error">{fieldErrors.actualDurationMinutes}</small>
                  )}
                </label>
                <TextField
                  label="实际完成情况"
                  multiline
                  onChange={(value) => setValue('actualCompletion', value)}
                  value={values.actualCompletion}
                />
              </>
            )}
          </div>
        )}

        <label className="checkbox-field">
          <input
            checked={values.addToToday}
            disabled={isEditing && (task.status === '已完成' || task.status === '已移除')}
            onChange={(event) => setValue('addToToday', event.target.checked)}
            type="checkbox"
          />
          <span>{isEditing && values.addToToday ? '已在今日重点' : '保存后加入今日重点'}</span>
        </label>
        {isEditing && (task.status === '已完成' || task.status === '已移除') && (
          <p className="form-help">已完成任务需先重新打开，已移除任务需先恢复后才能加入今日重点。</p>
        )}

        <div className="button-row">
          <button className="button button--secondary" onClick={onCancel} type="button">
            取消
          </button>
          <button className="button" type="submit">保存</button>
        </div>
      </form>
    </section>
  )
}

function TextField({
  label,
  multiline = false,
  onChange,
  value,
}: {
  label: string
  multiline?: boolean
  onChange: (value: string) => void
  value: string
}) {
  const id = label === '备注' ? 'task-notes' : undefined
  return (
    <label className="form-field" htmlFor={id}>
      <span>{label}（可选）</span>
      {multiline ? (
        <textarea id={id} onChange={(event) => onChange(event.target.value)} rows={3} value={value} />
      ) : (
        <input onChange={(event) => onChange(event.target.value)} value={value} />
      )}
    </label>
  )
}

function initialValues(
  task: Task | undefined,
  defaultName: string,
  defaultAddToToday: boolean,
  isTodayPriority: boolean,
): TaskFormValues {
  return {
    name: task?.name ?? defaultName,
    subject: task?.subject ?? null,
    studyFormat: task?.studyFormat ?? null,
    contentScope: task?.contentScope ?? '',
    nextStep: task?.nextStep ?? '',
    completionCriteria: task?.completionCriteria ?? '',
    plannedDate: task?.plannedDate ?? '',
    notes: task?.notes ?? '',
    actualDurationMinutes: task?.actualDurationMinutes?.toString() ?? '',
    actualCompletion: task?.actualCompletion ?? '',
    addToToday: task === undefined ? defaultAddToToday : isTodayPriority,
  }
}

function validate(values: TaskFormValues): Record<string, string> {
  const errors: Record<string, string> = {}
  if (values.name.trim().length === 0) {
    errors.name = '请填写任务名称。'
  }

  if (values.actualDurationMinutes.trim().length > 0 && !/^[1-9]\d*$/.test(values.actualDurationMinutes.trim())) {
    errors.actualDurationMinutes = '实际用时必须是正整数分钟。'
  }

  return errors
}

function toTaskInput(values: TaskFormValues) {
  return {
    name: values.name,
    subject: values.subject,
    studyFormat: values.studyFormat,
    contentScope: emptyToNull(values.contentScope),
    nextStep: emptyToNull(values.nextStep),
    completionCriteria: emptyToNull(values.completionCriteria),
    plannedDate: emptyToNull(values.plannedDate),
    notes: emptyToNull(values.notes),
    actualDurationMinutes:
      values.actualDurationMinutes.trim().length === 0 ? null : Number(values.actualDurationMinutes.trim()),
    actualCompletion: emptyToNull(values.actualCompletion),
  }
}

function emptyToNull(value: string): string | null {
  return value.trim().length === 0 ? null : value
}
