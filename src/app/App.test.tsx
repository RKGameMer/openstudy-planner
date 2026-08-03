// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { createTaskDataAccess, type StorageLike } from '../data'
import { createTask } from '../models'
import { App } from './App'
import { APP_NAME, APP_VERSION } from './app-info'

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
  setItem(_key: string, _value: string): void {
    throw new Error('simulated write failure')
  }
}

class FailingReadStorage extends InMemoryStorage {
  getItem(_key: string): string | null {
    throw new Error('simulated read failure')
  }
}

const FIXED_ID = '4f5a1e22-7e29-4eea-987c-d7c5a54d7375'
const FIXED_TIMESTAMP = '2026-08-03T10:20:30.000Z'

function createStoredTask(name: string, options: { priorityDate?: string | null } = {}) {
  return createTask(
    { name, todayPriorityDate: options.priorityDate ?? null },
    { createId: () => FIXED_ID, now: () => new Date(FIXED_TIMESTAMP) },
  )
}

function setViewport(width: number): void {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width })
  window.dispatchEvent(new Event('resize'))
}

function BrokenChild(): never {
  throw new Error('simulated render failure')
}

describe('application navigation shell', () => {
  beforeEach(() => {
    window.location.hash = '#/'
  })

  afterEach(() => {
    cleanup()
  })

  it('defaults to Today and exposes exactly the three confirmed primary entries', () => {
    render(<App />)

    expect(screen.getByRole('heading', { name: '今日' })).toBeDefined()

    const navigation = screen.getByRole('navigation', { name: '主导航' })
    expect(within(navigation).getAllByRole('link').map((link) => link.textContent)).toEqual([
      '今日',
      '任务库',
      '数据与说明',
    ])
    expect(within(navigation).getByRole('link', { name: '今日' }).getAttribute('aria-current')).toBe('page')
  })

  it('navigates to the task library and data information pages with an active item', () => {
    render(<App />)

    fireEvent.click(screen.getByRole('link', { name: '任务库' }))
    expect(screen.getByRole('heading', { name: '任务库' })).toBeDefined()
    expect(screen.getByRole('link', { name: '任务库' }).getAttribute('aria-current')).toBe('page')

    fireEvent.click(screen.getByRole('link', { name: '数据与说明' }))
    expect(screen.getByRole('heading', { name: '数据与说明' })).toBeDefined()
    expect(screen.getByRole('link', { name: '数据与说明' }).getAttribute('aria-current')).toBe('page')
  })

  it('redirects an invalid hash route to Today', async () => {
    window.location.hash = '#/not-a-page'

    render(<App />)

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '今日' })).toBeDefined()
    })
    expect(window.location.hash).toBe('#/')
  })

  it('parses the current hash route after a remount', () => {
    window.location.hash = '#/tasks'
    const firstMount = render(<App />)

    expect(screen.getByRole('heading', { name: '任务库' })).toBeDefined()

    firstMount.unmount()
    render(<App />)

    expect(screen.getByRole('heading', { name: '任务库' })).toBeDefined()
  })

  it('keeps the application identity information available', () => {
    expect(App).toBeTypeOf('function')
    expect(APP_NAME).toBe('OpenStudy Planner')
    expect(APP_VERSION).toBe('0.1.0')
  })

  it('announces an unrecoverable rendering error with readable text', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    try {
      render(
        <ErrorBoundary>
          <BrokenChild />
        </ErrorBoundary>,
      )

      expect(screen.getByRole('alert').textContent).toContain('请刷新页面后重试')
    } finally {
      consoleError.mockRestore()
    }
  })

  it('moves focus into confirmation dialogs and restores it after cancellation or Escape', async () => {
    window.location.hash = '#/tasks'
    const storage = new InMemoryStorage()
    const dataAccess = createTaskDataAccess({ storage })
    const task = createStoredTask('需要确认的任务')
    dataAccess.addTask(task)

    render(<App dataAccess={dataAccess} getToday={() => '2026-08-03'} />)

    fireEvent.click(await screen.findByText('更多操作'))
    const deleteButton = screen.getByRole('button', { name: '永久删除' })
    deleteButton.focus()
    fireEvent.click(deleteButton)
    const dialog = screen.getByRole('dialog', { name: '永久删除这个任务？' })

    const cancelButton = within(dialog).getByRole('button', { name: '取消' })
    const confirmButton = within(dialog).getByRole('button', { name: '永久删除' })
    await waitFor(() => {
      expect(document.activeElement).toBe(cancelButton)
    })
    confirmButton.focus()
    fireEvent.keyDown(confirmButton, { key: 'Tab' })
    expect(document.activeElement).toBe(cancelButton)
    fireEvent.keyDown(cancelButton, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(confirmButton)
    cancelButton.focus()
    fireEvent.click(cancelButton)

    expect(dataAccess.getTaskById(task.id)).not.toBeNull()
    expect(screen.queryByRole('dialog')).toBeNull()
    await waitFor(() => {
      expect(document.activeElement).toBe(deleteButton)
    })

    fireEvent.click(deleteButton)
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })

    expect(screen.queryByRole('dialog')).toBeNull()
    await waitFor(() => {
      expect(document.activeElement).toBe(deleteButton)
    })
  })

  it('provides visible labels, named controls, and readable error and task-status text', async () => {
    window.location.hash = '#/'
    const storage = new InMemoryStorage()
    const dataAccess = createTaskDataAccess({ storage })
    dataAccess.addTask(createStoredTask('有文字状态的任务', { priorityDate: '2026-08-03' }))

    render(<App dataAccess={dataAccess} getToday={() => '2026-08-03'} />)

    expect(await screen.findByText('状态：待处理')).toBeDefined()
    expect(screen.getByRole('group', { name: '有文字状态的任务的操作' })).toBeDefined()
    expect(screen.getByRole('button', { name: '开始' })).toBeDefined()
    expect(screen.getByRole('textbox', { name: '快速新建任务' })).toBeDefined()

    fireEvent.click(screen.getByRole('button', { name: '添加' }))
    expect(screen.getByRole('alert').textContent).toContain('请填写任务名称。')

    fireEvent.click(screen.getByRole('link', { name: '任务库' }))
    expect(await screen.findByRole('group', { name: '按任务状态筛选' })).toBeDefined()
    fireEvent.click(await screen.findByRole('button', { name: '新建任务' }))
    expect(screen.getByLabelText(/任务名称/)).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: '补充信息（可选）' }))
    expect(screen.getByLabelText(/内容范围/)).toBeDefined()
    expect(screen.getByLabelText(/下一步先做什么/)).toBeDefined()
    expect(screen.getByLabelText(/做到什么程度算完成/)).toBeDefined()
    expect(screen.getByLabelText(/计划日期/)).toBeDefined()
    expect(screen.getByLabelText(/备注/)).toBeDefined()
    expect(screen.getByRole('button', { name: '保存' })).toBeDefined()
  })

  it('does not show success when a storage write fails and keeps quick-create input', async () => {
    window.location.hash = '#/'
    const dataAccess = createTaskDataAccess({ storage: new FailingWriteStorage() })
    render(<App dataAccess={dataAccess} getToday={() => '2026-08-03'} />)

    const input = await screen.findByPlaceholderText('写下下一件需要完成的事')
    fireEvent.change(input, { target: { value: '写入失败任务' } })
    fireEvent.click(screen.getByRole('button', { name: '添加' }))

    expect((input as HTMLInputElement).value).toBe('写入失败任务')
    expect(screen.getAllByRole('alert').some((element) => element.textContent?.includes('任务没有保存成功。'))).toBe(true)
    expect(screen.queryByText('任务已创建并加入今日重点')).toBeNull()
    expect(screen.queryByText(/无法读取当前浏览器中的任务数据/)).toBeNull()
  })

  it('does not offer data-changing controls when existing browser data cannot be read', async () => {
    window.location.hash = '#/'
    const dataAccess = createTaskDataAccess({ storage: new FailingReadStorage() })
    render(<App dataAccess={dataAccess} getToday={() => '2026-08-03'} />)

    expect((await screen.findByRole('alert')).textContent).toContain('现有数据不会被自动覆盖')
    expect(screen.queryByPlaceholderText('写下下一件需要完成的事')).toBeNull()

    fireEvent.click(screen.getByRole('link', { name: '数据与说明' }))
    expect((await screen.findByRole('alert')).textContent).toContain('无法读取当前浏览器中的任务数据')
    expect(screen.queryByLabelText('选择备份文件')).toBeNull()

    fireEvent.click(screen.getByRole('link', { name: '任务库' }))
    expect((await screen.findByRole('alert')).textContent).toContain('无法读取任务列表')
    expect(screen.queryByRole('button', { name: '新建任务' })).toBeNull()
  })

  it('distinguishes all-completed Today state from a task library with no selected priority', async () => {
    window.location.hash = '#/'
    const storage = new InMemoryStorage()
    const dataAccess = createTaskDataAccess({ storage })
    dataAccess.addTask(createStoredTask('已完成的今日任务', { priorityDate: '2026-08-03' }))

    render(<App dataAccess={dataAccess} getToday={() => '2026-08-03'} />)

    fireEvent.click(await screen.findByRole('button', { name: '开始' }))
    fireEvent.click(screen.getByRole('button', { name: '标记完成' }))
    expect(await screen.findByRole('heading', { name: '当前重点已经处理完毕' })).toBeDefined()
    expect(screen.getByRole('link', { name: '查看任务库' })).toBeDefined()
  })

  it('distinguishes an empty task library from an empty active-task filter', async () => {
    window.location.hash = '#/tasks'
    const storage = new InMemoryStorage()
    const dataAccess = createTaskDataAccess({ storage })
    dataAccess.addTask({ ...createStoredTask('已完成任务'), status: '已完成' as const })

    render(<App dataAccess={dataAccess} getToday={() => '2026-08-03'} />)

    expect(await screen.findByRole('heading', { name: '暂无活跃任务' })).toBeDefined()
    expect(screen.queryByRole('heading', { name: '任务库还是空的' })).toBeNull()
  })

  it('keeps data actions accurate when there is no data to export or clear', async () => {
    window.location.hash = '#/data-info'
    const storage = new InMemoryStorage()
    const dataAccess = createTaskDataAccess({ storage })

    render(<App dataAccess={dataAccess} getToday={() => '2026-08-03'} />)

    const exportButton = await screen.findByRole('button', { name: '导出备份' })
    expect((exportButton as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: '清除本地数据' }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByLabelText('选择备份文件')).toBeDefined()
  })

  it('explains that an export download failure leaves current data unchanged', async () => {
    window.location.hash = '#/data-info'
    const storage = new InMemoryStorage()
    const dataAccess = createTaskDataAccess({ storage })
    const task = createStoredTask('导出失败后仍保留的任务')
    dataAccess.addTask(task)
    const originalCreateObjectUrl = Object.getOwnPropertyDescriptor(URL, 'createObjectURL')
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: () => {
        throw new Error('模拟下载失败')
      },
    })

    try {
      render(<App dataAccess={dataAccess} getToday={() => '2026-08-03'} />)

      fireEvent.click(await screen.findByRole('button', { name: '导出备份' }))
      expect((await screen.findByRole('alert')).textContent).toContain('备份文件没有生成成功。当前应用数据没有变化。')
      expect(dataAccess.getTaskById(task.id)).toEqual(task)
    } finally {
      if (originalCreateObjectUrl === undefined) {
        delete (URL as { createObjectURL?: unknown }).createObjectURL
      } else {
        Object.defineProperty(URL, 'createObjectURL', originalCreateObjectUrl)
      }
    }
  })

  it('shows a non-blocking notice for unresolved past priorities without changing the task', async () => {
    window.location.hash = '#/'
    const storage = new InMemoryStorage()
    const dataAccess = createTaskDataAccess({ storage })
    const task = createStoredTask('昨天的重点', { priorityDate: '2026-08-02' })
    dataAccess.addTask(task)

    render(<App dataAccess={dataAccess} getToday={() => '2026-08-03'} />)

    expect(await screen.findByText('有 1 项过往重点仍未处理')).toBeDefined()
    expect(dataAccess.getTaskById(task.id)).toMatchObject({ status: '待处理', todayPriorityDate: '2026-08-02' })
  })

  it('does not move a past priority to today when it is edited without changing its priority option', async () => {
    window.location.hash = '#/tasks'
    const storage = new InMemoryStorage()
    const dataAccess = createTaskDataAccess({ storage })
    const task = createStoredTask('过往重点任务', { priorityDate: '2026-08-02' })
    dataAccess.addTask(task)

    render(<App dataAccess={dataAccess} getToday={() => '2026-08-03'} />)

    fireEvent.click(await screen.findByRole('button', { name: '过往重点任务' }))
    fireEvent.change(screen.getByLabelText(/任务名称/), { target: { value: '已编辑的过往重点' } })
    fireEvent.click(screen.getByRole('button', { name: '保存' }))

    await waitFor(() => {
      expect(dataAccess.getTaskById(task.id)).toMatchObject({
        name: '已编辑的过往重点',
        todayPriorityDate: '2026-08-02',
      })
    })
  })

  it('opens replan from past priorities, requires a selected decision, previews it, and saves only after confirmation', async () => {
    window.location.hash = '#/'
    const storage = new InMemoryStorage()
    const dataAccess = createTaskDataAccess({ storage })
    const task = createStoredTask('需要重新安排的任务', { priorityDate: '2026-08-02' })
    dataAccess.addTask(task)

    render(<App dataAccess={dataAccess} getToday={() => '2026-08-03'} />)

    fireEvent.click(await screen.findByRole('link', { name: '去处理' }))
    expect(screen.getByRole('heading', { name: '从现在重新安排' })).toBeDefined()
    expect(screen.getByRole('group', { name: '需要重新安排的任务的重新安排方式' })).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: '确认保存结果' }))
    expect(screen.getAllByRole('alert').some((element) => element.textContent?.includes('请至少为一项任务选择处理方式。'))).toBe(true)
    expect(dataAccess.getTaskById(task.id)).toEqual(task)

    fireEvent.click(screen.getByRole('button', { name: '移除任务' }))
    fireEvent.click(screen.getByRole('button', { name: '查看结果预览' }))
    expect(screen.getByText('移入已移除列表，之后仍可恢复。')).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: '确认保存结果' }))

    await waitFor(() => {
      expect(dataAccess.getTaskById(task.id)).toMatchObject({ status: '已移除', todayPriorityDate: null })
    })
  })

  it('cancels replan without writing any draft changes', async () => {
    window.location.hash = '#/replan'
    const storage = new InMemoryStorage()
    const dataAccess = createTaskDataAccess({ storage })
    const task = createStoredTask('取消重新安排的任务', { priorityDate: '2026-08-02' })
    dataAccess.addTask(task)

    render(<App dataAccess={dataAccess} getToday={() => '2026-08-03'} />)

    fireEvent.click(await screen.findByRole('button', { name: '移回任务库' }))
    fireEvent.click(screen.getByRole('button', { name: '取消' }))

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '今日' })).toBeDefined()
    })
    expect(dataAccess.getTaskById(task.id)).toEqual(task)
  })

  it.each([360, 1280])('completes the core task-to-replan flow at a %ipx viewport', async (width) => {
    window.location.hash = '#/'
    setViewport(width)
    const storage = new InMemoryStorage()
    const dataAccess = createTaskDataAccess({ storage })
    render(<App dataAccess={dataAccess} getToday={() => '2026-08-03'} />)

    const input = await screen.findByPlaceholderText('写下下一件需要完成的事')
    fireEvent.change(input, { target: { value: '响应式核心流程任务' } })
    fireEvent.click(screen.getByRole('button', { name: '添加' }))
    fireEvent.click(await screen.findByRole('button', { name: '开始' }))
    fireEvent.click(screen.getByRole('button', { name: '标记部分完成' }))

    fireEvent.click(await screen.findByRole('link', { name: '从现在重新安排' }))
    expect(screen.getByRole('button', { name: '今天继续' })).toBeDefined()
    expect(screen.getByRole('button', { name: '缩小范围' })).toBeDefined()
    expect(screen.getByRole('button', { name: '拆分任务' })).toBeDefined()
    expect(screen.getByRole('button', { name: '改到其他日期' })).toBeDefined()
    expect(screen.getByRole('button', { name: '移回任务库' })).toBeDefined()
    expect(screen.getByRole('button', { name: '移除任务' })).toBeDefined()

    fireEvent.click(screen.getByRole('button', { name: '移回任务库' }))
    fireEvent.click(screen.getByRole('button', { name: '查看结果预览' }))
    fireEvent.click(screen.getByRole('button', { name: '确认保存结果' }))

    await waitFor(() => {
      expect(dataAccess.getAllTasks()).toEqual([
        expect.objectContaining({
          name: '响应式核心流程任务',
          plannedDate: null,
          status: '部分完成',
          todayPriorityDate: null,
        }),
      ])
    })
  })

  it('renders long task text together with its primary action', async () => {
    window.location.hash = '#/'
    const storage = new InMemoryStorage()
    const dataAccess = createTaskDataAccess({ storage })
    const longName = '数学函数练习'.repeat(80)
    dataAccess.addTask(createStoredTask(longName, { priorityDate: '2026-08-03' }))

    render(<App dataAccess={dataAccess} getToday={() => '2026-08-03'} />)

    expect(await screen.findByRole('button', { name: longName })).toBeDefined()
    expect(screen.getByRole('button', { name: '开始' })).toBeDefined()
  })

  it('cancels an import preview and clear confirmation without changing existing data', async () => {
    window.location.hash = '#/data-info'
    const storage = new InMemoryStorage()
    const dataAccess = createTaskDataAccess({ storage })
    const task = createStoredTask('原有任务')
    dataAccess.addTask(task)
    const backupJson = JSON.stringify({
      backupFormatVersion: 1,
      exportedAt: FIXED_TIMESTAMP,
      storageFormatVersion: 1,
      tasks: [createStoredTask('将被取消的导入任务')],
    })
    const backupFile = new File([backupJson], 'backup.json', { type: 'application/json' })
    Object.defineProperty(backupFile, 'text', { value: async () => backupJson })

    render(<App dataAccess={dataAccess} getToday={() => '2026-08-03'} />)

    fireEvent.change(await screen.findByLabelText('选择备份文件'), { target: { files: [backupFile] } })
    expect(await screen.findByRole('heading', { name: '导入备份预览' })).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: '取消导入' }))
    expect(dataAccess.getTaskById(task.id)).toEqual(task)

    fireEvent.click(screen.getByRole('button', { name: '清除本地数据' }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '取消' }))
    expect(dataAccess.getTaskById(task.id)).toEqual(task)
  })

  it('imports a validated preview only after confirmation and then shows the restored data from Today', async () => {
    window.location.hash = '#/data-info'
    const storage = new InMemoryStorage()
    const dataAccess = createTaskDataAccess({ storage })
    const oldTask = createStoredTask('旧任务')
    const restoredTask = createTask(
      { name: '恢复的任务', notes: '来自备份' },
      {
        createId: () => '7649cd97-6995-4eaf-b55c-686f0fad9a7a',
        now: () => new Date(FIXED_TIMESTAMP),
      },
    )
    dataAccess.addTask(oldTask)
    const backupJson = JSON.stringify({
      backupFormatVersion: 1,
      exportedAt: FIXED_TIMESTAMP,
      storageFormatVersion: 1,
      tasks: [restoredTask],
    })
    const backupFile = new File([backupJson], 'restore.json', { type: 'application/json' })
    Object.defineProperty(backupFile, 'text', { value: async () => backupJson })

    render(<App dataAccess={dataAccess} getToday={() => '2026-08-03'} />)

    fireEvent.change(await screen.findByLabelText('选择备份文件'), { target: { files: [backupFile] } })
    expect(await screen.findByRole('heading', { name: '导入备份预览' })).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: '确认导入' }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '确认导入' }))

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '今日' })).toBeDefined()
    })
    expect(dataAccess.getAllTasks()).toEqual([restoredTask])
  })

  it('clears an older import preview when a newly selected file cannot be read or validated', async () => {
    window.location.hash = '#/data-info'
    const storage = new InMemoryStorage()
    const dataAccess = createTaskDataAccess({ storage })
    const task = createStoredTask('当前任务')
    dataAccess.addTask(task)
    const validJson = JSON.stringify({
      backupFormatVersion: 1,
      exportedAt: FIXED_TIMESTAMP,
      storageFormatVersion: 1,
      tasks: [createStoredTask('有效备份任务')],
    })
    const validFile = new File([validJson], 'valid.json', { type: 'application/json' })
    Object.defineProperty(validFile, 'text', { value: async () => validJson })
    const invalidFile = new File(['not-json'], 'invalid.json', { type: 'application/json' })
    Object.defineProperty(invalidFile, 'text', { value: async () => 'not-json' })

    render(<App dataAccess={dataAccess} getToday={() => '2026-08-03'} />)

    const fileInput = await screen.findByLabelText('选择备份文件')
    fireEvent.change(fileInput, { target: { files: [validFile] } })
    expect(await screen.findByRole('heading', { name: '导入备份预览' })).toBeDefined()
    fireEvent.change(fileInput, { target: { files: [invalidFile] } })

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: '导入备份预览' })).toBeNull()
    })
    expect(dataAccess.getAllTasks()).toEqual([task])
  })
})
