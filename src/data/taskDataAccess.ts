import { isTask, type Task } from '../models'

/** The single localStorage key controlled by OpenStudy Planner. */
export const APP_STORAGE_KEY = 'openstudy-planner.app-data'

/** Increment this only when the persisted snapshot schema changes incompatibly. */
export const STORAGE_DATA_FORMAT_VERSION = 1 as const

export interface AppDataSnapshot {
  storageFormatVersion: typeof STORAGE_DATA_FORMAT_VERSION
  tasks: Task[]
}

/** A small, injectable subset of the browser Storage interface. */
export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export interface TaskDataAccessDependencies {
  /**
   * Provide a storage implementation for tests. Pass `null` to model an
   * environment where browser localStorage is unavailable.
   */
  storage?: StorageLike | null
}

export interface TaskDataAccess {
  initializeEmptyData(): void
  getAllTasks(): Task[]
  getTaskById(id: string): Task | null
  addTask(task: unknown): Task
  updateTask(task: unknown): Task
  deleteTask(id: string): boolean
  replaceAllData(data: unknown): void
  clearAppData(): void
  getStorageFormatVersion(): typeof STORAGE_DATA_FORMAT_VERSION
}

export type TaskDataAccessErrorCode =
  | 'storage_unavailable'
  | 'read_failed'
  | 'data_corrupted'
  | 'version_incompatible'
  | 'write_failed'
  | 'quota_exceeded'
  | 'invalid_task'
  | 'duplicate_task_id'
  | 'task_not_found'

export class TaskDataAccessError extends Error {
  readonly code: TaskDataAccessErrorCode

  constructor(code: TaskDataAccessErrorCode, message: string) {
    super(message)
    this.name = 'TaskDataAccessError'
    this.code = code
  }
}

export class LocalStorageUnavailableError extends TaskDataAccessError {
  constructor() {
    super('storage_unavailable', '当前浏览器无法使用本地存储，任务数据没有保存。')
    this.name = 'LocalStorageUnavailableError'
  }
}

export class StorageReadError extends TaskDataAccessError {
  constructor() {
    super('read_failed', '无法读取当前浏览器中的任务数据，现有数据没有被覆盖。')
    this.name = 'StorageReadError'
  }
}

export class StorageDataCorruptedError extends TaskDataAccessError {
  constructor(message = '本地任务数据已损坏或结构不正确，操作已停止，现有数据没有被覆盖。') {
    super('data_corrupted', message)
    this.name = 'StorageDataCorruptedError'
  }
}

export class StorageVersionIncompatibleError extends TaskDataAccessError {
  constructor() {
    super('version_incompatible', '本地任务数据版本与当前应用不兼容，现有数据没有被覆盖。')
    this.name = 'StorageVersionIncompatibleError'
  }
}

export class StorageWriteError extends TaskDataAccessError {
  constructor() {
    super('write_failed', '任务数据没有保存成功，原有数据保持不变。')
    this.name = 'StorageWriteError'
  }
}

export class StorageQuotaExceededError extends TaskDataAccessError {
  constructor() {
    super('quota_exceeded', '浏览器本地存储空间不足，任务数据没有保存，原有数据保持不变。')
    this.name = 'StorageQuotaExceededError'
  }
}

export class InvalidTaskError extends TaskDataAccessError {
  constructor(message = '任务不符合统一 Task 数据模型，操作已拒绝。') {
    super('invalid_task', message)
    this.name = 'InvalidTaskError'
  }
}

export class DuplicateTaskIdError extends TaskDataAccessError {
  constructor() {
    super('duplicate_task_id', '任务 ID 重复，操作已拒绝。')
    this.name = 'DuplicateTaskIdError'
  }
}

export class TaskNotFoundError extends TaskDataAccessError {
  constructor() {
    super('task_not_found', '要更新的任务不存在，操作没有保存。')
    this.name = 'TaskNotFoundError'
  }
}

/**
 * Creates the only browser-data access point for task snapshots. It performs
 * no network activity and writes every task change as one complete snapshot.
 */
export function createTaskDataAccess(dependencies: TaskDataAccessDependencies = {}): TaskDataAccess {
  return new LocalStorageTaskDataAccess(dependencies)
}

class LocalStorageTaskDataAccess implements TaskDataAccess {
  readonly dependencies: TaskDataAccessDependencies

  constructor(dependencies: TaskDataAccessDependencies) {
    this.dependencies = dependencies
  }

  initializeEmptyData(): void {
    if (this.readStoredSnapshot() !== null) {
      return
    }

    this.writeSnapshot(createEmptySnapshot())
  }

  getAllTasks(): Task[] {
    return this.readSnapshot().tasks.map(copyTask)
  }

  getTaskById(id: string): Task | null {
    const task = this.readSnapshot().tasks.find((candidate) => candidate.id === id)
    return task === undefined ? null : copyTask(task)
  }

  addTask(task: unknown): Task {
    const validTask = requireTask(task)
    const snapshot = this.readSnapshot()

    if (snapshot.tasks.some((candidate) => candidate.id === validTask.id)) {
      throw new DuplicateTaskIdError()
    }

    const nextSnapshot = createSnapshot([...snapshot.tasks, validTask])
    this.writeSnapshot(nextSnapshot)
    return copyTask(validTask)
  }

  updateTask(task: unknown): Task {
    const validTask = requireTask(task)
    const snapshot = this.readSnapshot()
    const taskIndex = snapshot.tasks.findIndex((candidate) => candidate.id === validTask.id)

    if (taskIndex === -1) {
      throw new TaskNotFoundError()
    }

    const nextTasks = snapshot.tasks.map((candidate) =>
      candidate.id === validTask.id ? copyTask(validTask) : copyTask(candidate),
    )
    const nextSnapshot = createSnapshot(nextTasks)
    this.writeSnapshot(nextSnapshot)
    return copyTask(validTask)
  }

  deleteTask(id: string): boolean {
    const snapshot = this.readSnapshot()
    const nextTasks = snapshot.tasks.filter((candidate) => candidate.id !== id)

    if (nextTasks.length === snapshot.tasks.length) {
      return false
    }

    this.writeSnapshot(createSnapshot(nextTasks))
    return true
  }

  replaceAllData(data: unknown): void {
    const nextSnapshot = validateSnapshot(data, 'replacement')
    this.writeSnapshot(nextSnapshot)
  }

  clearAppData(): void {
    const storage = this.getStorage()

    try {
      storage.removeItem(APP_STORAGE_KEY)
    } catch (error) {
      throw createWriteError(error)
    }
  }

  getStorageFormatVersion(): typeof STORAGE_DATA_FORMAT_VERSION {
    return STORAGE_DATA_FORMAT_VERSION
  }

  private readSnapshot(): AppDataSnapshot {
    return this.readStoredSnapshot() ?? createEmptySnapshot()
  }

  private readStoredSnapshot(): AppDataSnapshot | null {
    const storage = this.getStorage()
    let serialized: string | null

    try {
      serialized = storage.getItem(APP_STORAGE_KEY)
    } catch (error) {
      if (isStorageUnavailableError(error)) {
        throw new LocalStorageUnavailableError()
      }

      throw new StorageReadError()
    }

    if (serialized === null) {
      return null
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(serialized)
    } catch {
      throw new StorageDataCorruptedError('本地任务数据不是有效 JSON，操作已停止，现有数据没有被覆盖。')
    }

    return validateSnapshot(parsed, 'stored')
  }

  private writeSnapshot(snapshot: AppDataSnapshot): void {
    const validatedSnapshot = validateSnapshot(snapshot, 'generated')
    let serialized: string

    try {
      serialized = JSON.stringify(validatedSnapshot)
    } catch {
      throw new StorageWriteError()
    }

    const storage = this.getStorage()
    try {
      storage.setItem(APP_STORAGE_KEY, serialized)
    } catch (error) {
      throw createWriteError(error)
    }
  }

  private getStorage(): StorageLike {
    if (this.dependencies.storage === null) {
      throw new LocalStorageUnavailableError()
    }

    if (this.dependencies.storage !== undefined) {
      return this.dependencies.storage
    }

    try {
      const storage = globalThis.localStorage
      if (storage === undefined || storage === null) {
        throw new LocalStorageUnavailableError()
      }

      return storage
    } catch (error) {
      if (error instanceof LocalStorageUnavailableError) {
        throw error
      }

      throw new LocalStorageUnavailableError()
    }
  }
}

function createEmptySnapshot(): AppDataSnapshot {
  return {
    storageFormatVersion: STORAGE_DATA_FORMAT_VERSION,
    tasks: [],
  }
}

function createSnapshot(tasks: Task[]): AppDataSnapshot {
  return {
    storageFormatVersion: STORAGE_DATA_FORMAT_VERSION,
    tasks: tasks.map(copyTask),
  }
}

function validateSnapshot(
  value: unknown,
  source: 'stored' | 'replacement' | 'generated',
): AppDataSnapshot {
  if (!isRecord(value) || typeof value.storageFormatVersion !== 'number' || !Array.isArray(value.tasks)) {
    throw new StorageDataCorruptedError(snapshotStructureMessage(source))
  }

  if (value.storageFormatVersion !== STORAGE_DATA_FORMAT_VERSION) {
    throw new StorageVersionIncompatibleError()
  }

  const taskIds = new Set<string>()
  const tasks: Task[] = []

  for (const candidate of value.tasks) {
    if (!isTask(candidate)) {
      if (source === 'replacement') {
        throw new InvalidTaskError('完整替换包含不符合统一 Task 模型的任务，操作已拒绝。')
      }

      throw new StorageDataCorruptedError('本地任务数据包含无效任务，操作已停止，现有数据没有被覆盖。')
    }

    if (taskIds.has(candidate.id)) {
      throw new DuplicateTaskIdError()
    }

    taskIds.add(candidate.id)
    tasks.push(copyTask(candidate))
  }

  return {
    storageFormatVersion: STORAGE_DATA_FORMAT_VERSION,
    tasks,
  }
}

function requireTask(value: unknown): Task {
  if (!isTask(value)) {
    throw new InvalidTaskError()
  }

  return copyTask(value)
}

function copyTask(task: Task): Task {
  return { ...task }
}

function snapshotStructureMessage(source: 'stored' | 'replacement' | 'generated'): string {
  if (source === 'replacement') {
    return '完整替换数据结构不正确，操作已拒绝。'
  }

  if (source === 'generated') {
    return '准备保存的数据结构不正确，操作已停止。'
  }

  return '本地任务数据结构不正确，操作已停止，现有数据没有被覆盖。'
}

function createWriteError(error: unknown): TaskDataAccessError {
  if (isStorageUnavailableError(error)) {
    return new LocalStorageUnavailableError()
  }

  if (isQuotaExceededError(error)) {
    return new StorageQuotaExceededError()
  }

  return new StorageWriteError()
}

function isStorageUnavailableError(error: unknown): boolean {
  return getErrorName(error) === 'SecurityError'
}

function isQuotaExceededError(error: unknown): boolean {
  if (!isRecord(error)) {
    return false
  }

  const name = getErrorName(error)
  const code = error.code
  return name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED' || code === 22 || code === 1014
}

function getErrorName(error: unknown): string | null {
  if (!isRecord(error) || typeof error.name !== 'string') {
    return null
  }

  return error.name
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
