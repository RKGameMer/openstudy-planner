import { describe, expect, it, vi } from 'vitest'
import { createTask, type CreateTaskDependencies, type Task } from '../models'
import {
  APP_STORAGE_KEY,
  createTaskDataAccess,
  DuplicateTaskIdError,
  InvalidTaskError,
  LocalStorageUnavailableError,
  STORAGE_DATA_FORMAT_VERSION,
  StorageDataCorruptedError,
  StorageQuotaExceededError,
  StorageReadError,
  StorageVersionIncompatibleError,
  StorageWriteError,
  TaskNotFoundError,
  type StorageLike,
} from './taskDataAccess'

const FIXED_TIMESTAMP = '2026-08-03T10:20:30.000Z'
const FIRST_TASK_ID = '4f5a1e22-7e29-4eea-987c-d7c5a54d7375'
const SECOND_TASK_ID = '7649cd97-6995-4eaf-b55c-686f0fad9a7a'
const THIRD_TASK_ID = '7638edc8-b878-4e9b-98f8-532c4bc3dc85'

class InMemoryStorage implements StorageLike {
  readonly values = new Map<string, string>()
  readonly removedKeys: string[] = []

  getItem(key: string): string | null {
    return this.values.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value)
  }

  removeItem(key: string): void {
    this.removedKeys.push(key)
    this.values.delete(key)
  }
}

class FailingWriteStorage extends InMemoryStorage {
  failWrites = false

  setItem(key: string, value: string): void {
    if (this.failWrites) {
      throw new Error('simulated write failure')
    }

    super.setItem(key, value)
  }
}

class QuotaExceededStorage extends InMemoryStorage {
  setItem(_key: string, _value: string): void {
    const error = new Error('simulated quota failure')
    error.name = 'QuotaExceededError'
    throw error
  }
}

function createTestTask(id: string, name: string): Task {
  const dependencies: CreateTaskDependencies = {
    createId: () => id,
    now: () => new Date(FIXED_TIMESTAMP),
  }

  return createTask({ name }, dependencies)
}

describe('TaskDataAccess initialization and reading', () => {
  it('returns valid empty data on the first read and can initialize an empty snapshot', () => {
    const storage = new InMemoryStorage()
    const dataAccess = createTaskDataAccess({ storage })

    expect(dataAccess.getAllTasks()).toEqual([])
    expect(dataAccess.getStorageFormatVersion()).toBe(STORAGE_DATA_FORMAT_VERSION)

    dataAccess.initializeEmptyData()

    expect(storage.getItem(APP_STORAGE_KEY)).toBe(
      JSON.stringify({ storageFormatVersion: STORAGE_DATA_FORMAT_VERSION, tasks: [] }),
    )
  })

  it('returns the correct task by ID and null for an absent ID', () => {
    const storage = new InMemoryStorage()
    const dataAccess = createTaskDataAccess({ storage })
    const firstTask = createTestTask(FIRST_TASK_ID, '完成数学函数练习')
    const secondTask = createTestTask(SECOND_TASK_ID, '背诵英语词组')

    dataAccess.addTask(firstTask)
    dataAccess.addTask(secondTask)

    expect(dataAccess.getTaskById(SECOND_TASK_ID)).toEqual(secondTask)
    expect(dataAccess.getTaskById(THIRD_TASK_ID)).toBeNull()
  })

  it('reads data saved by a separately created data-access instance', () => {
    const storage = new InMemoryStorage()
    const firstInstance = createTaskDataAccess({ storage })
    const task = createTestTask(FIRST_TASK_ID, '整理语文错题')

    firstInstance.addTask(task)

    const recreatedInstance = createTaskDataAccess({ storage })
    expect(recreatedInstance.getAllTasks()).toEqual([task])
  })
})

describe('TaskDataAccess task writes', () => {
  it('saves an added task so it can be read again', () => {
    const storage = new InMemoryStorage()
    const dataAccess = createTaskDataAccess({ storage })
    const task = createTestTask(FIRST_TASK_ID, '完成数学函数练习')

    expect(dataAccess.addTask(task)).toEqual(task)
    expect(dataAccess.getAllTasks()).toEqual([task])
  })

  it('saves the latest full task when it is updated', () => {
    const storage = new InMemoryStorage()
    const dataAccess = createTaskDataAccess({ storage })
    const task = createTestTask(FIRST_TASK_ID, '完成数学函数练习')
    const updatedTask = { ...task, name: '完成数学函数练习第 1—5 题' }

    dataAccess.addTask(task)
    expect(dataAccess.updateTask(updatedTask)).toEqual(updatedTask)
    expect(dataAccess.getAllTasks()).toEqual([updatedTask])
  })

  it('permanently deletes a task and reports false when no task has that ID', () => {
    const storage = new InMemoryStorage()
    const dataAccess = createTaskDataAccess({ storage })
    const task = createTestTask(FIRST_TASK_ID, '完成数学函数练习')

    dataAccess.addTask(task)

    expect(dataAccess.deleteTask(FIRST_TASK_ID)).toBe(true)
    expect(dataAccess.getAllTasks()).toEqual([])
    expect(dataAccess.deleteTask(FIRST_TASK_ID)).toBe(false)
  })

  it('rejects an update for a task that does not exist', () => {
    const storage = new InMemoryStorage()
    const dataAccess = createTaskDataAccess({ storage })

    expect(() => dataAccess.updateTask(createTestTask(FIRST_TASK_ID, '整理错题'))).toThrow(TaskNotFoundError)
  })

  it('rejects an invalid task instead of treating arbitrary data as Task data', () => {
    const storage = new InMemoryStorage()
    const dataAccess = createTaskDataAccess({ storage })
    const invalidTask = {
      dataFormatVersion: 1,
      id: 'not-a-uuid',
      name: '无效任务',
    }

    expect(() => dataAccess.addTask(invalidTask)).toThrow(InvalidTaskError)
    expect(dataAccess.getAllTasks()).toEqual([])
  })

  it('rejects duplicate task IDs', () => {
    const storage = new InMemoryStorage()
    const dataAccess = createTaskDataAccess({ storage })
    const task = createTestTask(FIRST_TASK_ID, '完成数学函数练习')
    const sameIdTask = { ...task, name: '整理数学错题' }

    dataAccess.addTask(task)

    expect(() => dataAccess.addTask(sameIdTask)).toThrow(DuplicateTaskIdError)
    expect(dataAccess.getAllTasks()).toEqual([task])
  })
})

describe('TaskDataAccess snapshot validation', () => {
  it('rejects corrupted JSON without replacing stored data', () => {
    const storage = new InMemoryStorage()
    storage.setItem(APP_STORAGE_KEY, '{this is not JSON')
    const dataAccess = createTaskDataAccess({ storage })

    expect(() => dataAccess.getAllTasks()).toThrow(StorageDataCorruptedError)
    expect(storage.getItem(APP_STORAGE_KEY)).toBe('{this is not JSON')
  })

  it('rejects an incorrect stored data structure', () => {
    const storage = new InMemoryStorage()
    storage.setItem(APP_STORAGE_KEY, JSON.stringify({ storageFormatVersion: 1, tasks: {} }))
    const dataAccess = createTaskDataAccess({ storage })

    expect(() => dataAccess.getAllTasks()).toThrow(StorageDataCorruptedError)
  })

  it('rejects a stored snapshot containing an invalid Task', () => {
    const storage = new InMemoryStorage()
    storage.setItem(
      APP_STORAGE_KEY,
      JSON.stringify({
        storageFormatVersion: STORAGE_DATA_FORMAT_VERSION,
        tasks: [{ id: 'not-a-uuid', name: '损坏任务' }],
      }),
    )
    const dataAccess = createTaskDataAccess({ storage })

    expect(() => dataAccess.getAllTasks()).toThrow(StorageDataCorruptedError)
  })

  it('rejects an incompatible storage version', () => {
    const storage = new InMemoryStorage()
    storage.setItem(APP_STORAGE_KEY, JSON.stringify({ storageFormatVersion: 2, tasks: [] }))
    const dataAccess = createTaskDataAccess({ storage })

    expect(() => dataAccess.getAllTasks()).toThrow(StorageVersionIncompatibleError)
  })
})

describe('TaskDataAccess write failure protection', () => {
  it('keeps the old snapshot when a normal write fails', () => {
    const storage = new FailingWriteStorage()
    const dataAccess = createTaskDataAccess({ storage })
    const firstTask = createTestTask(FIRST_TASK_ID, '完成数学函数练习')
    const secondTask = createTestTask(SECOND_TASK_ID, '背诵英语词组')

    dataAccess.addTask(firstTask)
    const oldSnapshot = storage.getItem(APP_STORAGE_KEY)
    storage.failWrites = true

    expect(() => dataAccess.addTask(secondTask)).toThrow(StorageWriteError)
    expect(storage.getItem(APP_STORAGE_KEY)).toBe(oldSnapshot)
    expect(dataAccess.getAllTasks()).toEqual([firstTask])
  })

  it('keeps the original data when a full replacement is invalid', () => {
    const storage = new InMemoryStorage()
    const dataAccess = createTaskDataAccess({ storage })
    const existingTask = createTestTask(FIRST_TASK_ID, '完成数学函数练习')

    dataAccess.addTask(existingTask)

    expect(() =>
      dataAccess.replaceAllData({
        storageFormatVersion: STORAGE_DATA_FORMAT_VERSION,
        tasks: [{ id: 'not-a-uuid', name: '无效导入任务' }],
      }),
    ).toThrow(InvalidTaskError)
    expect(dataAccess.getAllTasks()).toEqual([existingTask])
  })

  it('keeps the original data when a full replacement write fails', () => {
    const storage = new FailingWriteStorage()
    const dataAccess = createTaskDataAccess({ storage })
    const existingTask = createTestTask(FIRST_TASK_ID, '已有任务')
    const replacementTask = createTestTask(SECOND_TASK_ID, '替换任务')

    dataAccess.addTask(existingTask)
    const oldSnapshot = storage.getItem(APP_STORAGE_KEY)
    storage.failWrites = true

    expect(() =>
      dataAccess.replaceAllData({
        storageFormatVersion: STORAGE_DATA_FORMAT_VERSION,
        tasks: [replacementTask],
      }),
    ).toThrow(StorageWriteError)
    expect(storage.getItem(APP_STORAGE_KEY)).toBe(oldSnapshot)
    expect(dataAccess.getAllTasks()).toEqual([existingTask])
  })

  it('replaces exactly one complete snapshot without mixing old and new tasks', () => {
    const storage = new InMemoryStorage()
    const dataAccess = createTaskDataAccess({ storage })
    const oldFirstTask = createTestTask(FIRST_TASK_ID, '旧任务一')
    const oldSecondTask = createTestTask(SECOND_TASK_ID, '旧任务二')
    const newTask = createTestTask(THIRD_TASK_ID, '新任务')

    dataAccess.addTask(oldFirstTask)
    dataAccess.addTask(oldSecondTask)

    dataAccess.replaceAllData({
      storageFormatVersion: STORAGE_DATA_FORMAT_VERSION,
      tasks: [newTask],
    })

    expect(dataAccess.getAllTasks()).toEqual([newTask])
  })

  it('rejects duplicate IDs in a full replacement and keeps the original data', () => {
    const storage = new InMemoryStorage()
    const dataAccess = createTaskDataAccess({ storage })
    const existingTask = createTestTask(FIRST_TASK_ID, '已有任务')
    const replacementTask = createTestTask(SECOND_TASK_ID, '导入任务')

    dataAccess.addTask(existingTask)

    expect(() =>
      dataAccess.replaceAllData({
        storageFormatVersion: STORAGE_DATA_FORMAT_VERSION,
        tasks: [replacementTask, { ...replacementTask }],
      }),
    ).toThrow(DuplicateTaskIdError)
    expect(dataAccess.getAllTasks()).toEqual([existingTask])
  })

  it('maps a quota error to a clear storage error', () => {
    const dataAccess = createTaskDataAccess({ storage: new QuotaExceededStorage() })

    expect(() => dataAccess.addTask(createTestTask(FIRST_TASK_ID, '完成数学函数练习'))).toThrow(
      StorageQuotaExceededError,
    )
  })
})

describe('TaskDataAccess storage boundaries', () => {
  it('reports local storage being unavailable', () => {
    const dataAccess = createTaskDataAccess({ storage: null })

    expect(() => dataAccess.getAllTasks()).toThrow(LocalStorageUnavailableError)
  })

  it('distinguishes a storage read failure', () => {
    const storage: StorageLike = {
      getItem: () => {
        throw new Error('simulated read failure')
      },
      setItem: () => undefined,
      removeItem: () => undefined,
    }
    const dataAccess = createTaskDataAccess({ storage })

    expect(() => dataAccess.getAllTasks()).toThrow(StorageReadError)
  })

  it('clears only the application key and returns to empty data', () => {
    const storage = new InMemoryStorage()
    const dataAccess = createTaskDataAccess({ storage })
    const task = createTestTask(FIRST_TASK_ID, '完成数学函数练习')

    storage.setItem('another-application-key', 'keep this value')
    dataAccess.addTask(task)
    dataAccess.clearAppData()

    expect(dataAccess.getAllTasks()).toEqual([])
    expect(storage.getItem('another-application-key')).toBe('keep this value')
    expect(storage.removedKeys).toEqual([APP_STORAGE_KEY])
  })

  it('does not invoke browser network interfaces during normal data operations', () => {
    const fetchSpy = vi.fn()
    const xmlHttpRequestSpy = vi.fn()
    const webSocketSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    vi.stubGlobal('XMLHttpRequest', xmlHttpRequestSpy)
    vi.stubGlobal('WebSocket', webSocketSpy)

    try {
      const storage = new InMemoryStorage()
      const dataAccess = createTaskDataAccess({ storage })
      const task = createTestTask(FIRST_TASK_ID, '完成数学函数练习')

      dataAccess.initializeEmptyData()
      dataAccess.addTask(task)
      dataAccess.getAllTasks()
      dataAccess.updateTask({ ...task, name: '更新后的数学函数练习' })
      dataAccess.getTaskById(FIRST_TASK_ID)
      dataAccess.deleteTask(FIRST_TASK_ID)
      dataAccess.replaceAllData({ storageFormatVersion: STORAGE_DATA_FORMAT_VERSION, tasks: [task] })
      dataAccess.clearAppData()
    } finally {
      vi.unstubAllGlobals()
    }

    expect(fetchSpy).not.toHaveBeenCalled()
    expect(xmlHttpRequestSpy).not.toHaveBeenCalled()
    expect(webSocketSpy).not.toHaveBeenCalled()
  })
})
