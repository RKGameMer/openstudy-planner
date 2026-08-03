import { type TaskDataAccess } from '../data'
import { createTaskBackup, validateTaskBackup, type TaskBackup } from './backup'
import type { Task } from '../models'

export interface DataManagementServiceDependencies {
  dataAccess: TaskDataAccess
  now?: () => Date
}

export function createDataManagementService(dependencies: DataManagementServiceDependencies) {
  const now = dependencies.now ?? (() => new Date())

  function exportBackup(): TaskBackup {
    const date = now()
    if (Number.isNaN(date.getTime())) {
      throw new Error('无法生成导出时间，备份没有生成。')
    }

    return createTaskBackup(dependencies.dataAccess.getAllTasks(), date.toISOString())
  }

  function importBackup(backup: TaskBackup): Task[] {
    const validBackup = validateTaskBackup(backup)
    dependencies.dataAccess.replaceAllData({
      storageFormatVersion: validBackup.storageFormatVersion,
      tasks: validBackup.tasks,
    })
    return dependencies.dataAccess.getAllTasks()
  }

  function clearAppData(): void {
    dependencies.dataAccess.clearAppData()
  }

  return { clearAppData, exportBackup, importBackup }
}
