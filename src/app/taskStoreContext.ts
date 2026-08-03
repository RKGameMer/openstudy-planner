import { createContext, useContext } from 'react'
import type { CreateTaskInput, Task, TaskStatus } from '../models'
import type { ReplanDraft, ReplanPreview, TaskBackup, TaskListFilter, UpdateTaskInput } from '../services'

export type TaskOperationResult<T> =
  | { ok: true; value: T }
  | { ok: false; message: string }

export interface TaskContextValue {
  tasks: Task[]
  loadError: string | null
  createTask(input: CreateTaskInput, addToToday: boolean): TaskOperationResult<Task>
  updateTask(id: string, input: UpdateTaskInput): TaskOperationResult<Task>
  transitionTask(id: string, status: TaskStatus): TaskOperationResult<Task>
  addToTodayPriority(id: string): TaskOperationResult<Task>
  removeFromTodayPriority(id: string): TaskOperationResult<Task>
  permanentlyDelete(id: string): TaskOperationResult<boolean>
  reload(): TaskOperationResult<Task[]>
  getTasksByFilter(filter: TaskListFilter): Task[]
  getTodayPriority(): Task[]
  getPastUnresolvedPriorities(): Task[]
  getReplanCandidates(): Task[]
  previewReplan(draft: ReplanDraft): TaskOperationResult<ReplanPreview>
  applyReplan(draft: ReplanDraft): TaskOperationResult<Task[]>
  exportBackup(): TaskOperationResult<TaskBackup>
  importBackup(backup: TaskBackup): TaskOperationResult<Task[]>
  clearAppData(): TaskOperationResult<void>
}

export const TaskStoreContext = createContext<TaskContextValue | null>(null)

export function useTaskStore(): TaskContextValue {
  const context = useContext(TaskStoreContext)
  if (context === null) {
    throw new Error('useTaskStore 必须在 TaskProvider 内使用。')
  }

  return context
}
