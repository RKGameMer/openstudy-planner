import { useCallback, useEffect, useMemo, useRef, useReducer, type ReactNode } from 'react'
import { createTaskDataAccess, type TaskDataAccess } from '../data'
import type { Task } from '../models'
import {
  createTaskService,
  createDataManagementService,
  createReplanService,
  filterTasks,
  getCurrentLocalDate,
  getPastUnresolvedPriorityTasks,
  getReplanCandidates,
  getTodayPriorityTasks,
} from '../services'
import { TaskStoreContext, type TaskContextValue, type TaskOperationResult } from './taskStoreContext'

type TaskState = {
  tasks: Task[]
  isLoading: boolean
  loadError: string | null
}

type TaskAction =
  | { type: 'loaded'; tasks: Task[] }
  | { type: 'upserted'; task: Task }
  | { type: 'deleted'; id: string }
  | { type: 'readFailed'; message: string }

export interface TaskProviderProps {
  children: ReactNode
  dataAccess?: TaskDataAccess
  getToday?: () => string
}

const initialState: TaskState = { tasks: [], isLoading: true, loadError: null }

function taskReducer(state: TaskState, action: TaskAction): TaskState {
  switch (action.type) {
    case 'loaded':
      return { tasks: action.tasks, isLoading: false, loadError: null }
    case 'upserted': {
      const currentIndex = state.tasks.findIndex((task) => task.id === action.task.id)
      const tasks =
        currentIndex === -1
          ? [...state.tasks, action.task]
          : state.tasks.map((task) => (task.id === action.task.id ? action.task : task))
      return { tasks, isLoading: false, loadError: null }
    }
    case 'deleted':
      return { tasks: state.tasks.filter((task) => task.id !== action.id), isLoading: false, loadError: null }
    case 'readFailed':
      return { ...state, isLoading: false, loadError: action.message }
  }
}

export function TaskProvider({ children, dataAccess, getToday }: TaskProviderProps) {
  const [state, dispatch] = useReducer(taskReducer, initialState)
  const accessRef = useRef<TaskDataAccess | null>(null)
  if (accessRef.current === null) {
    accessRef.current = dataAccess ?? createTaskDataAccess()
  }

  const serviceRef = useRef<ReturnType<typeof createTaskService> | null>(null)
  if (serviceRef.current === null) {
    serviceRef.current = createTaskService({ dataAccess: accessRef.current, getToday })
  }

  const service = serviceRef.current

  const replanServiceRef = useRef<ReturnType<typeof createReplanService> | null>(null)
  if (replanServiceRef.current === null) {
    replanServiceRef.current = createReplanService({ dataAccess: accessRef.current, getToday })
  }
  const replanService = replanServiceRef.current

  const dataManagementServiceRef = useRef<ReturnType<typeof createDataManagementService> | null>(null)
  if (dataManagementServiceRef.current === null) {
    dataManagementServiceRef.current = createDataManagementService({ dataAccess: accessRef.current })
  }
  const dataManagementService = dataManagementServiceRef.current

  const operationFailure = useCallback((error: unknown): TaskOperationResult<never> => {
    const message = error instanceof Error ? error.message : '操作没有完成，现有数据保持不变。'
    return { ok: false, message }
  }, [])

  const reload = useCallback((): TaskOperationResult<Task[]> => {
    try {
      const tasks = service.getAllTasks()
      dispatch({ type: 'loaded', tasks })
      return { ok: true, value: tasks }
    } catch (error) {
      const message = error instanceof Error ? error.message : '无法读取当前浏览器中的任务数据，现有数据没有被覆盖。'
      dispatch({ type: 'readFailed', message })
      return { ok: false, message }
    }
  }, [service])

  const dataIsReady = !state.isLoading && state.loadError === null
  const requireReadyData = useCallback((): TaskOperationResult<never> | null => {
    if (dataIsReady) {
      return null
    }

    return {
      ok: false,
      message: '当前任务数据尚未成功读取。请重新加载后再操作，现有数据不会被覆盖。',
    }
  }, [dataIsReady])

  useEffect(() => {
    reload()
  }, [reload])

  const value = useMemo<TaskContextValue>(
    () => ({
      tasks: state.tasks,
      isLoading: state.isLoading,
      loadError: state.loadError,
      reload,
      createTask(input, addToToday) {
        const notReady = requireReadyData()
        if (notReady !== null) {
          return notReady
        }
        try {
          const task = service.create(input, { addToToday })
          dispatch({ type: 'upserted', task })
          return { ok: true, value: task }
        } catch (error) {
          return operationFailure(error)
        }
      },
      updateTask(id, input) {
        const notReady = requireReadyData()
        if (notReady !== null) {
          return notReady
        }
        try {
          const task = service.update(id, input)
          dispatch({ type: 'upserted', task })
          return { ok: true, value: task }
        } catch (error) {
          return operationFailure(error)
        }
      },
      transitionTask(id, status) {
        const notReady = requireReadyData()
        if (notReady !== null) {
          return notReady
        }
        try {
          const task = service.transitionStatus(id, status)
          dispatch({ type: 'upserted', task })
          return { ok: true, value: task }
        } catch (error) {
          return operationFailure(error)
        }
      },
      addToTodayPriority(id) {
        const notReady = requireReadyData()
        if (notReady !== null) {
          return notReady
        }
        try {
          const task = service.addToTodayPriority(id)
          dispatch({ type: 'upserted', task })
          return { ok: true, value: task }
        } catch (error) {
          return operationFailure(error)
        }
      },
      removeFromTodayPriority(id) {
        const notReady = requireReadyData()
        if (notReady !== null) {
          return notReady
        }
        try {
          const task = service.removeFromTodayPriority(id)
          dispatch({ type: 'upserted', task })
          return { ok: true, value: task }
        } catch (error) {
          return operationFailure(error)
        }
      },
      permanentlyDelete(id) {
        const notReady = requireReadyData()
        if (notReady !== null) {
          return notReady
        }
        try {
          const wasDeleted = service.permanentlyDelete(id)
          if (wasDeleted) {
            dispatch({ type: 'deleted', id })
          }
          return { ok: true, value: wasDeleted }
        } catch (error) {
          return operationFailure(error)
        }
      },
      getTasksByFilter(filter) {
        return filterTasks(state.tasks, filter)
      },
      getTodayPriority() {
        return getTodayPriorityTasks(state.tasks, getToday?.() ?? getCurrentLocalDate())
      },
      getPastUnresolvedPriorities() {
        return getPastUnresolvedPriorityTasks(state.tasks, getToday?.() ?? getCurrentLocalDate())
      },
      getReplanCandidates() {
        return getReplanCandidates(state.tasks, getToday?.() ?? getCurrentLocalDate())
      },
      previewReplan(draft) {
        const notReady = requireReadyData()
        if (notReady !== null) {
          return notReady
        }
        try {
          return { ok: true, value: replanService.preview(draft) }
        } catch (error) {
          return operationFailure(error)
        }
      },
      applyReplan(draft) {
        const notReady = requireReadyData()
        if (notReady !== null) {
          return notReady
        }
        try {
          const tasks = replanService.apply(draft)
          dispatch({ type: 'loaded', tasks })
          return { ok: true, value: tasks }
        } catch (error) {
          return operationFailure(error)
        }
      },
      exportBackup() {
        const notReady = requireReadyData()
        if (notReady !== null) {
          return notReady
        }
        try {
          return { ok: true, value: dataManagementService.exportBackup() }
        } catch (error) {
          return operationFailure(error)
        }
      },
      importBackup(backup) {
        const notReady = requireReadyData()
        if (notReady !== null) {
          return notReady
        }
        try {
          const tasks = dataManagementService.importBackup(backup)
          dispatch({ type: 'loaded', tasks })
          return { ok: true, value: tasks }
        } catch (error) {
          return operationFailure(error)
        }
      },
      clearAppData() {
        const notReady = requireReadyData()
        if (notReady !== null) {
          return notReady
        }
        try {
          dataManagementService.clearAppData()
          dispatch({ type: 'loaded', tasks: [] })
          return { ok: true, value: undefined }
        } catch (error) {
          return operationFailure(error)
        }
      },
    }),
    [
      dataManagementService,
      getToday,
      operationFailure,
      reload,
      replanService,
      requireReadyData,
      service,
      state.isLoading,
      state.loadError,
      state.tasks,
    ],
  )

  return <TaskStoreContext.Provider value={value}>{children}</TaskStoreContext.Provider>
}
