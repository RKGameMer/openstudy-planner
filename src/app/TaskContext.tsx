import { useCallback, useEffect, useMemo, useRef, useReducer, type ReactNode } from 'react'
import { createTaskDataAccess, type TaskDataAccess } from '../data'
import type { Task } from '../models'
import {
  createTaskService,
  filterTasks,
  getCurrentLocalDate,
  getPastUnresolvedPriorityTasks,
  getTodayPriorityTasks,
} from '../services'
import { TaskStoreContext, type TaskContextValue, type TaskOperationResult } from './taskStoreContext'

type TaskState = {
  tasks: Task[]
  loadError: string | null
}

type TaskAction =
  | { type: 'loaded'; tasks: Task[] }
  | { type: 'upserted'; task: Task }
  | { type: 'deleted'; id: string }
  | { type: 'failed'; message: string }

export interface TaskProviderProps {
  children: ReactNode
  dataAccess?: TaskDataAccess
  getToday?: () => string
}

const initialState: TaskState = { tasks: [], loadError: null }

function taskReducer(state: TaskState, action: TaskAction): TaskState {
  switch (action.type) {
    case 'loaded':
      return { tasks: action.tasks, loadError: null }
    case 'upserted': {
      const currentIndex = state.tasks.findIndex((task) => task.id === action.task.id)
      const tasks =
        currentIndex === -1
          ? [...state.tasks, action.task]
          : state.tasks.map((task) => (task.id === action.task.id ? action.task : task))
      return { tasks, loadError: null }
    }
    case 'deleted':
      return { tasks: state.tasks.filter((task) => task.id !== action.id), loadError: null }
    case 'failed':
      return { ...state, loadError: action.message }
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

  const fail = useCallback((error: unknown): TaskOperationResult<never> => {
    const message = error instanceof Error ? error.message : '操作没有完成，现有数据保持不变。'
    dispatch({ type: 'failed', message })
    return { ok: false, message }
  }, [])

  const reload = useCallback((): TaskOperationResult<Task[]> => {
    try {
      const tasks = service.getAllTasks()
      dispatch({ type: 'loaded', tasks })
      return { ok: true, value: tasks }
    } catch (error) {
      return fail(error)
    }
  }, [fail, service])

  useEffect(() => {
    reload()
  }, [reload])

  const value = useMemo<TaskContextValue>(
    () => ({
      tasks: state.tasks,
      loadError: state.loadError,
      reload,
      createTask(input, addToToday) {
        try {
          const task = service.create(input, { addToToday })
          dispatch({ type: 'upserted', task })
          return { ok: true, value: task }
        } catch (error) {
          return fail(error)
        }
      },
      updateTask(id, input) {
        try {
          const task = service.update(id, input)
          dispatch({ type: 'upserted', task })
          return { ok: true, value: task }
        } catch (error) {
          return fail(error)
        }
      },
      transitionTask(id, status) {
        try {
          const task = service.transitionStatus(id, status)
          dispatch({ type: 'upserted', task })
          return { ok: true, value: task }
        } catch (error) {
          return fail(error)
        }
      },
      addToTodayPriority(id) {
        try {
          const task = service.addToTodayPriority(id)
          dispatch({ type: 'upserted', task })
          return { ok: true, value: task }
        } catch (error) {
          return fail(error)
        }
      },
      removeFromTodayPriority(id) {
        try {
          const task = service.removeFromTodayPriority(id)
          dispatch({ type: 'upserted', task })
          return { ok: true, value: task }
        } catch (error) {
          return fail(error)
        }
      },
      permanentlyDelete(id) {
        try {
          const wasDeleted = service.permanentlyDelete(id)
          if (wasDeleted) {
            dispatch({ type: 'deleted', id })
          }
          return { ok: true, value: wasDeleted }
        } catch (error) {
          return fail(error)
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
    }),
    [fail, getToday, reload, service, state.loadError, state.tasks],
  )

  return <TaskStoreContext.Provider value={value}>{children}</TaskStoreContext.Provider>
}
