import { describe, expect, it, vi } from 'vitest'
import { createTaskDataAccess, type StorageLike } from '../data'
import { TaskBusinessRuleError, createTaskService } from './taskService'

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

function createService(storage = new InMemoryStorage(), today = '2026-08-03') {
  let nextId = 0
  let clock = new Date('2026-08-03T10:00:00.000Z')
  const service = createTaskService({
    dataAccess: createTaskDataAccess({ storage }),
    createId: () => ids[nextId++],
    getToday: () => today,
    now: () => clock,
  })

  return {
    service,
    storage,
    setClock(timestamp: string) {
      clock = new Date(timestamp)
    },
  }
}

describe('task business service', () => {
  it('creates a task with only a name and persists it through a recreated data access instance', () => {
    const { service, storage } = createService()
    const task = service.create({ name: '  完成数学函数练习  ' })

    expect(task.name).toBe('完成数学函数练习')
    expect(task.status).toBe('待处理')
    expect(createTaskDataAccess({ storage }).getAllTasks()).toEqual([task])
  })

  it('rejects a blank name without writing a task', () => {
    const { service } = createService()

    expect(() => service.create({ name: ' \n\t ' })).toThrow('任务名称不能为空。')
    expect(service.getAllTasks()).toEqual([])
  })

  it('updates editable fields while retaining ID and created time after refresh', () => {
    const { service, storage, setClock } = createService()
    const original = service.create({ name: '英语词组' })
    setClock('2026-08-03T11:00:00.000Z')

    const updated = service.update(original.id, {
      name: '复习英语词组第 1—20 组',
      subject: '英语',
      studyFormat: '复习',
      notes: '先复习易错词。',
      actualDurationMinutes: 30,
    })

    expect(updated).toMatchObject({
      id: original.id,
      createdAt: original.createdAt,
      updatedAt: '2026-08-03T11:00:00.000Z',
      subject: '英语',
      studyFormat: '复习',
      actualDurationMinutes: 30,
    })
    expect(createTaskDataAccess({ storage }).getTaskById(original.id)).toEqual(updated)
  })

  it('returns correct status filters and excludes removed work from active tasks', () => {
    const { service } = createService()
    const pending = service.create({ name: '待处理任务' })
    const active = service.create({ name: '进行中任务' })
    const removed = service.create({ name: '已移除任务' })
    service.transitionStatus(active.id, '进行中')
    service.transitionStatus(removed.id, '已移除')

    expect(service.getTasksByFilter('活跃').map((task) => task.id)).toEqual([pending.id, active.id])
    expect(service.getTasksByFilter('进行中').map((task) => task.id)).toEqual([active.id])
    expect(service.getTasksByFilter('已移除').map((task) => task.id)).toEqual([removed.id])
  })

  it('adds and removes today priorities without a hard quantity limit', () => {
    const { service, setClock } = createService()
    const tasks = ['任务一', '任务二', '任务三', '任务四'].map((name) => service.create({ name }))

    tasks.forEach((task, index) => {
      setClock(`2026-08-03T10:0${index}:00.000Z`)
      service.addToTodayPriority(task.id)
    })

    expect(service.getTodayPriority().map((task) => task.name)).toEqual(['任务一', '任务二', '任务三', '任务四'])
    expect(service.removeFromTodayPriority(tasks[1].id).todayPriorityDate).toBeNull()
    expect(service.getTodayPriority().map((task) => task.name)).toEqual(['任务一', '任务三', '任务四'])
  })

  it('enforces legal status transitions and clears priorities for completed or removed tasks', () => {
    const { service } = createService()
    const task = service.create({ name: '状态任务' }, { addToToday: true })

    expect(() => service.transitionStatus(task.id, '部分完成')).toThrow(TaskBusinessRuleError)
    const started = service.transitionStatus(task.id, '进行中')
    const partial = service.transitionStatus(started.id, '部分完成')
    const completed = service.transitionStatus(partial.id, '已完成')

    expect(completed.todayPriorityDate).toBeNull()
    expect(() => service.addToTodayPriority(completed.id)).toThrow('只有待处理、进行中或部分完成任务可以加入今日重点。')
    expect(service.transitionStatus(completed.id, '待处理').status).toBe('待处理')
  })

  it('keeps removed tasks locally, restores them as pending, and permanently deletes only on an explicit call', () => {
    const { service } = createService()
    const task = service.create({ name: '可恢复任务' }, { addToToday: true })

    const removed = service.transitionStatus(task.id, '已移除')
    expect(removed.todayPriorityDate).toBeNull()
    expect(service.getTasksByFilter('已移除')).toHaveLength(1)
    expect(service.transitionStatus(task.id, '待处理').status).toBe('待处理')
    expect(service.permanentlyDelete(task.id)).toBe(true)
    expect(service.getAllTasks()).toEqual([])
  })

  it('identifies only active priorities from before today and does not alter them', () => {
    const { service } = createService()
    const pastPending = service.create({ name: '过往待处理', todayPriorityDate: '2026-08-02' })
    const pastCompleted = service.create({ name: '过往已完成', todayPriorityDate: '2026-08-01' })
    service.transitionStatus(pastCompleted.id, '已完成')

    expect(service.getPastUnresolvedPriorities().map((task) => task.id)).toEqual([pastPending.id])
    expect(service.getTask(pastPending.id)).toMatchObject({ status: '待处理', todayPriorityDate: '2026-08-02' })
  })

  it('does not call browser network interfaces during normal task business operations', () => {
    const fetchSpy = vi.fn()
    const xhrSpy = vi.fn()
    const webSocketSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    vi.stubGlobal('XMLHttpRequest', xhrSpy)
    vi.stubGlobal('WebSocket', webSocketSpy)

    try {
      const { service } = createService()
      const task = service.create({ name: '本地任务' }, { addToToday: true })
      service.update(task.id, { notes: '只保存在本地。' })
      service.transitionStatus(task.id, '进行中')
      service.removeFromTodayPriority(task.id)
      service.permanentlyDelete(task.id)
    } finally {
      vi.unstubAllGlobals()
    }

    expect(fetchSpy).not.toHaveBeenCalled()
    expect(xhrSpy).not.toHaveBeenCalled()
    expect(webSocketSpy).not.toHaveBeenCalled()
  })
})
