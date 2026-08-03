import {
  createTask,
  isTask,
  isTaskStatus,
  isValidLocalDate,
  TaskValidationError,
  type CreateTaskInput,
  type Task,
  type TaskStatus,
} from '../models'
import { TaskNotFoundError, type TaskDataAccess } from '../data'

export type ActiveTaskStatus = Extract<TaskStatus, '待处理' | '进行中' | '部分完成'>
export type TaskListFilter = '活跃' | TaskStatus

export interface UpdateTaskInput {
  name?: string
  subject?: Task['subject']
  studyFormat?: Task['studyFormat']
  contentScope?: string | null
  nextStep?: string | null
  completionCriteria?: string | null
  plannedDate?: string | null
  notes?: string | null
  actualDurationMinutes?: number | null
  actualCompletion?: string | null
  todayPriority?: boolean
}

export interface TaskServiceDependencies {
  dataAccess: TaskDataAccess
  now?: () => Date
  createId?: () => string
  getToday?: () => string
}

export class TaskBusinessRuleError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TaskBusinessRuleError'
  }
}

const ACTIVE_STATUSES: readonly ActiveTaskStatus[] = ['待处理', '进行中', '部分完成']

const ALLOWED_TRANSITIONS: Readonly<Record<TaskStatus, readonly TaskStatus[]>> = {
  待处理: ['进行中', '已完成', '已移除'],
  进行中: ['待处理', '部分完成', '已完成', '已移除'],
  部分完成: ['进行中', '已完成', '已移除'],
  已完成: ['待处理', '已移除'],
  已移除: ['待处理'],
}

export function createTaskService(dependencies: TaskServiceDependencies) {
  const now = dependencies.now ?? (() => new Date())
  const getToday = dependencies.getToday ?? (() => toLocalDate(now()))

  function getAllTasks(): Task[] {
    return dependencies.dataAccess.getAllTasks()
  }

  function getTask(id: string): Task {
    const task = dependencies.dataAccess.getTaskById(id)
    if (task === null) {
      throw new TaskNotFoundError()
    }

    return task
  }

  function create(input: CreateTaskInput, options: { addToToday?: boolean } = {}): Task {
    const todayPriorityDate = options.addToToday
      ? requireLocalDate(getToday())
      : (input.todayPriorityDate ?? null)
    const task = createTask(
      {
        ...input,
        todayPriorityDate,
        todayPriorityAddedAt: todayPriorityDate === null ? null : createTimestamp(now),
      },
      { now, createId: dependencies.createId },
    )
    return dependencies.dataAccess.addTask(task)
  }

  function update(id: string, input: UpdateTaskInput): Task {
    const existing = getTask(id)
    const todayPriorityDate = resolveUpdatedPriorityDate(existing, input.todayPriority)
    const todayPriorityAddedAt =
      todayPriorityDate === null
        ? null
        : existing.todayPriorityDate === todayPriorityDate
          ? (existing.todayPriorityAddedAt ?? existing.updatedAt)
          : createTimestamp(now)
    const candidate = createTask(
      {
        name: input.name ?? existing.name,
        subject: valueOrExisting(input.subject, existing.subject),
        studyFormat: valueOrExisting(input.studyFormat, existing.studyFormat),
        contentScope: valueOrExisting(input.contentScope, existing.contentScope),
        nextStep: valueOrExisting(input.nextStep, existing.nextStep),
        completionCriteria: valueOrExisting(input.completionCriteria, existing.completionCriteria),
        plannedDate: valueOrExisting(input.plannedDate, existing.plannedDate),
        todayPriorityDate,
        todayPriorityAddedAt,
        notes: valueOrExisting(input.notes, existing.notes),
        actualDurationMinutes: valueOrExisting(input.actualDurationMinutes, existing.actualDurationMinutes),
        actualCompletion: valueOrExisting(input.actualCompletion, existing.actualCompletion),
      },
      { now, createId: () => existing.id },
    )

    return dependencies.dataAccess.updateTask({
      ...candidate,
      status: existing.status,
      createdAt: existing.createdAt,
    })
  }

  function getTasksByFilter(filter: TaskListFilter): Task[] {
    return filterTasks(getAllTasks(), filter)
  }

  function getTodayPriority(today = getToday()): Task[] {
    return getTodayPriorityTasks(getAllTasks(), today)
  }

  function getPastUnresolvedPriorities(today = getToday()): Task[] {
    return getPastUnresolvedPriorityTasks(getAllTasks(), today)
  }

  function addToTodayPriority(id: string, today = getToday()): Task {
    const task = getTask(id)
    if (!isActiveTask(task)) {
      throw new TaskBusinessRuleError('只有待处理、进行中或部分完成任务可以加入今日重点。')
    }

    const priorityDate = requireLocalDate(today)
    if (task.todayPriorityDate === priorityDate) {
      return task
    }

    return saveTask({
      ...task,
      todayPriorityDate: priorityDate,
      todayPriorityAddedAt: createTimestamp(now),
      updatedAt: createTimestamp(now),
    })
  }

  function removeFromTodayPriority(id: string): Task {
    const task = getTask(id)
    if (task.todayPriorityDate === null) {
      return task
    }

    return saveTask({
      ...task,
      todayPriorityDate: null,
      todayPriorityAddedAt: null,
      updatedAt: createTimestamp(now),
    })
  }

  function transitionStatus(id: string, targetStatus: TaskStatus): Task {
    if (!isTaskStatus(targetStatus)) {
      throw new TaskBusinessRuleError('目标任务状态不受支持。')
    }

    const task = getTask(id)
    if (!ALLOWED_TRANSITIONS[task.status].includes(targetStatus)) {
      throw new TaskBusinessRuleError(`任务不能从“${task.status}”改为“${targetStatus}”。`)
    }

    const shouldRemovePriority = targetStatus === '已完成' || targetStatus === '已移除'
    return saveTask({
      ...task,
      status: targetStatus,
      todayPriorityDate: shouldRemovePriority ? null : task.todayPriorityDate,
      todayPriorityAddedAt: shouldRemovePriority ? null : task.todayPriorityAddedAt,
      updatedAt: createTimestamp(now),
    })
  }

  function permanentlyDelete(id: string): boolean {
    getTask(id)
    return dependencies.dataAccess.deleteTask(id)
  }

  function saveTask(task: Task): Task {
    if (!isTask(task)) {
      throw new TaskBusinessRuleError('准备保存的任务不符合数据规则，操作没有保存。')
    }

    return dependencies.dataAccess.updateTask(task)
  }

  function resolveUpdatedPriorityDate(task: Task, todayPriority: boolean | undefined): string | null {
    if (todayPriority === undefined) {
      return task.todayPriorityDate
    }

    if (!todayPriority) {
      return null
    }

    if (!isActiveTask(task)) {
      throw new TaskBusinessRuleError('只有待处理、进行中或部分完成任务可以加入今日重点。')
    }

    return requireLocalDate(getToday())
  }

  return {
    addToTodayPriority,
    create,
    getAllTasks,
    getPastUnresolvedPriorities,
    getTask,
    getTasksByFilter,
    getTodayPriority,
    permanentlyDelete,
    removeFromTodayPriority,
    transitionStatus,
    update,
  }
}

export function isActiveTask(task: Task): task is Task & { status: ActiveTaskStatus } {
  return ACTIVE_STATUSES.includes(task.status as ActiveTaskStatus)
}

export function filterTasks(tasks: readonly Task[], filter: TaskListFilter): Task[] {
  if (filter === '活跃') {
    return tasks.filter(isActiveTask)
  }

  return tasks.filter((task) => task.status === filter)
}

export function getTodayPriorityTasks(tasks: readonly Task[], today: string): Task[] {
  const priorityDate = requireLocalDate(today)
  return tasks
    .map((task, index) => ({ task, index }))
    .filter(({ task }) => task.todayPriorityDate === priorityDate && isActiveTask(task))
    .sort((first, second) => {
      const firstAddedAt = first.task.todayPriorityAddedAt ?? first.task.updatedAt
      const secondAddedAt = second.task.todayPriorityAddedAt ?? second.task.updatedAt
      const timestampComparison = firstAddedAt.localeCompare(secondAddedAt)
      return timestampComparison === 0 ? first.index - second.index : timestampComparison
    })
    .map(({ task }) => task)
}

export function getPastUnresolvedPriorityTasks(tasks: readonly Task[], today: string): Task[] {
  const currentDate = requireLocalDate(today)
  return tasks.filter(
    (task) => task.todayPriorityDate !== null && task.todayPriorityDate < currentDate && isActiveTask(task),
  )
}

export function getCurrentLocalDate(date = new Date()): string {
  return toLocalDate(date)
}

function createTimestamp(now: () => Date): string {
  const timestamp = now()
  if (Number.isNaN(timestamp.getTime())) {
    throw new TaskValidationError('timestamp', '时间戳生成失败。')
  }

  return timestamp.toISOString()
}

function requireLocalDate(value: string): string {
  if (!isValidLocalDate(value)) {
    throw new TaskBusinessRuleError('当前日期无效，操作没有保存。')
  }

  return value
}

function toLocalDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function valueOrExisting<T>(value: T | undefined, existing: T): T {
  return value === undefined ? existing : value
}
