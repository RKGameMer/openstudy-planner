import { describe, expect, it } from 'vitest'
import { createTask, type Task } from '../models'
import { createTaskDataAccess, StorageWriteError, type StorageLike } from '../data'
import { createReplanService, ReplanValidationError } from './replanService'

const TODAY = '2026-08-03'
const TIMESTAMP = '2026-08-03T10:00:00.000Z'
const ids = [
  '4f5a1e22-7e29-4eea-987c-d7c5a54d7375',
  '7649cd97-6995-4eaf-b55c-686f0fad9a7a',
  '7638edc8-b878-4e9b-98f8-532c4bc3dc85',
  '2a7cef8d-37ae-4ce5-a4ee-3f0b2e452954',
  '0d58907c-13f2-49f0-8108-4ad62c0d9e0c',
]

class InMemoryStorage implements StorageLike {
  readonly values = new Map<string, string>()

  getItem(key: string): string | null {
    return this.values.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value)
  }

  removeItem(key: string): void {
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

class CountingStorage extends InMemoryStorage {
  writeCount = 0

  setItem(key: string, value: string): void {
    this.writeCount += 1
    super.setItem(key, value)
  }
}

function makeTask(index: number, name: string, options: Partial<Task> = {}): Task {
  const task = createTask(
    {
      name,
      subject: '数学',
      studyFormat: '刷题',
      contentScope: '函数练习',
      completionCriteria: '完成 5 题',
      notes: '保留备注',
      todayPriorityDate: '2026-08-02',
    },
    { createId: () => ids[index], now: () => new Date(TIMESTAMP) },
  )
  return { ...task, ...options }
}

function setup(tasks: Task[], storage: StorageLike = new InMemoryStorage()) {
  const dataAccess = createTaskDataAccess({ storage })
  dataAccess.replaceAllData({ storageFormatVersion: 1, tasks })
  let nextId = 3
  const service = createReplanService({
    dataAccess,
    getToday: () => TODAY,
    now: () => new Date('2026-08-03T12:00:00.000Z'),
    createId: () => ids[nextId++],
  })
  return { dataAccess, service }
}

describe('replan business rules', () => {
  it('continues an unfinished task as today priority without changing its content or state', () => {
    const task = makeTask(0, '继续函数练习', { status: '部分完成' })
    const { dataAccess, service } = setup([task])

    expect(service.preview({ decisions: { [task.id]: { action: 'continue' } } }).items[0].description).toContain('今天的重点')
    service.apply({ decisions: { [task.id]: { action: 'continue' } } })

    expect(dataAccess.getTaskById(task.id)).toMatchObject({
      name: '继续函数练习',
      status: '部分完成',
      todayPriorityDate: TODAY,
      contentScope: '函数练习',
    })
  })

  it('reduces one existing task while retaining ID, category, notes, and selected state behavior', () => {
    const task = makeTask(0, '函数练习', { status: '进行中' })
    const { dataAccess, service } = setup([task])
    service.apply({
      decisions: {
        [task.id]: {
          action: 'reduce',
          name: '函数练习第 1—3 题',
          contentScope: '第 1—3 题',
          completionCriteria: '订正错题',
          resetInProgress: true,
        },
      },
    })

    expect(dataAccess.getTaskById(task.id)).toMatchObject({
      id: task.id,
      status: '待处理',
      subject: '数学',
      studyFormat: '刷题',
      notes: '保留备注',
      todayPriorityDate: TODAY,
      name: '函数练习第 1—3 题',
    })
  })

  it('rejects a reduce decision that does not change an allowed field', () => {
    const task = makeTask(0, '函数练习')
    const { dataAccess, service } = setup([task])
    const before = dataAccess.getAllTasks()

    expect(() => service.apply({ decisions: { [task.id]: { action: 'reduce', name: task.name, contentScope: task.contentScope, completionCriteria: task.completionCriteria } } })).toThrow(
      '请至少修改任务名称、内容范围或完成标准中的一项。',
    )
    expect(dataAccess.getAllTasks()).toEqual(before)
  })

  it('splits a task atomically, removes the original only after creating independent tasks, and does not auto-prioritize all children', () => {
    const task = makeTask(0, '综合函数练习')
    const { dataAccess, service } = setup([task])
    service.apply({
      decisions: {
        [task.id]: {
          action: 'split',
          tasks: [
            { name: '函数练习第 1—3 题', inheritCategory: true, addToToday: true },
            { name: '函数练习第 4—5 题', inheritCategory: false, addToToday: false },
          ],
        },
      },
    })

    const tasks = dataAccess.getAllTasks()
    expect(tasks).toHaveLength(3)
    expect(dataAccess.getTaskById(task.id)).toMatchObject({ status: '已移除', todayPriorityDate: null })
    expect(tasks.filter((candidate) => candidate.id !== task.id)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: '函数练习第 1—3 题', status: '待处理', subject: '数学', todayPriorityDate: TODAY }),
        expect.objectContaining({ name: '函数练习第 4—5 题', status: '待处理', subject: null, todayPriorityDate: null }),
      ]),
    )
  })

  it('rejects splitting into fewer than two valid task names before any write', () => {
    const task = makeTask(0, '不能拆分')
    const { dataAccess, service } = setup([task])
    const before = dataAccess.getAllTasks()

    expect(() => service.apply({ decisions: { [task.id]: { action: 'split', tasks: [{ name: '只有一个', inheritCategory: true, addToToday: false }] } } })).toThrow(
      '请至少填写两个新任务。',
    )
    expect(dataAccess.getAllTasks()).toEqual(before)
  })

  it('postpones only to a future local date, removes today priority, and does not create a status', () => {
    const task = makeTask(0, '延期任务', { status: '进行中' })
    const { dataAccess, service } = setup([task])
    service.apply({ decisions: { [task.id]: { action: 'postpone', plannedDate: '2026-08-05' } } })

    expect(dataAccess.getTaskById(task.id)).toMatchObject({
      plannedDate: '2026-08-05',
      todayPriorityDate: null,
      status: '待处理',
    })
    expect(() => service.apply({ decisions: { [task.id]: { action: 'postpone', plannedDate: TODAY } } })).toThrow('请选择晚于今天的日期。')
  })

  it('returns a task to the library without deleting it', () => {
    const task = makeTask(0, '移回任务库', { status: '进行中', plannedDate: '2026-08-04' })
    const { dataAccess, service } = setup([task])
    service.apply({
      decisions: {
        [task.id]: { action: 'return-to-library' },
      },
    })

    expect(dataAccess.getTaskById(task.id)).toMatchObject({ status: '待处理', plannedDate: null, todayPriorityDate: null })
  })

  it('marks a task as removed without permanently deleting it', () => {
    const task = makeTask(0, '移除任务')
    const { dataAccess, service } = setup([task])
    service.apply({ decisions: { [task.id]: { action: 'remove' } } })

    expect(dataAccess.getTaskById(task.id)).toMatchObject({ status: '已移除', todayPriorityDate: null })
  })

  it('keeps skipped tasks unchanged, rejects an empty draft, and cancellation needs no write', () => {
    const selected = makeTask(0, '处理任务')
    const skipped = makeTask(1, '跳过任务', { plannedDate: '2026-08-04' })
    const { dataAccess, service } = setup([selected, skipped])
    const before = dataAccess.getAllTasks()

    expect(() => service.preview({ decisions: {} })).toThrow(ReplanValidationError)
    expect(dataAccess.getAllTasks()).toEqual(before)
    service.apply({ decisions: { [selected.id]: { action: 'remove' } } })
    expect(dataAccess.getTaskById(skipped.id)).toEqual(skipped)
  })

  it('preserves the original snapshot when the single final replan write fails', () => {
    const storage = new FailingWriteStorage()
    const first = makeTask(0, '原任务一')
    const second = makeTask(1, '原任务二')
    const { dataAccess, service } = setup([first, second], storage)
    const before = dataAccess.getAllTasks()
    storage.failWrites = true

    expect(() => service.apply({ decisions: { [first.id]: { action: 'remove' }, [second.id]: { action: 'return-to-library' } } })).toThrow(StorageWriteError)
    expect(dataAccess.getAllTasks()).toEqual(before)
  })

  it('does not write a preview and saves every selected change with one complete snapshot write', () => {
    const storage = new CountingStorage()
    const first = makeTask(0, '任务一')
    const second = makeTask(1, '任务二')
    const { dataAccess, service } = setup([first, second], storage)
    const decisions = {
      [first.id]: { action: 'remove' as const },
      [second.id]: { action: 'return-to-library' as const },
    }

    service.preview({ decisions })
    expect(storage.writeCount).toBe(1)
    service.apply({ decisions })

    expect(storage.writeCount).toBe(2)
    expect(dataAccess.getTaskById(first.id)).toMatchObject({ status: '已移除' })
    expect(dataAccess.getTaskById(second.id)).toMatchObject({ todayPriorityDate: null, plannedDate: null })
  })

  it('rejects duplicate generated split task IDs before writing any replan result', () => {
    const task = makeTask(0, '需要拆分的任务')
    const storage = new InMemoryStorage()
    const dataAccess = createTaskDataAccess({ storage })
    dataAccess.replaceAllData({ storageFormatVersion: 1, tasks: [task] })
    const service = createReplanService({
      dataAccess,
      getToday: () => TODAY,
      now: () => new Date('2026-08-03T12:00:00.000Z'),
      createId: () => task.id,
    })
    const before = dataAccess.getAllTasks()
    const draft = {
      decisions: {
        [task.id]: {
          action: 'split' as const,
          tasks: [
            { name: '拆分一', inheritCategory: true, addToToday: false },
            { name: '拆分二', inheritCategory: true, addToToday: false },
          ],
        },
      },
    }

    expect(() => service.preview(draft)).toThrow('重新安排结果包含重复任务 ID')
    expect(dataAccess.getAllTasks()).toEqual(before)
  })
})
