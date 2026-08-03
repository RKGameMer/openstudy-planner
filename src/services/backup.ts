import {
  isIsoTimestamp,
  isTask,
  type Task,
} from '../models'
import { STORAGE_DATA_FORMAT_VERSION } from '../data'

export const BACKUP_FORMAT_VERSION = 1 as const

export interface TaskBackup {
  backupFormatVersion: typeof BACKUP_FORMAT_VERSION
  exportedAt: string
  storageFormatVersion: typeof STORAGE_DATA_FORMAT_VERSION
  tasks: Task[]
}

export class BackupValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BackupValidationError'
  }
}

export function createTaskBackup(tasks: readonly Task[], exportedAt: string): TaskBackup {
  if (!isIsoTimestamp(exportedAt)) {
    throw new BackupValidationError('导出时间无效，备份没有生成。')
  }

  return validateTaskBackup({
    backupFormatVersion: BACKUP_FORMAT_VERSION,
    exportedAt,
    storageFormatVersion: STORAGE_DATA_FORMAT_VERSION,
    tasks,
  })
}

export function serializeTaskBackup(backup: TaskBackup): string {
  return JSON.stringify(validateTaskBackup(backup), null, 2)
}

export function parseTaskBackup(serialized: string): TaskBackup {
  let parsed: unknown
  try {
    parsed = JSON.parse(serialized)
  } catch {
    throw new BackupValidationError('备份文件不是有效 JSON，当前数据没有变化。')
  }

  return validateTaskBackup(parsed)
}

export function validateTaskBackup(value: unknown): TaskBackup {
  if (!isRecord(value)) {
    throw new BackupValidationError('备份文件结构不正确，当前数据没有变化。')
  }

  if (value.backupFormatVersion !== BACKUP_FORMAT_VERSION) {
    throw new BackupValidationError('备份文件版本与当前应用不兼容，当前数据没有变化。')
  }

  if (value.storageFormatVersion !== STORAGE_DATA_FORMAT_VERSION) {
    throw new BackupValidationError('备份中的本地数据版本与当前应用不兼容，当前数据没有变化。')
  }

  if (!isIsoTimestamp(value.exportedAt) || !Array.isArray(value.tasks)) {
    throw new BackupValidationError('备份文件缺少有效的导出时间或任务列表，当前数据没有变化。')
  }

  const ids = new Set<string>()
  const tasks: Task[] = []
  for (const candidate of value.tasks) {
    if (!isTask(candidate)) {
      throw new BackupValidationError('备份文件包含无效任务，当前数据没有变化。')
    }

    if (ids.has(candidate.id)) {
      throw new BackupValidationError('备份文件包含重复任务 ID，当前数据没有变化。')
    }

    ids.add(candidate.id)
    tasks.push({ ...candidate })
  }

  return {
    backupFormatVersion: BACKUP_FORMAT_VERSION,
    exportedAt: value.exportedAt,
    storageFormatVersion: STORAGE_DATA_FORMAT_VERSION,
    tasks,
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
