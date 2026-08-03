import { createTask, isTask, isValidLocalDate, type Task, type TaskStatus } from '../models'
import { type TaskDataAccess } from '../data'
import { isActiveTask } from './taskService'

export type ReplanAction = 'continue' | 'reduce' | 'split' | 'postpone' | 'return-to-library' | 'remove'

export interface ContinueDecision {
  action: 'continue'
}

export interface ReduceDecision {
  action: 'reduce'
  name: string
  contentScope: string | null
  completionCriteria: string | null
  resetInProgress?: boolean
}

export interface SplitTaskDraft {
  name: string
  inheritCategory: boolean
  addToToday: boolean
}

export interface SplitDecision {
  action: 'split'
  tasks: SplitTaskDraft[]
}

export interface PostponeDecision {
  action: 'postpone'
  plannedDate: string
}

export interface ReturnToLibraryDecision {
  action: 'return-to-library'
}

export interface RemoveDecision {
  action: 'remove'
}

export type ReplanDecision =
  | ContinueDecision
  | ReduceDecision
  | SplitDecision
  | PostponeDecision
  | ReturnToLibraryDecision
  | RemoveDecision

export interface ReplanDraft {
  decisions: Readonly<Record<string, ReplanDecision | undefined>>
}

export interface ReplanPreviewItem {
  taskId: string
  title: string
  description: string
}

export interface ReplanPreview {
  items: ReplanPreviewItem[]
  taskCount: number
}

export interface ReplanServiceDependencies {
  dataAccess: TaskDataAccess
  createId?: () => string
  getToday?: () => string
  now?: () => Date
}

export class ReplanValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ReplanValidationError'
  }
}

export function createReplanService(dependencies: ReplanServiceDependencies) {
  const now = dependencies.now ?? (() => new Date())
  const getToday = dependencies.getToday ?? (() => localDate(now()))

  function preview(draft: ReplanDraft): ReplanPreview {
    const result = buildResult(dependencies.dataAccess.getAllTasks(), draft, getToday(), now, dependencies.createId)
    return result.preview
  }

  function apply(draft: ReplanDraft): Task[] {
    const result = buildResult(dependencies.dataAccess.getAllTasks(), draft, getToday(), now, dependencies.createId)
    dependencies.dataAccess.replaceAllData({
      storageFormatVersion: dependencies.dataAccess.getStorageFormatVersion(),
      tasks: result.tasks,
    })
    return dependencies.dataAccess.getAllTasks()
  }

  return { apply, preview }
}

export function buildResult(
  sourceTasks: readonly Task[],
  draft: ReplanDraft,
  today: string,
  now: () => Date,
  createId?: () => string,
): { tasks: Task[]; preview: ReplanPreview } {
  const currentDate = requireLocalDate(today)
  const decisions = Object.entries(draft.decisions).filter((entry): entry is [string, ReplanDecision] => entry[1] !== undefined)
  if (decisions.length === 0) {
    throw new ReplanValidationError('请至少为一项任务选择处理方式。')
  }

  const decisionsById = new Map(decisions)
  const knownIds = new Set(sourceTasks.map((task) => task.id))
  for (const [taskId] of decisions) {
    if (!knownIds.has(taskId)) {
      throw new ReplanValidationError('要重新安排的任务不存在，原数据没有变化。')
    }
  }

  const preview: ReplanPreviewItem[] = []
  const tasks: Task[] = []

  for (const sourceTask of sourceTasks) {
    const decision = decisionsById.get(sourceTask.id)
    if (decision === undefined) {
      tasks.push({ ...sourceTask })
      continue
    }

    if (!isActiveTask(sourceTask)) {
      throw new ReplanValidationError('已完成或已移除任务不能进入重新安排。')
    }

    const result = applyDecision(sourceTask, decision, currentDate, now, createId)
    tasks.push(...result.tasks)
    preview.push(result.preview)
  }

  const taskIds = new Set<string>()
  for (const task of tasks) {
    if (!isTask(task)) {
      throw new ReplanValidationError('重新安排结果不符合任务数据规则，原数据没有变化。')
    }

    if (taskIds.has(task.id)) {
      throw new ReplanValidationError('重新安排结果包含重复任务 ID，原数据没有变化。')
    }

    taskIds.add(task.id)
  }

  return { tasks, preview: { items: preview, taskCount: tasks.length } }
}

export function getReplanCandidates(tasks: readonly Task[], today: string): Task[] {
  const currentDate = requireLocalDate(today)
  return tasks.filter(
    (task) => isActiveTask(task) && task.todayPriorityDate !== null && task.todayPriorityDate <= currentDate,
  )
}

function applyDecision(
  task: Task,
  decision: ReplanDecision,
  today: string,
  now: () => Date,
  createId?: () => string,
): { tasks: Task[]; preview: ReplanPreviewItem } {
  switch (decision.action) {
    case 'continue': {
      const continued = withTodayPriority(task, today, now)
      return { tasks: [continued], preview: previewItem(task.id, task.name, '保留原内容并作为今天的重点。') }
    }
    case 'reduce': {
      const reduced = reduceTask(task, decision, today, now)
      return {
        tasks: [reduced],
        preview: previewItem(task.id, task.name, `缩小为“${reduced.name}”，保留为同一个任务。`),
      }
    }
    case 'split': {
      return splitTask(task, decision, today, now, createId)
    }
    case 'postpone': {
      const postponed = postponeTask(task, decision.plannedDate, today, now)
      return {
        tasks: [postponed],
        preview: previewItem(task.id, task.name, `改到 ${postponed.plannedDate}，不会自动加入该日重点。`),
      }
    }
    case 'return-to-library': {
      const returned = updateSystemFields(
        task,
        {
          plannedDate: null,
          status: task.status === '进行中' ? '待处理' : task.status,
          todayPriorityDate: null,
          todayPriorityAddedAt: null,
        },
        now,
      )
      return { tasks: [returned], preview: previewItem(task.id, task.name, '移回任务库并清除计划日期和今日重点。') }
    }
    case 'remove': {
      const removed = updateSystemFields(
        task,
        { status: '已移除', todayPriorityDate: null, todayPriorityAddedAt: null },
        now,
      )
      return { tasks: [removed], preview: previewItem(task.id, task.name, '移入已移除列表，之后仍可恢复。') }
    }
  }
}

function reduceTask(task: Task, decision: ReduceDecision, today: string, now: () => Date): Task {
  const name = normalizeRequiredName(decision.name)
  const contentScope = normalizeText(decision.contentScope)
  const completionCriteria = normalizeText(decision.completionCriteria)
  if (name === task.name && contentScope === task.contentScope && completionCriteria === task.completionCriteria) {
    throw new ReplanValidationError('请至少修改任务名称、内容范围或完成标准中的一项。')
  }

  const status: TaskStatus =
    task.status === '进行中' && decision.resetInProgress === true ? '待处理' : task.status
  return withTodayPriority(
    updateSystemFields(task, { name, contentScope, completionCriteria, status }, now),
    today,
    now,
  )
}

function splitTask(
  task: Task,
  decision: SplitDecision,
  today: string,
  now: () => Date,
  createId?: () => string,
): { tasks: Task[]; preview: ReplanPreviewItem } {
  const validDrafts = decision.tasks.filter((draft) => draft.name.trim().length > 0)
  if (validDrafts.length < 2) {
    throw new ReplanValidationError('请至少填写两个新任务。')
  }

  const newTasks = validDrafts.map((draft) =>
    createTask(
      {
        name: draft.name,
        subject: draft.inheritCategory ? task.subject : null,
        studyFormat: draft.inheritCategory ? task.studyFormat : null,
        todayPriorityDate: draft.addToToday ? today : null,
      },
      { now, createId },
    ),
  )
  const removedOriginal = updateSystemFields(
    task,
    { status: '已移除', todayPriorityDate: null, todayPriorityAddedAt: null },
    now,
  )
  const names = newTasks.map((newTask) => `“${newTask.name}”`).join('、')
  return {
    tasks: [removedOriginal, ...newTasks],
    preview: previewItem(task.id, task.name, `拆分为${names}，原任务会移入已移除列表。`),
  }
}

function postponeTask(task: Task, plannedDate: string, today: string, now: () => Date): Task {
  if (!isValidLocalDate(plannedDate) || plannedDate <= today) {
    throw new ReplanValidationError('请选择晚于今天的日期。')
  }

  return updateSystemFields(
    task,
    {
      plannedDate,
      status: task.status === '进行中' ? '待处理' : task.status,
      todayPriorityDate: null,
      todayPriorityAddedAt: null,
    },
    now,
  )
}

function withTodayPriority(task: Task, today: string, now: () => Date): Task {
  const timestamp = timestampFor(now)
  return {
    ...task,
    todayPriorityDate: today,
    todayPriorityAddedAt: task.todayPriorityDate === today ? (task.todayPriorityAddedAt ?? task.updatedAt) : timestamp,
    updatedAt: timestamp,
  }
}

function updateSystemFields(
  task: Task,
  changes: Partial<Pick<Task, 'name' | 'contentScope' | 'completionCriteria' | 'plannedDate' | 'todayPriorityDate' | 'todayPriorityAddedAt' | 'status'>>,
  now: () => Date,
): Task {
  return { ...task, ...changes, updatedAt: timestampFor(now) }
}

function previewItem(taskId: string, title: string, description: string): ReplanPreviewItem {
  return { taskId, title, description }
}

function normalizeRequiredName(value: string): string {
  const name = value.trim()
  if (name.length === 0) {
    throw new ReplanValidationError('缩小后的任务名称不能为空。')
  }

  return name
}

function normalizeText(value: string | null): string | null {
  return value === null || value.trim().length === 0 ? null : value
}

function timestampFor(now: () => Date): string {
  const timestamp = now()
  if (Number.isNaN(timestamp.getTime())) {
    throw new ReplanValidationError('当前时间无效，重新安排没有保存。')
  }

  return timestamp.toISOString()
}

function requireLocalDate(value: string): string {
  if (!isValidLocalDate(value)) {
    throw new ReplanValidationError('当前日期无效，重新安排没有保存。')
  }

  return value
}

function localDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
