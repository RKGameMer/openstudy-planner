import { describe, expect, it, vi } from 'vitest'
import { createTask, type Task } from '../models'
import { APP_STORAGE_KEY, createTaskDataAccess, STORAGE_DATA_FORMAT_VERSION, StorageWriteError, type StorageLike } from '../data'
import { createDataManagementService } from './dataManagementService'
import { BACKUP_FORMAT_VERSION, BackupValidationError, parseTaskBackup, serializeTaskBackup } from './backup'

const FIRST_ID = '4f5a1e22-7e29-4eea-987c-d7c5a54d7375'
const SECOND_ID = '7649cd97-6995-4eaf-b55c-686f0fad9a7a'
const TIMESTAMP = '2026-08-03T10:20:30.000Z'

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

class FailingRemoveStorage extends InMemoryStorage {
  failRemoves = false

  removeItem(key: string): void {
    if (this.failRemoves) {
      throw new Error('simulated remove failure')
    }

    super.removeItem(key)
  }
}

function makeTask(id: string, name: string): Task {
  return createTask(
    { name, subject: '英语', studyFormat: '复习', todayPriorityDate: '2026-08-03', notes: '虚构备注' },
    { createId: () => id, now: () => new Date(TIMESTAMP) },
  )
}

function setup(storage: StorageLike = new InMemoryStorage(), tasks: Task[] = []) {
  const dataAccess = createTaskDataAccess({ storage })
  dataAccess.replaceAllData({ storageFormatVersion: STORAGE_DATA_FORMAT_VERSION, tasks })
  const service = createDataManagementService({ dataAccess, now: () => new Date(TIMESTAMP) })
  return { dataAccess, service, storage }
}

describe('backup and data-management rules', () => {
  it('exports a versioned complete structured snapshot without network activity', () => {
    const task = makeTask(FIRST_ID, '复习英语词组')
    const { service } = setup(undefined, [task])
    const fetchSpy = vi.fn()
    const xhrSpy = vi.fn()
    const webSocketSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    vi.stubGlobal('XMLHttpRequest', xhrSpy)
    vi.stubGlobal('WebSocket', webSocketSpy)

    try {
      const backup = service.exportBackup()
      expect(backup).toMatchObject({
        backupFormatVersion: BACKUP_FORMAT_VERSION,
        exportedAt: TIMESTAMP,
        storageFormatVersion: STORAGE_DATA_FORMAT_VERSION,
        tasks: [task],
      })
      expect(parseTaskBackup(serializeTaskBackup(backup))).toEqual(backup)
    } finally {
      vi.unstubAllGlobals()
    }

    expect(fetchSpy).not.toHaveBeenCalled()
    expect(xhrSpy).not.toHaveBeenCalled()
    expect(webSocketSpy).not.toHaveBeenCalled()
  })

  it('accepts a valid backup preview payload and replaces rather than merges on import', () => {
    const oldTask = makeTask(FIRST_ID, '旧任务')
    const replacementTask = makeTask(SECOND_ID, '恢复任务')
    const { dataAccess, service } = setup(undefined, [oldTask])
    const replacement = {
      backupFormatVersion: BACKUP_FORMAT_VERSION,
      exportedAt: TIMESTAMP,
      storageFormatVersion: STORAGE_DATA_FORMAT_VERSION,
      tasks: [replacementTask],
    }

    expect(parseTaskBackup(JSON.stringify(replacement))).toEqual(replacement)
    expect(service.importBackup(replacement)).toEqual([replacementTask])
    expect(dataAccess.getAllTasks()).toEqual([replacementTask])
  })

  it.each([
    ['损坏 JSON', '{not valid json'],
    ['错误结构', JSON.stringify({ backupFormatVersion: 1, exportedAt: TIMESTAMP, tasks: {} })],
    ['非法任务', JSON.stringify({ backupFormatVersion: 1, exportedAt: TIMESTAMP, storageFormatVersion: 1, tasks: [{ id: 'bad' }] })],
    ['不兼容版本', JSON.stringify({ backupFormatVersion: 2, exportedAt: TIMESTAMP, storageFormatVersion: 1, tasks: [] })],
  ])('rejects %s before any import write', (_case, serialized) => {
    expect(() => parseTaskBackup(serialized)).toThrow(BackupValidationError)
  })

  it('rejects duplicate task IDs in a backup before a preview or import can proceed', () => {
    const task = makeTask(FIRST_ID, '重复任务')
    const duplicatedBackup = {
      backupFormatVersion: BACKUP_FORMAT_VERSION,
      exportedAt: TIMESTAMP,
      storageFormatVersion: STORAGE_DATA_FORMAT_VERSION,
      tasks: [task, { ...task }],
    }

    expect(() => parseTaskBackup(JSON.stringify(duplicatedBackup))).toThrow('备份文件包含重复任务 ID')
  })

  it('preserves existing data if the complete import write fails', () => {
    const storage = new FailingWriteStorage()
    const oldTask = makeTask(FIRST_ID, '旧任务')
    const replacementTask = makeTask(SECOND_ID, '替换任务')
    const { dataAccess, service } = setup(storage, [oldTask])
    storage.failWrites = true

    expect(() => service.importBackup({
      backupFormatVersion: BACKUP_FORMAT_VERSION,
      exportedAt: TIMESTAMP,
      storageFormatVersion: STORAGE_DATA_FORMAT_VERSION,
      tasks: [replacementTask],
    })).toThrow(StorageWriteError)
    expect(dataAccess.getAllTasks()).toEqual([oldTask])
  })

  it('clears only the application storage key and remains empty after a new data-access instance reads it', () => {
    const storage = new InMemoryStorage()
    const task = makeTask(FIRST_ID, '待清除任务')
    const { service } = setup(storage, [task])
    storage.setItem('another-app', 'keep')

    service.clearAppData()

    expect(createTaskDataAccess({ storage }).getAllTasks()).toEqual([])
    expect(storage.getItem('another-app')).toBe('keep')
    expect(storage.removedKeys).toEqual([APP_STORAGE_KEY])
  })

  it('keeps existing data when clearing the application key fails', () => {
    const storage = new FailingRemoveStorage()
    const task = makeTask(FIRST_ID, '清除失败任务')
    const { dataAccess, service } = setup(storage, [task])
    storage.failRemoves = true

    expect(() => service.clearAppData()).toThrow(StorageWriteError)
    expect(dataAccess.getAllTasks()).toEqual([task])
  })
})
