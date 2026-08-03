/**
 * A task's optional user fields are always stored as `null` when unfilled.
 * `undefined` is accepted only at the factory input boundary, where it is
 * normalized to `null` before the task object is created.
 */
export const TASK_DATA_FORMAT_VERSION = 1 as const

export const TASK_SUBJECTS = ['语文', '数学', '英语', '其他'] as const
export type TaskSubject = (typeof TASK_SUBJECTS)[number]

export const STUDY_FORMATS = [
  '录播课',
  '直播课',
  '自学',
  '刷题',
  '复习',
  '测试',
  '其他',
] as const
export type StudyFormat = (typeof STUDY_FORMATS)[number]

export const TASK_STATUSES = ['待处理', '进行中', '部分完成', '已完成', '已移除'] as const
export type TaskStatus = (typeof TASK_STATUSES)[number]

/** A plain local calendar date. It is never converted to a UTC date. */
export type LocalDate = string

/** An ISO 8601 UTC timestamp generated with Date#toISOString(). */
export type IsoTimestamp = string

export interface Task {
  dataFormatVersion: typeof TASK_DATA_FORMAT_VERSION
  id: string
  name: string
  subject: TaskSubject | null
  studyFormat: StudyFormat | null
  contentScope: string | null
  nextStep: string | null
  completionCriteria: string | null
  plannedDate: LocalDate | null
  todayPriorityDate: LocalDate | null
  /**
   * Records the moment a task was most recently added to today's priorities.
   * Older v1 snapshots may omit this field; the business layer falls back to
   * their persisted task order until they are next updated.
   */
  todayPriorityAddedAt?: IsoTimestamp | null
  status: TaskStatus
  notes: string | null
  actualDurationMinutes: number | null
  actualCompletion: string | null
  createdAt: IsoTimestamp
  updatedAt: IsoTimestamp
}

export interface CreateTaskInput {
  name: string
  subject?: TaskSubject | null
  studyFormat?: StudyFormat | null
  contentScope?: string | null
  nextStep?: string | null
  completionCriteria?: string | null
  plannedDate?: LocalDate | null
  todayPriorityDate?: LocalDate | null
  todayPriorityAddedAt?: IsoTimestamp | null
  notes?: string | null
  actualDurationMinutes?: number | null
  actualCompletion?: string | null
}

export interface CreateTaskDependencies {
  createId?: () => string
  now?: () => Date
}

export class TaskValidationError extends Error {
  readonly field: string

  constructor(field: string, message: string) {
    super(message)
    this.name = 'TaskValidationError'
    this.field = field
  }
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const LOCAL_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

export function isTaskSubject(value: unknown): value is TaskSubject {
  return typeof value === 'string' && TASK_SUBJECTS.includes(value as TaskSubject)
}

export function isStudyFormat(value: unknown): value is StudyFormat {
  return typeof value === 'string' && STUDY_FORMATS.includes(value as StudyFormat)
}

export function isTaskStatus(value: unknown): value is TaskStatus {
  return typeof value === 'string' && TASK_STATUSES.includes(value as TaskStatus)
}

export function isTaskId(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value)
}

export function isTaskName(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

export function isValidLocalDate(value: unknown): value is LocalDate {
  if (typeof value !== 'string') {
    return false
  }

  const match = LOCAL_DATE_PATTERN.exec(value)
  if (!match) {
    return false
  }

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const daysInMonth = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

  return year >= 1 && month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth[month - 1]
}

export function isPositiveIntegerMinutes(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0
}

export function isIsoTimestamp(value: unknown): value is IsoTimestamp {
  if (typeof value !== 'string') {
    return false
  }

  const time = Date.parse(value)
  return !Number.isNaN(time) && new Date(time).toISOString() === value
}

export function isTask(value: unknown): value is Task {
  if (!isRecord(value)) {
    return false
  }

  return (
    value.dataFormatVersion === TASK_DATA_FORMAT_VERSION &&
    isTaskId(value.id) &&
    isTaskName(value.name) &&
    isNullable(value.subject, isTaskSubject) &&
    isNullable(value.studyFormat, isStudyFormat) &&
    isNullable(value.contentScope, isString) &&
    isNullable(value.nextStep, isString) &&
    isNullable(value.completionCriteria, isString) &&
    isNullable(value.plannedDate, isValidLocalDate) &&
    isNullable(value.todayPriorityDate, isValidLocalDate) &&
    isOptionalNullable(value.todayPriorityAddedAt, isIsoTimestamp) &&
    isTaskStatus(value.status) &&
    isNullable(value.notes, isString) &&
    isNullable(value.actualDurationMinutes, isPositiveIntegerMinutes) &&
    isNullable(value.actualCompletion, isString) &&
    isIsoTimestamp(value.createdAt) &&
    isIsoTimestamp(value.updatedAt)
  )
}

export function createTask(input: CreateTaskInput, dependencies: CreateTaskDependencies = {}): Task {
  const name = normalizeTaskName(input.name)
  const subject = input.subject ?? null
  const studyFormat = input.studyFormat ?? null
  const plannedDate = input.plannedDate ?? null
  const todayPriorityDate = input.todayPriorityDate ?? null
  const todayPriorityAddedAt = input.todayPriorityAddedAt ?? null
  const actualDurationMinutes = input.actualDurationMinutes ?? null

  assertNullableEnum(subject, isTaskSubject, 'subject', '科目必须是规定选项或为空。')
  assertNullableEnum(studyFormat, isStudyFormat, 'studyFormat', '学习形式必须是规定选项或为空。')
  assertNullableEnum(plannedDate, isValidLocalDate, 'plannedDate', '计划日期必须是有效的 YYYY-MM-DD 日期。')
  assertNullableEnum(
    todayPriorityDate,
    isValidLocalDate,
    'todayPriorityDate',
    '今日重点日期必须是有效的 YYYY-MM-DD 日期。',
  )
  assertNullableEnum(
    todayPriorityAddedAt,
    isIsoTimestamp,
    'todayPriorityAddedAt',
    '今日重点加入时间必须是有效的 ISO 时间戳或为空。',
  )
  assertNullableEnum(
    actualDurationMinutes,
    isPositiveIntegerMinutes,
    'actualDurationMinutes',
    '实际用时必须是正整数分钟或为空。',
  )

  const id = (dependencies.createId ?? createTaskId)()
  if (!isTaskId(id)) {
    throw new TaskValidationError('id', '任务 ID 生成失败。')
  }

  const timestamp = createTimestamp(dependencies.now ?? (() => new Date()))

  return {
    dataFormatVersion: TASK_DATA_FORMAT_VERSION,
    id,
    name,
    subject,
    studyFormat,
    contentScope: normalizeOptionalText(input.contentScope),
    nextStep: normalizeOptionalText(input.nextStep),
    completionCriteria: normalizeOptionalText(input.completionCriteria),
    plannedDate,
    todayPriorityDate,
    todayPriorityAddedAt: todayPriorityDate === null ? null : (todayPriorityAddedAt ?? timestamp),
    status: '待处理',
    notes: normalizeOptionalText(input.notes),
    actualDurationMinutes,
    actualCompletion: normalizeOptionalText(input.actualCompletion),
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}

function createTaskId(): string {
  return globalThis.crypto.randomUUID()
}

function createTimestamp(now: () => Date): IsoTimestamp {
  const date = now()
  if (Number.isNaN(date.getTime())) {
    throw new TaskValidationError('timestamp', '时间戳生成失败。')
  }

  return date.toISOString()
}

function normalizeTaskName(value: string): string {
  if (!isTaskName(value)) {
    throw new TaskValidationError('name', '任务名称不能为空。')
  }

  return value.trim()
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  return value === undefined || value === null || value.trim().length === 0 ? null : value
}

function assertNullableEnum<T>(
  value: T | null,
  guard: (candidate: unknown) => candidate is T,
  field: string,
  message: string,
): void {
  if (value !== null && !guard(value)) {
    throw new TaskValidationError(field, message)
  }
}

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isString(value: unknown): value is string {
  return typeof value === 'string'
}

function isNullable<T>(value: unknown, guard: (candidate: unknown) => candidate is T): value is T | null {
  return value === null || guard(value)
}

function isOptionalNullable<T>(
  value: unknown,
  guard: (candidate: unknown) => candidate is T,
): value is T | null | undefined {
  return value === undefined || isNullable(value, guard)
}
